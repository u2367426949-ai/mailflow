// ============================================================
// MailFlow — Client Prisma singleton
// Avec configuration du pool de connexions (QA Fix #6)
// ============================================================

import { PrismaClient } from '@prisma/client'

// ----------------------------------------------------------
// Configuration du pool de connexions
// Adapté à Vercel/Serverless + PlanetScale/Supabase
// ----------------------------------------------------------
const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL environment variable is not set')

  // En serverless (Vercel), on ajoute connection_limit pour éviter
  // d'épuiser le pool de connexions de la base de données
  // La valeur recommandée pour Vercel est 1-5 selon le plan
  if (!url.includes('connection_limit') && !url.includes('pgbouncer')) {
    const separator = url.includes('?') ? '&' : '?'
    const limit = process.env.DB_CONNECTION_LIMIT ?? '5'
    return `${url}${separator}connection_limit=${limit}&pool_timeout=20`
  }

  return url
}

// ----------------------------------------------------------
// Options Prisma selon l'environnement
// ----------------------------------------------------------
function createPrismaClient(): PrismaClient {
  const isProduction = process.env.NODE_ENV === 'production'
  const isDevelopment = process.env.NODE_ENV === 'development'

  return new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: isDevelopment
      ? ['query', 'error', 'warn']
      : isProduction
      ? ['error']
      : ['error', 'warn'],

    // Configuration du pool interne Prisma
    // Note : le pool principal est configuré via l'URL (connection_limit)
    // Ces options contrôlent le comportement du client Prisma lui-même
  })
}

// ----------------------------------------------------------
// Singleton global (évite les connexions multiples en dev HMR)
// Lazy initialization pour éviter le crash au build Vercel
// ----------------------------------------------------------
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDbClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getDbClient() as Record<string | symbol, unknown>)[prop]
  },
})

// ----------------------------------------------------------
// Graceful shutdown (Node.js only — pas en Edge runtime)
// ----------------------------------------------------------
if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
  process.on('beforeExit', async () => {
    if (globalForPrisma.prisma) {
      await globalForPrisma.prisma.$disconnect()
    }
  })
}

export default db
