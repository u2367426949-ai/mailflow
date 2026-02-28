// ============================================================
// MailFlow — Route API : Génération du digest quotidien
// POST /api/digest — déclenché par cron (chaque jour à 7h UTC)
// GET  /api/digest — récupérer les digests de l'utilisateur
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { generateDigestSummary } from '@/lib/openai'
import { startOfDay, endOfDay, subDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'digest@mailflow.ai'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

// ----------------------------------------------------------
// Utilitaire : extraire l'userId depuis le JWT cookie
// ----------------------------------------------------------
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

function isCronAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return authHeader === `Bearer ${cronSecret}`
}

// ----------------------------------------------------------
// Générer le HTML du digest
// ----------------------------------------------------------
function buildDigestHtml(data: {
  userName: string
  date: string
  summary: string
  urgentEmails: Array<{ subject: string; from: string; snippet: string; gmailId: string }>
  stats: { total: number; byCategory: Record<string, number>; accuracy: number }
  newsletters: Array<{ subject: string; from: string }>
}): string {
  const urgentHtml = data.urgentEmails
    .slice(0, 5)
    .map(
      (e) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #2a2a2a;">
          <div style="font-weight: 600; color: #f5f5f5;">${escapeHtml(e.subject)}</div>
          <div style="color: #a0a0a0; font-size: 14px;">${escapeHtml(e.from)}</div>
          <div style="color: #6a6a6a; font-size: 13px; margin-top: 4px;">${escapeHtml(e.snippet.slice(0, 100))}...</div>
        </td>
      </tr>`
    )
    .join('')

  const categoryEmojis: Record<string, string> = {
    urgent: '🔴',
    personal: '👤',
    business: '💼',
    invoices: '📄',
    newsletters: '📰',
    spam: '🗑️',
  }

  const statsHtml = Object.entries(data.stats.byCategory)
    .map(
      ([cat, count]) =>
        `<tr><td style="color: #a0a0a0; padding: 4px 0;">${categoryEmojis[cat] ?? '📧'} ${cat}</td><td style="color: #f5f5f5; text-align: right;">${count}</td></tr>`
    )
    .join('')

  const newslettersHtml = data.newsletters
    .slice(0, 5)
    .map(
      (n) =>
        `<li style="color: #a0a0a0; padding: 4px 0;">${escapeHtml(n.subject)} — <span style="color: #6a6a6a;">${escapeHtml(n.from)}</span></li>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Digest MailFlow</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: Inter, -apple-system, sans-serif; color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #3b82f6; margin: 0;">✉️ MailFlow</h1>
      <p style="color: #6a6a6a; font-size: 14px; margin-top: 8px;">Digest du ${data.date}</p>
    </div>

    <!-- Greeting -->
    <div style="margin-bottom: 32px;">
      <p style="font-size: 18px; color: #f5f5f5;">Bonjour ${escapeHtml(data.userName)} 👋</p>
      <p style="color: #a0a0a0; line-height: 1.6;">${escapeHtml(data.summary)}</p>
    </div>

    <!-- Urgent emails -->
    ${
      data.urgentEmails.length > 0
        ? `
    <div style="background: #141414; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h2 style="font-size: 16px; font-weight: 600; color: #dc2626; margin: 0 0 16px;">🔴 ${data.urgentEmails.length} email(s) urgent(s)</h2>
      <table style="width: 100%; border-collapse: collapse;">${urgentHtml}</table>
      <div style="margin-top: 16px;">
        <a href="${APP_URL}/dashboard" style="background: #dc2626; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">Voir dans Gmail →</a>
      </div>
    </div>`
        : ''
    }

    <!-- Stats -->
    <div style="background: #141414; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h2 style="font-size: 16px; font-weight: 600; color: #f5f5f5; margin: 0 0 16px;">📈 Stats d'hier</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #a0a0a0; padding: 4px 0;">📧 Total traités</td>
          <td style="color: #f5f5f5; text-align: right; font-weight: 600;">${data.stats.total}</td>
        </tr>
        <tr>
          <td style="color: #a0a0a0; padding: 4px 0;">🎯 Précision IA</td>
          <td style="color: #10b981; text-align: right; font-weight: 600;">${Math.round(data.stats.accuracy)}%</td>
        </tr>
        ${statsHtml}
      </table>
    </div>

    <!-- Newsletters -->
    ${
      data.newsletters.length > 0
        ? `
    <div style="background: #141414; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h2 style="font-size: 16px; font-weight: 600; color: #f5f5f5; margin: 0 0 16px;">📰 Newsletters (${data.newsletters.length})</h2>
      <ul style="list-style: none; padding: 0; margin: 0;">${newslettersHtml}</ul>
    </div>`
        : ''
    }

    <!-- CTA -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${APP_URL}/dashboard" style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Ouvrir le dashboard</a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #2a2a2a;">
      <p style="color: #6a6a6a; font-size: 13px; margin: 0;">MailFlow · Ta boîte mail, enfin sous contrôle.</p>
      <p style="color: #6a6a6a; font-size: 12px; margin-top: 8px;">
        <a href="${APP_URL}/dashboard?tab=settings" style="color: #3b82f6; text-decoration: none;">Modifier mes préférences</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ----------------------------------------------------------
// POST — Générer et envoyer les digests (cron job)
// ----------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const yesterday = subDays(today, 1)
  const dayStart = startOfDay(yesterday)
  const dayEnd = endOfDay(yesterday)

  const results: Array<{
    userId: string
    email: string
    status: 'sent' | 'skipped' | 'error'
    reason?: string
  }> = []

  try {
    // Récupérer les utilisateurs avec digest activé
    const users = await db.user.findMany({
      where: {
        digestEnabled: true,
        plan: { not: 'free' },
        isOnboarded: true,
        googleRefreshToken: { not: null },
      },
      select: {
        id: true,
        email: true,
        name: true,
        digestTime: true,
        timezone: true,
      },
    })

    for (const user of users) {
      try {
        // Vérifier si le digest a déjà été envoyé pour aujourd'hui
        const existingDigest = await db.digest.findFirst({
          where: {
            userId: user.id,
            date: dayStart,
          },
        })

        if (existingDigest?.sentAt) {
          results.push({ userId: user.id, email: user.email, status: 'skipped', reason: 'Already sent' })
          continue
        }

        // Récupérer les emails d'hier
        const emails = await db.email.findMany({
          where: {
            userId: user.id,
            receivedAt: { gte: dayStart, lte: dayEnd },
            isProcessed: true,
          },
          select: {
            id: true,
            from: true,
            subject: true,
            snippet: true,
            category: true,
            gmailId: true,
            receivedAt: true,
          },
          orderBy: { receivedAt: 'desc' },
        })

        if (emails.length === 0) {
          results.push({ userId: user.id, email: user.email, status: 'skipped', reason: 'No emails' })
          continue
        }

        // Calculer les stats
        const byCategory: Record<string, number> = {}
        for (const e of emails) {
          byCategory[e.category] = (byCategory[e.category] ?? 0) + 1
        }

        // Feedbacks pour la précision
        const feedbackCount = await db.emailFeedback.count({
          where: {
            userId: user.id,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        })
        const accuracy = emails.length > 0
          ? Math.max(0, ((emails.length - feedbackCount) / emails.length) * 100)
          : 100

        const urgentEmails = emails.filter((e) => e.category === 'urgent').slice(0, 5)
        const newsletters = emails.filter((e) => e.category === 'newsletters').slice(0, 5)

        // Générer le résumé IA
        const summary = await generateDigestSummary({
          urgentEmails: urgentEmails.map((e) => ({
            from: e.from,
            subject: e.subject,
            snippet: e.snippet,
          })),
          stats: { total: emails.length, byCategory, accuracy: accuracy / 100 },
          userName: user.name ?? user.email.split('@')[0],
        })

        // Construire et envoyer l'email
        const dateFormatted = format(yesterday, "EEEE d MMMM yyyy", { locale: fr })
        const firstName = user.name?.split(' ')[0] ?? user.email.split('@')[0]

        const html = buildDigestHtml({
          userName: firstName,
          date: dateFormatted,
          summary,
          urgentEmails: urgentEmails.map((e) => ({
            subject: e.subject,
            from: e.from,
            snippet: e.snippet,
            gmailId: e.gmailId,
          })),
          stats: { total: emails.length, byCategory, accuracy },
          newsletters: newsletters.map((e) => ({ subject: e.subject, from: e.from })),
        })

        const { error: sendError } = await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email,
          subject: `📬 Ton digest MailFlow du ${dateFormatted}`,
          html,
        })

        if (sendError) {
          throw new Error(`Resend error: ${sendError.message}`)
        }

        // Enregistrer le digest
        await db.digest.upsert({
          where: {
            userId_date: {
              userId: user.id,
              date: dayStart,
            },
          },
          update: { sentAt: new Date() },
          create: {
            userId: user.id,
            date: dayStart,
            stats: { total: emails.length, byCategory, accuracy },
            topEmails: urgentEmails.map((e) => ({
              id: e.id,
              subject: e.subject,
              from: e.from,
            })),
            sentAt: new Date(),
          },
        })

        results.push({ userId: user.id, email: user.email, status: 'sent' })
      } catch (err) {
        console.error(`[Digest] Error for user ${user.id}:`, err)
        results.push({ userId: user.id, email: user.email, status: 'error', reason: String(err) })
      }
    }

    const sent = results.filter((r) => r.status === 'sent').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    const errors = results.filter((r) => r.status === 'error').length

    return NextResponse.json({ success: true, sent, skipped, errors, results })
  } catch (err) {
    console.error('[Digest] Fatal error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ----------------------------------------------------------
// GET — Récupérer les digests de l'utilisateur connecté
// ----------------------------------------------------------
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  try {
    const [digests, total] = await Promise.all([
      db.digest.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.digest.count({ where: { userId } }),
    ])

    return NextResponse.json({ digests, total, pagination: { limit, offset } })
  } catch (err) {
    console.error('[Digest] Error fetching digests:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
