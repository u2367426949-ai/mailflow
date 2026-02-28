// ============================================================
// MailFlow — Route API : Tri complet de la boîte mail
// POST   /api/emails/sort-all — lance le tri massif
// GET    /api/emails/sort-all — récupère la progression
// DELETE /api/emails/sort-all — reset le job bloqué
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
// DELETE — Reset le job de tri (débloquer un tri coincé)
// ----------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const fullReset = searchParams.get('full') === 'true'

  if (fullReset) {
    // Reset complet : supprime tous les emails triés + reset le job
    await db.email.deleteMany({ where: { userId } })
    await updateSortJob(userId, { ...DEFAULT_JOB })
    return NextResponse.json({
      success: true,
      message: 'Compte réinitialisé : tous les emails triés ont été supprimés',
    })
  }

  // Reset simple : remet le job en idle
  await updateSortJob(userId, { ...DEFAULT_JOB })
  return NextResponse.json({
    success: true,
    message: 'Tri réinitialisé avec succès',
  })
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
// Traitement asynchrone du tri complet — VERSION OPTIMISÉE
// ----------------------------------------------------------
// Performances :
//   - Classification : 5 appels OpenAI en parallèle (au lieu de séquentiel)
//   - Labels Gmail : cache mémoire (1 appel par catégorie, pas par email)
//   - Labelling Gmail : 5 en parallèle
//   - Progression : mise à jour tous les BATCH_SIZE emails
// ----------------------------------------------------------

async function processSortJob(userId: string, customRules: string | null) {
  const CONCURRENCY = 5     // Appels OpenAI simultanés
  const BATCH_SIZE = 20     // Taille du batch pour la progression
  const MAX_EMAILS = 50000  // Limite Pro

  // Cache des label IDs Gmail (catégorie → labelId)
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
    // Phase 1 : Récupérer les emails Gmail
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

    // Phase 2 : Classifier + Labelliser en parallèle par batch
    let processed = 0
    let labeled = 0
    let errors = 0

    for (let i = 0; i < newEmails.length; i += BATCH_SIZE) {
      const batch = newEmails.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1

      // --- Étape A : Classifier N emails en parallèle (par slots de CONCURRENCY) ---
      interface ClassifiedEmail {
        gmailEmail: typeof batch[0]
        classification: Awaited<ReturnType<typeof classifyEmail>>
      }
      const classified: ClassifiedEmail[] = []

      for (let j = 0; j < batch.length; j += CONCURRENCY) {
        const slot = batch.slice(j, j + CONCURRENCY)
        const results = await Promise.allSettled(
          slot.map((gmailEmail) =>
            classifyEmail(
              {
                from: gmailEmail.from,
                to: gmailEmail.to,
                subject: gmailEmail.subject,
                snippet: gmailEmail.snippet,
              },
              customRules
            ).then((classification) => ({ gmailEmail, classification }))
          )
        )

        for (const r of results) {
          if (r.status === 'fulfilled') {
            classified.push(r.value)
          } else {
            errors++
            console.error('[SortAll] Classification error:', r.reason?.message ?? 'unknown')
          }
        }
      }

      // --- Étape B : Sauvegarder en DB (séquentiel car createMany ne retourne pas les IDs) ---
      const savedEmails: Array<{ dbId: string; gmailId: string; category: string; confidence: number }> = []

      for (const { gmailEmail, classification } of classified) {
        try {
          const saved = await db.email.create({
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
          savedEmails.push({
            dbId: saved.id,
            gmailId: gmailEmail.id,
            category: classification.category,
            confidence: classification.confidence,
          })
          processed++
        } catch (err) {
          errors++
          console.error('[SortAll] DB save error:', err instanceof Error ? err.message : 'unknown')
        }
      }

      // --- Étape C : Labelliser dans Gmail en parallèle (par slots de CONCURRENCY) ---
      const toLabel = savedEmails.filter(
        (e) => e.confidence >= 0.6 && e.category !== 'unknown'
      )

      for (let j = 0; j < toLabel.length; j += CONCURRENCY) {
        const slot = toLabel.slice(j, j + CONCURRENCY)
        const labelResults = await Promise.allSettled(
          slot.map(async (e) => {
            const labelId = await getCachedLabel(e.category)
            if (!labelId) return false
            await applyLabelToEmail(userId, e.gmailId, labelId)
            await db.email.update({
              where: { id: e.dbId },
              data: { isLabeled: true },
            })
            return true
          })
        )

        for (const r of labelResults) {
          if (r.status === 'fulfilled' && r.value) labeled++
        }
      }

      // --- Étape D : Mise à jour de la progression ---
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

    await db.user.update({
      where: { id: userId },
      data: { lastSyncAt: new Date() },
    })

    console.log(`[SortAll] ✅ Completed for user ${userId}: ${processed} processed, ${labeled} labeled, ${errors} errors`)
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
