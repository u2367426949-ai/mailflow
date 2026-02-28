// ============================================================
// MailFlow — Route API : Liste des emails
// GET /api/emails — liste paginée avec filtres
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { db } from '@/lib/db'
import { subDays } from 'date-fns'

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
// GET — Liste des emails
// Query: ?limit=50&offset=0&category=urgent&type=stats
// ----------------------------------------------------------
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  // --- Stats ---
  if (type === 'stats') {
    try {
      const [
        totalProcessed,
        byCategory,
        urgentCount,
        feedbackCount,
        todayCount,
      ] = await Promise.all([
        db.email.count({ where: { userId, isProcessed: true } }),
        db.email.groupBy({
          by: ['category'],
          where: { userId, isProcessed: true },
          _count: { category: true },
        }),
        db.email.count({ where: { userId, category: 'urgent', isProcessed: true } }),
        db.emailFeedback.count({ where: { userId } }),
        db.email.count({
          where: {
            userId,
            isProcessed: true,
            receivedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
      ])

      const byCategoryMap: Record<string, number> = {}
      for (const row of byCategory) {
        byCategoryMap[row.category] = row._count.category
      }

      // Précision estimée
      const accuracy =
        totalProcessed > 0
          ? Math.round(((totalProcessed - feedbackCount) / totalProcessed) * 100)
          : 100

      // Temps gagné estimé : 2 min/email
      const timeSavedMinutes = totalProcessed * 2

      return NextResponse.json({
        stats: {
          totalProcessed,
          accuracy,
          urgentCount,
          timeSavedMinutes,
          byCategory: byCategoryMap,
          todayCount,
          feedbackCount,
        },
      })
    } catch (err) {
      console.error('[Emails] Stats error:', err)
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }
  }

  // --- Liste ---
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const category = searchParams.get('category')
  const fromDate = searchParams.get('fromDate')

  try {
    const where: any = { userId }

    if (category && category !== 'all') {
      where.category = category
    }

    if (fromDate) {
      where.receivedAt = { gte: new Date(fromDate) }
    }

    const [emails, total] = await Promise.all([
      db.email.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          gmailId: true,
          from: true,
          subject: true,
          snippet: true,
          receivedAt: true,
          category: true,
          confidence: true,
          isRead: true,
          isLabeled: true,
          aiReason: true,
        },
      }),
      db.email.count({ where }),
    ])

    return NextResponse.json({ emails, total, pagination: { limit, offset } })
  } catch (err) {
    console.error('[Emails] List error:', err)
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
  }
}
