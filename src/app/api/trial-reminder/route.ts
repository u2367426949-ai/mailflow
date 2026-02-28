// ============================================================
// MailFlow — Route API : Rappels de fin de trial
// POST /api/trial-reminder
// Déclenché par cron Vercel tous les jours à 9h UTC
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTrialReminderEmail } from '@/lib/emails'
import { addDays, startOfDay, endOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

function isCronAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[TrialReminder] CRON_SECRET is not set in production — denying access')
      return false
    }
    return true
  }
  return authHeader === `Bearer ${cronSecret}`
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  let reminded3 = 0
  let reminded1 = 0
  let errors = 0

  try {
    // Trouver les utilisateurs dont le trial se termine dans 3 jours
    const in3DaysStart = startOfDay(addDays(now, 3))
    const in3DaysEnd = endOfDay(addDays(now, 3))

    const usersExpiring3 = await db.user.findMany({
      where: {
        plan: 'free',
        trialEndsAt: {
          gte: in3DaysStart,
          lte: in3DaysEnd,
        },
      },
      select: { id: true, email: true, name: true },
    })

    // Trouver les utilisateurs dont le trial se termine dans 1 jour
    const in1DayStart = startOfDay(addDays(now, 1))
    const in1DayEnd = endOfDay(addDays(now, 1))

    const usersExpiring1 = await db.user.findMany({
      where: {
        plan: 'free',
        trialEndsAt: {
          gte: in1DayStart,
          lte: in1DayEnd,
        },
      },
      select: { id: true, email: true, name: true },
    })

    // Envoyer les rappels J-3
    await Promise.allSettled(
      usersExpiring3.map(async (user) => {
        try {
          await sendTrialReminderEmail({ email: user.email, name: user.name }, 3)
          reminded3++
        } catch (err) {
          console.error(`[TrialReminder] J-3 failed for ${user.email}:`, err)
          errors++
        }
      })
    )

    // Envoyer les rappels J-1
    await Promise.allSettled(
      usersExpiring1.map(async (user) => {
        try {
          await sendTrialReminderEmail({ email: user.email, name: user.name }, 1)
          reminded1++
        } catch (err) {
          console.error(`[TrialReminder] J-1 failed for ${user.email}:`, err)
          errors++
        }
      })
    )

    console.log(`[TrialReminder] Done — J-3: ${reminded3}, J-1: ${reminded1}, errors: ${errors}`)

    return NextResponse.json({
      success: true,
      reminded3,
      reminded1,
      errors,
    })
  } catch (err) {
    console.error('[TrialReminder] Fatal error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
