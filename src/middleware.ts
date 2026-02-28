// ============================================================
// MailFlow — Middleware Next.js
// Rate limiting sur toutes les routes API + protection auth
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)

// ----------------------------------------------------------
// Rate limiter in-memory (edge-compatible fallback)
// En prod, préférer src/lib/rateLimit.ts avec Redis
// ----------------------------------------------------------
interface RateLimitEntry {
  count: number
  resetAt: number
}

// Map<ip, { count, resetAt }> — simple sliding window
const rateLimitStore = new Map<string, RateLimitEntry>()

// Nettoyage périodique pour éviter les fuites mémoire
// (In-memory seulement — en edge runtime, chaque instance a son propre store)
function cleanExpiredEntries() {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}

// Vérifier le rate limit pour une clé
function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()

  // Nettoyage occasionnel (1% des requêtes)
  if (Math.random() < 0.01) cleanExpiredEntries()

  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    // Nouveau fenêtre
    const resetAt = now + windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

// ----------------------------------------------------------
// Limites selon les routes
// ----------------------------------------------------------
const ROUTE_LIMITS: Array<{
  pattern: RegExp
  limit: number
  windowMs: number
  label: string
}> = [
  // Auth OAuth — très restrictif pour éviter le brute force
  {
    pattern: /^\/api\/auth\//,
    limit: 10,
    windowMs: 60_000, // 10 req / min
    label: 'auth',
  },
  // Feedback — modéré pour éviter la pollution des données
  {
    pattern: /^\/api\/emails\/feedback/,
    limit: 30,
    windowMs: 60_000, // 30 req / min
    label: 'feedback',
  },
  // Process cron — très restrictif (route admin)
  {
    pattern: /^\/api\/emails\/process/,
    limit: 5,
    windowMs: 60_000, // 5 req / min
    label: 'process',
  },
  // Billing — restrictif pour éviter le spam de checkout
  {
    pattern: /^\/api\/billing/,
    limit: 20,
    windowMs: 60_000, // 20 req / min
    label: 'billing',
  },
  // Webhooks Stripe — pas de rate limit (Stripe IP whitelisting en prod)
  {
    pattern: /^\/api\/webhooks\//,
    limit: 100,
    windowMs: 60_000,
    label: 'webhooks',
  },
  // Routes API générales
  {
    pattern: /^\/api\//,
    limit: 100,
    windowMs: 60_000, // 100 req / min
    label: 'api_default',
  },
]

// ----------------------------------------------------------
// Obtenir l'IP du client (compatible Vercel / Cloudflare)
// ----------------------------------------------------------
function getClientIp(request: NextRequest): string {
  // Vercel
  const vercelIp = request.headers.get('x-vercel-forwarded-for')
  if (vercelIp) return vercelIp.split(',')[0].trim()

  // Cloudflare
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp

  // Proxy standard
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()

  // Fallback
  return request.headers.get('x-real-ip') ?? 'unknown'
}

// ----------------------------------------------------------
// Middleware principal
// ----------------------------------------------------------
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // === Rate Limiting ===
  if (pathname.startsWith('/api/')) {
    const ip = getClientIp(request)

    // Trouver la règle applicable (première qui match)
    const rule = ROUTE_LIMITS.find((r) => r.pattern.test(pathname))

    if (rule) {
      const key = `${rule.label}:${ip}`
      const { allowed, remaining, resetAt } = checkRateLimit(key, rule.limit, rule.windowMs)

      if (!allowed) {
        return NextResponse.json(
          {
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((resetAt - Date.now()) / 1000)}s`,
            retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': String(rule.limit),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
              'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
            },
          }
        )
      }

      // Headers informatifs
      const response = NextResponse.next()
      response.headers.set('X-RateLimit-Limit', String(rule.limit))
      response.headers.set('X-RateLimit-Remaining', String(remaining))
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
      return response
    }
  }

  // === Protection des routes dashboard ===
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('mailflow_session')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // On laisse passer — le dashboard vérifie le token côté serveur via /api/me
  }

  // === Redirection si déjà connecté (login / onboarding) ===
  // Un utilisateur avec un JWT valide n'a pas besoin de repasser par ces pages
  if (pathname === '/login' || pathname === '/onboarding') {
    const token = request.cookies.get('mailflow_session')?.value
    if (token) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        // Token valide → rediriger selon l'état onboarding
        const isOnboarded = payload['isOnboarded'] as boolean | undefined
        const destination = isOnboarded ? '/dashboard' : '/onboarding?auth=success'
        // Éviter une boucle infinie sur /onboarding
        if (pathname === '/onboarding' && !isOnboarded) {
          return NextResponse.next()
        }
        return NextResponse.redirect(new URL(destination, request.url))
      } catch {
        // Token invalide/expiré → laisser passer, le cookie sera nettoyé par la page
      }
    }
  }

  return NextResponse.next()
}

// ----------------------------------------------------------
// Matcher — quelles routes passe par le middleware
// ----------------------------------------------------------
export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/login',
    '/onboarding',
  ],
}
