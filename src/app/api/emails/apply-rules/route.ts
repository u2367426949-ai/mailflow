// ============================================================
// MailFlow — Route API : Appliquer les nouvelles règles
// POST /api/emails/apply-rules — re-classifie les emails existants
// GET  /api/emails/apply-rules — récupère la progression
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { classifyEmail } from '@/lib/openai'
import { getOrCreateCategoryLabel, moveEmail } from '@/lib/gmail'
import { getUserIdFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
interface ApplyJob {
  status: 'idle' | 'running' | 'completed' | 'error'
  startedAt: string | null
  completedAt: string | null
  totalEmails: number
  processed: number
  reclassified: number
  relabeled: number
  errors: number
  lastError: string | null
}

const DEFAULT_JOB: ApplyJob = {
  status: 'idle',
  startedAt: null,
  completedAt: null,
  totalEmails: 0,
  processed: 0,
  reclassified: 0,
  relabeled: 0,
  errors: 0,
  lastError: null,
}

// ----------------------------------------------------------
// Helpers : lire / écrire la progression
// ----------------------------------------------------------
async function getApplyJob(userId: string): Promise<ApplyJob> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  })
  const settings = user?.settings as Record<string, unknown> | null
  return (settings?.applyRulesJob as ApplyJob) ?? { ...DEFAULT_JOB }
}

async function updateApplyJob(userId: string, updates: Partial<ApplyJob>) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  })
  const settings = (user?.settings as Record<string, unknown>) ?? {}
  const currentJob = (settings.applyRulesJob as ApplyJob) ?? { ...DEFAULT_JOB }

  await db.user.update({
    where: { id: userId },
    data: {
      settings: {
        ...settings,
        applyRulesJob: { ...currentJob, ...updates },
      } as Prisma.InputJsonValue,
    },
  })
}

// ----------------------------------------------------------
// GET — Récupérer la progression
// ----------------------------------------------------------
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const job = await getApplyJob(userId)
  return NextResponse.json({ job })
}

// ----------------------------------------------------------
// POST — Lancer l'application des règles
// ----------------------------------------------------------
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, settings: true },
  })
  if (!user || (user.plan !== 'pro' && user.plan !== 'business')) {
    return NextResponse.json({ error: 'Plan Pro requis' }, { status: 403 })
  }

  // Vérifier qu'un job n'est pas déjà en cours (utiliser settings déjà chargé)
  const settings = user.settings as Record<string, unknown> | null
  const currentApplyJob = (settings?.applyRulesJob as ApplyJob) ?? { ...DEFAULT_JOB }
  if (currentApplyJob.status === 'running') {
    return NextResponse.json({ error: 'Application déjà en cours', job: currentApplyJob }, { status: 409 })
  }

  // Récupérer les règles
  const customRules = typeof settings?.customRules === 'string' ? settings.customRules : null

  if (!customRules) {
    return NextResponse.json({ error: 'Aucune règle à appliquer' }, { status: 400 })
  }

  // Initialiser le job
  await updateApplyJob(userId, {
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    totalEmails: 0,
    processed: 0,
    reclassified: 0,
    relabeled: 0,
    errors: 0,
    lastError: null,
  })

  // Traitement SYNCHRONE (Vercel tue les background jobs après la réponse)
  try {
    await processApplyRulesJob(userId, customRules)
  } catch (err) {
    console.error('[ApplyRules] Fatal error:', err)
    await updateApplyJob(userId, {
      status: 'error',
      lastError: err instanceof Error ? err.message : 'Erreur inattendue',
      completedAt: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Erreur durant l\'application des règles' }, { status: 500 })
  }

  const finalJob = await getApplyJob(userId)
  return NextResponse.json({ success: true, job: finalJob })
}

// ----------------------------------------------------------
// Traitement asynchrone
// ----------------------------------------------------------
async function processApplyRulesJob(userId: string, customRules: string) {
  const CONCURRENCY = 5
  const BATCH_SIZE = 20

  // Cache des label IDs Gmail
  const labelCache = new Map<string, string | null>()

  async function getCachedLabel(category: string): Promise<string | null> {
    if (labelCache.has(category)) return labelCache.get(category)!
    try {
      const labelId = await getOrCreateCategoryLabel(userId, category)
      labelCache.set(category, labelId)
      return labelId
    } catch {
      labelCache.set(category, null)
      return null
    }
  }

  try {
    // Récupérer tous les emails existants
    const allEmails = await db.email.findMany({
      where: { userId },
      select: {
        id: true,
        gmailId: true,
        from: true,
        to: true,
        subject: true,
        snippet: true,
        category: true,
        confidence: true,
      },
      orderBy: { receivedAt: 'desc' },
    })

    await updateApplyJob(userId, { totalEmails: allEmails.length })

    if (allEmails.length === 0) {
      await updateApplyJob(userId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      return
    }

    let processed = 0
    let reclassified = 0
    let relabeled = 0
    let errors = 0

    // Traiter par batches
    for (let i = 0; i < allEmails.length; i += BATCH_SIZE) {
      const batch = allEmails.slice(i, i + BATCH_SIZE)

      // Classifier en parallèle (par slots de CONCURRENCY)
      for (let j = 0; j < batch.length; j += CONCURRENCY) {
        const slot = batch.slice(j, j + CONCURRENCY)

        const results = await Promise.allSettled(
          slot.map(async (email) => {
            // Re-classifier avec les nouvelles règles
            const newClassification = await classifyEmail(
              {
                from: email.from,
                to: Array.isArray(email.to) ? email.to : [email.to ?? ''],
                subject: email.subject,
                snippet: email.snippet,
              },
              customRules
            )

            const categoryChanged = newClassification.category !== email.category

            // Mettre à jour en DB
            await db.email.update({
              where: { id: email.id },
              data: {
                category: newClassification.category,
                confidence: newClassification.confidence,
                aiReason: newClassification.reason,
                isProcessed: true,
                processedAt: new Date(),
                isLabeled: false, // Reset pour re-labelliser
                metadata: {
                  classifiedBy: newClassification.source === 'openai' ? 'gpt-4o-mini' : 'rules',
                  reapplied: true,
                  previousCategory: email.category,
                },
              },
            })

            // Re-labelliser + déplacer dans Gmail si confiance suffisante
            let labeled = false
            if (newClassification.confidence >= 0.6 && newClassification.category !== 'unknown') {
              try {
                const labelId = await getCachedLabel(newClassification.category)
                if (labelId) {
                  await moveEmail(userId, email.gmailId, labelId, newClassification.category)
                  await db.email.update({
                    where: { id: email.id },
                    data: { isLabeled: true },
                  })
                  labeled = true
                }
              } catch {
                // Label error non bloquante
              }
            }

            return { categoryChanged, labeled }
          })
        )

        for (const r of results) {
          processed++
          if (r.status === 'fulfilled') {
            if (r.value.categoryChanged) reclassified++
            if (r.value.labeled) relabeled++
          } else {
            errors++
            console.error('[ApplyRules] Error:', r.reason?.message ?? 'unknown')
          }
        }
      }

      // Mise à jour de la progression par batch
      await updateApplyJob(userId, {
        processed,
        reclassified,
        relabeled,
        errors,
      })
    }

    // Terminé
    await updateApplyJob(userId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      processed,
      reclassified,
      relabeled,
      errors,
    })

    console.log(`[ApplyRules] ✅ Completed: ${processed} processed, ${reclassified} reclassified, ${relabeled} relabeled, ${errors} errors`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inattendue'
    console.error('[ApplyRules] Job failed:', msg)
    await updateApplyJob(userId, {
      status: 'error',
      lastError: msg,
      completedAt: new Date().toISOString(),
    })
  }
}
