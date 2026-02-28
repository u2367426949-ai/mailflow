// ============================================================
// MailFlow — Route API : Re-labelling des emails existants
// POST /api/emails/relabel — appliquer les labels Gmail
// aux emails déjà classés mais pas encore labellés
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { db } from '@/lib/db'
import { getOrCreateCategoryLabel, applyLabelToEmail } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)

async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('mailflow_session')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload.sub ?? null
  } catch {
    return null
  }
}

// ----------------------------------------------------------
// POST — Re-labeller les emails non labellés
// ----------------------------------------------------------
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Récupérer tous les emails traités mais pas labellés
    const unlabeledEmails = await db.email.findMany({
      where: {
        userId,
        isProcessed: true,
        isLabeled: false,
        category: { not: 'unknown' },
        confidence: { gte: 0.6 },
      },
      select: {
        id: true,
        gmailId: true,
        category: true,
        subject: true,
      },
    })

    console.log(`[Relabel] Found ${unlabeledEmails.length} unlabeled emails for user ${userId}`)

    let labeled = 0
    let errors = 0

    for (const email of unlabeledEmails) {
      try {
        const labelId = await getOrCreateCategoryLabel(userId, email.category)
        if (labelId) {
          await applyLabelToEmail(userId, email.gmailId, labelId)
          await db.email.update({
            where: { id: email.id },
            data: { isLabeled: true },
          })
          labeled++
        }
      } catch (err) {
        errors++
        const msg = err instanceof Error ? err.message : 'unknown'
        console.error(`[Relabel] Failed for email ${email.id}:`, msg)
      }

      // Petite pause pour respecter les rate limits Gmail
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return NextResponse.json({
      success: true,
      total: unlabeledEmails.length,
      labeled,
      errors,
    })
  } catch (err) {
    console.error('[Relabel] Error:', err)
    return NextResponse.json({ error: 'Relabel failed' }, { status: 500 })
  }
}
