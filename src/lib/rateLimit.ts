// ============================================================
// MailFlow — Utilitaire Rate Limiting avec Redis (Upstash)
// Compatible avec le edge runtime de Vercel
// Fallback in-memory si Redis non disponible
// ============================================================

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
export interface RateLimitConfig {
  /** Nombre max de requêtes dans la fenêtre */
  limit: number
  /** Durée de la fenêtre en millisecondes */
  windowMs: number
  /** Identifiant unique pour cette règle (ex: 'api:feedback') */
  identifier: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterMs: number
}

// ----------------------------------------------------------
// Store in-memory (fallback sans Redis)
// ----------------------------------------------------------
interface MemoryEntry {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, MemoryEntry>()

function checkMemoryRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs
    memoryStore.set(key, { count: 1, resetAt })
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetAt,
      retryAfterMs: 0,
    }
  }

  if (entry.count >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - now,
    }
  }

  entry.count++
  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
    retryAfterMs: 0,
  }
}

// ----------------------------------------------------------
// Client Redis (Upstash) — lazy init
// ----------------------------------------------------------
type RedisClient = {
  pipeline: () => {
    incr: (key: string) => unknown
    expire: (key: string, seconds: number) => unknown
    exec: () => Promise<Array<[Error | null, unknown]>>
  }
  ttl: (key: string) => Promise<number>
}

let redisClient: RedisClient | null = null
let redisAvailable = false

async function getRedisClient(): Promise<RedisClient | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  if (redisClient) return redisClient

  try {
    // Import dynamique pour éviter les erreurs si Upstash n'est pas installé
    const { Redis } = await import('@upstash/redis').catch(() => ({ Redis: null }))

    if (!Redis) {
      console.warn('[RateLimit] @upstash/redis not installed. Using in-memory fallback.')
      return null
    }

    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }) as unknown as RedisClient

    redisAvailable = true
    return redisClient
  } catch (err) {
    console.warn('[RateLimit] Failed to init Redis client:', err)
    return null
  }
}

// ----------------------------------------------------------
// Rate limit avec Redis (sliding window counter)
// ----------------------------------------------------------
async function checkRedisRateLimit(
  redis: RedisClient,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowSeconds = Math.ceil(config.windowMs / 1000)

  try {
    const pipeline = redis.pipeline()
    pipeline.incr(key)
    pipeline.expire(key, windowSeconds)
    const results = await pipeline.exec()

    const count = (results[0]?.[1] as number) ?? 1
    const ttl = await redis.ttl(key)

    const resetAt = now + ttl * 1000

    if (count > config.limit) {
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        resetAt,
        retryAfterMs: ttl * 1000,
      }
    }

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - count,
      resetAt,
      retryAfterMs: 0,
    }
  } catch (err) {
    console.error('[RateLimit] Redis error, falling back to memory:', err)
    return checkMemoryRateLimit(key, config)
  }
}

// ----------------------------------------------------------
// Fonction principale : rateLimit(ip, config)
// ----------------------------------------------------------
export async function rateLimit(
  clientKey: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `rl:${config.identifier}:${clientKey}`

  const redis = await getRedisClient()

  if (redis) {
    return checkRedisRateLimit(redis, key, config)
  }

  // Fallback in-memory
  return checkMemoryRateLimit(key, config)
}

// ----------------------------------------------------------
// Configurations prédéfinies pour les routes MailFlow
// ----------------------------------------------------------
export const RATE_LIMIT_CONFIGS = {
  /** Auth OAuth — 10 req/min/IP */
  auth: {
    identifier: 'auth',
    limit: 10,
    windowMs: 60_000,
  },

  /** Feedback — 30 req/min/IP */
  feedback: {
    identifier: 'feedback',
    limit: 30,
    windowMs: 60_000,
  },

  /** Process cron — 5 req/min/IP */
  process: {
    identifier: 'process',
    limit: 5,
    windowMs: 60_000,
  },

  /** Billing — 20 req/min/IP */
  billing: {
    identifier: 'billing',
    limit: 20,
    windowMs: 60_000,
  },

  /** API générale — 100 req/min/IP */
  api: {
    identifier: 'api',
    limit: 100,
    windowMs: 60_000,
  },

  /** Webhook Stripe — pas de rate limit côté applicatif */
  webhook: {
    identifier: 'webhook',
    limit: 200,
    windowMs: 60_000,
  },
} satisfies Record<string, RateLimitConfig>

// ----------------------------------------------------------
// Helper : créer une réponse 429 standard
// ----------------------------------------------------------
export function buildRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry in ${Math.ceil(result.retryAfterMs / 1000)}s`,
      retryAfter: Math.ceil(result.retryAfterMs / 1000),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
      },
    }
  )
}

// ----------------------------------------------------------
// Helper : extraire l'IP depuis les headers
// ----------------------------------------------------------
export function getClientIpFromHeaders(headers: Headers): string {
  return (
    headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ??
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  )
}
