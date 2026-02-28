// ============================================================
// MailFlow — Route API : Traitement des emails entrants
// POST /api/emails/process
// Déclenché par cron Vercel toutes les 5 minutes
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { fetchNewEmails, getOrCreateCategoryLabel, applyLabelToEmail } from '@/lib/gmail'
import { classifyEmail } from '@/lib/openai'
import { rateLimit, RATE_LIMIT_CONFIGS, getClientIpFromHeaders } from '@/lib/rateLimit'
import type { Plan } from '@prisma/client'

export const dynamic = 'force-dynamic'

// Limite d'emails par exécution par utilisateur selon le plan
const PLAN_EMAIL_LIMITS: Record<Plan, number> = {
  free: 0,
  starter: 25,
  pro: 50,
  business: 100,
}

// Taille des batches pour le traitement parallèle
const BATCH_SIZE = 5

// ----------------------------------------------------------
// Vérification de l'auth cron (Vercel CRON_SECRET)
// ----------------------------------------------------------
function isCronAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return true // Développement sans secret
  return authHeader === `Bearer ${cronSecret}`
}

// ----------------------------------------------------------
// Traiter un email individuel
// ----------------------------------------------------------
interface EmailProcessResult {
  success: boolean
  skipped?: boolean
  error?: string
}

async function processEmail(
  userId: string,
  gmailEmail: Awaited<ReturnType<typeof fetchNewEmails>>[number]
): Promise<EmailProcessResult> {
  try {
    // Vérifier si l'email est déjà en DB
    const existing = await db.email.findUnique({
      where: { gmailId: gmailEmail.id },
      select: { id: true },
    })

    if (existing) return { success: true, skipped: true }

    // Classifier avec OpenAI
    const classification = await classifyEmail({
      from: gmailEmail.from,
      to: gmailEmail.to,
      subject: gmailEmail.subject,
      snippet: gmailEmail.snippet,
    })

    // Sauvegarder l'email en DB
    const savedEmail = await db.email.create({
      data: {
        userId,
        gmailId: gmailEmail.id,
        threadId: gmailEmail.threadId,
        from: gmailEmail.from,
        to: gmailEmail.to,
        cc: gmailEmail.cc,
        subject: gmailEmail.subject,
        snippet: gmailEmail.snippet,
        receivedAt: gmailEmail.receivedAt,
        category: classification.category,
        confidence: classification.confidence,
        labels: gmailEmail.labels,
        isRead: gmailEmail.isRead,
        aiReason: classification.reason,
        isProcessed: true,
        processedAt: new Date(),
        metadata: {
          classifiedBy: classification.source === 'openai' ? 'gpt-4o-mini' : 'rules',
        },
      },
    })

    // Appliquer le label Gmail si la confiance est suffisante
    if (classification.confidence >= 0.6 && classification.category !== 'unknown') {
      try {
        const labelId = await getOrCreateCategoryLabel(userId, classification.category)
        if (labelId) {
          await applyLabelToEmail(userId, gmailEmail.id, labelId)

          await db.email.update({
            where: { id: savedEmail.id },
            data: { isLabeled: true },
          })
        }
      } catch (labelErr) {
        // Erreur de labelling non bloquante — l'email est quand même sauvegardé
        const msg = labelErr instanceof Error ? labelErr.message : 'unknown error'
        console.error(`[Process] Failed to apply label (non-blocking):`, msg)
      }
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return { success: false, error: msg }
  }
}

// ----------------------------------------------------------
// POST — Traiter les emails pour tous les utilisateurs actifs
// BATCH PROCESSING : traite les emails en lots parallèles (QA Fix #3 & #4)
// ----------------------------------------------------------
export async function POST(request: NextRequest) {
  // Rate limiting (protection contre les appels abusifs)
  const ip = getClientIpFromHeaders(request.headers)
  const rl = await rateLimit(ip, RATE_LIMIT_CONFIGS.process)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too Many Requests', retryAfter: Math.ceil(rl.retryAfterMs / 1000) },
      { status: 429 }
    )
  }

  // Vérification auth cron
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const results: Array<{
    userId: string
    email: string
    processed: number
    skipped: number
    errors: number
  }> = []

  try {
    // Récupérer les utilisateurs actifs (plan payant + tokens valides)
    const users = await db.user.findMany({
      where: {
        plan: { not: 'free' },
        googleRefreshToken: { not: null },
        isOnboarded: true,
      },
      select: {
        id: true,
        email: true,
        plan: true,
        lastSyncAt: true,
      },
    })

    console.log(`[Process] Processing emails for ${users.length} users`)

    // Traitement de chaque utilisateur
    for (const user of users) {
      let processedCount = 0
      let skippedCount = 0
      let errorCount = 0

      try {
        const limit = PLAN_EMAIL_LIMITS[user.plan]
        if (limit === 0) continue

        // Récupérer les nouveaux emails depuis la dernière sync
        const newEmails = await fetchNewEmails(
          user.id,
          user.lastSyncAt ?? undefined,
          limit
        )

        console.log(`[Process] Found ${newEmails.length} new emails for user ${user.id}`)

        // === BATCH PROCESSING (QA Fix #4) ===
        // Traitement par lots parallèles pour performance
        // BATCH_SIZE = 5 pour équilibrer vitesse et rate limits OpenAI
        for (let i = 0; i < newEmails.length; i += BATCH_SIZE) {
          const batch = newEmails.slice(i, i + BATCH_SIZE)

          const batchResults = await Promise.allSettled(
            batch.map((gmailEmail) => processEmail(user.id, gmailEmail))
          )

          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              if (result.value.skipped) {
                skippedCount++
              } else if (result.value.success) {
                processedCount++
              } else {
                errorCount++
              }
            } else {
              errorCount++
            }
          }

          // Pause entre les batches pour respecter les rate limits OpenAI
          // (5 emails × 100ms d'intervalle minimum = ~500ms/batch)
          if (i + BATCH_SIZE < newEmails.length) {
            await new Promise((resolve) => setTimeout(resolve, 200))
          }
        }

        // Mettre à jour le lastSyncAt
        await db.user.update({
          where: { id: user.id },
          data: { lastSyncAt: new Date() },
        })

        results.push({
          userId: user.id,
          email: user.email,
          processed: processedCount,
          skipped: skippedCount,
          errors: errorCount,
        })
      } catch (userErr) {
        const msg = userErr instanceof Error ? userErr.message : 'unknown error'
        console.error(`[Process] Error processing user:`, msg)
        results.push({
          userId: user.id,
          email: user.email,
          processed: processedCount,
          skipped: skippedCount,
          errors: errorCount + 1,
        })
      }
    }

    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0)
    const duration = Date.now() - startTime

    console.log(`[Process] Done. ${totalProcessed} emails processed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      totalProcessed,
      usersProcessed: users.length,
      duration: `${duration}ms`,
      results,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error('[Process] Fatal error:', msg)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ----------------------------------------------------------
// GET — Déclencher manuellement (dev only)
// ----------------------------------------------------------
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  return POST(request)
}
