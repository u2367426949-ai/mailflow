// ============================================================
// MailFlow — Route API : Tri complet de la boîte mail
// POST /api/emails/sort-all — lance le tri massif
// GET  /api/emails/sort-all — récupère la progression
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { fetchNewEmails, getOrCreateCategoryLabel, applyLabelToEmail } from '@/lib/gmail'
import { classifyEmail } from '@/lib/openai'
import { getUserIdFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min max (Vercel Pro)

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
interface SortJob {
  status: 'idle' | 'running' | 'completed' | 'error'
  startedAt: string | null
  completedAt: string | null
  totalEmails: number
  processed: number
  labeled: number
  errors: number
  currentBatch: number
  totalBatches: number
  lastError: string | null
}

const DEFAULT_JOB: SortJob = {
  status: 'idle',
  startedAt: null,
  completedAt: null,
  totalEmails: 0,
  processed: 0,
  labeled: 0,
  errors: 0,
  currentBatch: 0,
  totalBatches: 0,
  lastError: null,
}

// ----------------------------------------------------------
// Helper : lire / écrire la progression dans settings.sortJob
// ----------------------------------------------------------
async function getSortJob(userId: string): Promise<SortJob> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  })
  const settings = user?.settings as Record<string, unknown> | null
  return (settings?.sortJob as SortJob) ?? { ...DEFAULT_JOB }
}

async function updateSortJob(userId: string, updates: Partial<SortJob>) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  })
  const settings = (user?.settings as Record<string, unknown>) ?? {}
  const currentJob = (settings.sortJob as SortJob) ?? { ...DEFAULT_JOB }

  await db.user.update({
    where: { id: userId },
    data: {
      settings: {
        ...settings,
        sortJob: { ...currentJob, ...updates },
      } as Prisma.InputJsonValue,
    },
  })
}

// ----------------------------------------------------------
// GET — Récupérer la progression du tri en cours
// ----------------------------------------------------------
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const job = await getSortJob(userId)
  return NextResponse.json({ job })
}

// ----------------------------------------------------------
// POST — Lancer le tri complet de la boîte mail
// ----------------------------------------------------------
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Vérifier le plan
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, settings: true },
  })
  if (!user || (user.plan !== 'pro' && user.plan !== 'business')) {
    return NextResponse.json({ error: 'Plan Pro requis' }, { status: 403 })
  }

  // Vérifier qu'un tri n'est pas déjà en cours
  const currentJob = await getSortJob(userId)
  if (currentJob.status === 'running') {
    return NextResponse.json({ error: 'Un tri est déjà en cours', job: currentJob }, { status: 409 })
  }

  // Récupérer les customRules
  const settings = user.settings as Record<string, unknown> | null
  const customRules = typeof settings?.customRules === 'string' ? settings.customRules : null

  // Initialiser le job
  await updateSortJob(userId, {
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    totalEmails: 0,
    processed: 0,
    labeled: 0,
    errors: 0,
    currentBatch: 0,
    totalBatches: 0,
    lastError: null,
  })

  // Lancer le tri en arrière-plan
  // (la réponse est renvoyée immédiatement, le tri continue)
  processSortJob(userId, customRules).catch((err) => {
    console.error('[SortAll] Fatal error:', err)
    updateSortJob(userId, {
      status: 'error',
      lastError: err instanceof Error ? err.message : 'Erreur inattendue',
      completedAt: new Date().toISOString(),
    })
  })

  return NextResponse.json({ success: true, message: 'Tri lancé' })
}

// ----------------------------------------------------------
// Traitement asynchrone du tri complet
// ----------------------------------------------------------
async function processSortJob(userId: string, customRules: string | null) {
  const BATCH_SIZE = 10
  const MAX_EMAILS = 50000 // Limite Pro

  try {
    // Phase 1 : Compter les emails non traités dans Gmail
    // On récupère d'abord un lot large de messages
    const allEmails = await fetchNewEmails(userId, undefined, MAX_EMAILS)

    // Filtrer ceux qu'on a déjà en DB
    const existingIds = new Set(
      (await db.email.findMany({
        where: { userId },
        select: { gmailId: true },
      })).map((e) => e.gmailId)
    )

    const newEmails = allEmails.filter((e) => !existingIds.has(e.id))
    const totalBatches = Math.ceil(newEmails.length / BATCH_SIZE)

    await updateSortJob(userId, {
      totalEmails: newEmails.length,
      totalBatches,
    })

    if (newEmails.length === 0) {
      await updateSortJob(userId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      return
    }

    // Phase 2 : Classifier et labelliser par batches
    let processed = 0
    let labeled = 0
    let errors = 0

    for (let i = 0; i < newEmails.length; i += BATCH_SIZE) {
      const batch = newEmails.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1

      for (const gmailEmail of batch) {
        try {
          // Classifier
          const classification = await classifyEmail(
            {
              from: gmailEmail.from,
              to: gmailEmail.to,
              subject: gmailEmail.subject,
              snippet: gmailEmail.snippet,
            },
            customRules
          )

          // Sauvegarder en DB
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
                sortJob: true,
              },
            },
          })

          processed++

          // Labelliser dans Gmail si confiance suffisante
          if (classification.confidence >= 0.6 && classification.category !== 'unknown') {
            try {
              const labelId = await getOrCreateCategoryLabel(userId, classification.category)
              if (labelId) {
                await applyLabelToEmail(userId, gmailEmail.id, labelId)
                await db.email.update({
                  where: { id: savedEmail.id },
                  data: { isLabeled: true },
                })
                labeled++
              }
            } catch {
              // Erreur de labelling non bloquante
            }
          }
        } catch (err) {
          errors++
          const msg = err instanceof Error ? err.message : 'unknown'
          console.error(`[SortAll] Error processing email:`, msg)
        }

        // Pause entre emails (rate limit OpenAI + Gmail)
        await new Promise((resolve) => setTimeout(resolve, 150))
      }

      // Mettre à jour la progression après chaque batch
      await updateSortJob(userId, {
        currentBatch: batchNum,
        processed,
        labeled,
        errors,
      })
    }

    // Terminé
    await updateSortJob(userId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      processed,
      labeled,
      errors,
    })

    // Mettre à jour le lastSyncAt
    await db.user.update({
      where: { id: userId },
      data: { lastSyncAt: new Date() },
    })

    console.log(`[SortAll] Completed for user ${userId}: ${processed} processed, ${labeled} labeled, ${errors} errors`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inattendue'
    console.error('[SortAll] Job failed:', msg)
    await updateSortJob(userId, {
      status: 'error',
      lastError: msg,
      completedAt: new Date().toISOString(),
    })
  }
}
