// ============================================================
// MailFlow — Route API : Feedback utilisateur sur le tri
// POST /api/emails/feedback
// GET  /api/emails/feedback — liste des feedbacks
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { z } from 'zod'
import { db } from '@/lib/db'
import { rateLimit, RATE_LIMIT_CONFIGS, getClientIpFromHeaders } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)

// ----------------------------------------------------------
// Schémas Zod pour la validation des inputs (QA Fix #4)
// ----------------------------------------------------------
const VALID_CATEGORIES = [
  'urgent',
  'personal',
  'business',
  'invoices',
  'newsletters',
  'spam',
] as const

const PostFeedbackSchema = z.object({
  emailId: z
    .string({ required_error: 'emailId is required' })
    .uuid({ message: 'emailId must be a valid UUID' }),
  correctedCategory: z.enum(VALID_CATEGORIES, {
    errorMap: () => ({
      message: `correctedCategory must be one of: ${VALID_CATEGORIES.join(', ')}`,
    }),
  }),
  comment: z
    .string()
    .max(500, 'Comment must be at most 500 characters')
    .trim()
    .optional()
    .nullable(),
})

const GetFeedbackQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(parseInt(v ?? '20', 10) || 20, 100)),
  offset: z
    .string()
    .optional()
    .transform((v) => Math.max(parseInt(v ?? '0', 10) || 0, 0)),
})

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

// ----------------------------------------------------------
// POST — Soumettre un feedback de classification
// Body: { emailId, correctedCategory, comment? }
// ----------------------------------------------------------
export async function POST(request: NextRequest) {
  // Rate limiting (QA Fix #3 — protection anti-spam du feedback)
  const ip = getClientIpFromHeaders(request.headers)
  const rl = await rateLimit(ip, RATE_LIMIT_CONFIGS.feedback)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too Many Requests', retryAfter: Math.ceil(rl.retryAfterMs / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parser le body JSON
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Valider avec Zod (QA Fix #4 — validation UUID + catégorie)
  const parsed = PostFeedbackSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation error',
        details: parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
      { status: 400 }
    )
  }

  const { emailId, correctedCategory, comment } = parsed.data

  try {
    // Vérifier que l'email appartient à l'utilisateur
    const email = await db.email.findFirst({
      where: { id: emailId, userId },
      select: { id: true, category: true, userId: true },
    })

    if (!email) {
      return NextResponse.json(
        { error: 'Email not found or not accessible' },
        { status: 404 }
      )
    }

    // Ne pas créer de feedback si la catégorie est déjà correcte
    if (email.category === correctedCategory) {
      return NextResponse.json(
        { message: 'Email already classified correctly', noChange: true },
        { status: 200 }
      )
    }

    // Créer le feedback
    const feedback = await db.emailFeedback.create({
      data: {
        userId,
        emailId,
        originalCategory: email.category,
        correctedCategory,
        comment: comment?.trim() || null,
      },
    })

    // Mettre à jour la catégorie de l'email
    await db.email.update({
      where: { id: emailId },
      data: { category: correctedCategory },
    })

    return NextResponse.json({
      success: true,
      feedback: {
        id: feedback.id,
        originalCategory: feedback.originalCategory,
        correctedCategory: feedback.correctedCategory,
        createdAt: feedback.createdAt,
      },
    })
  } catch (err) {
    console.error('[Feedback] Error creating feedback:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ----------------------------------------------------------
// GET — Récupérer les feedbacks de l'utilisateur
// Query: ?limit=20&offset=0
// ----------------------------------------------------------
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  // Valider les query params
  const queryParsed = GetFeedbackQuerySchema.safeParse({
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  })

  const { limit, offset } = queryParsed.success
    ? queryParsed.data
    : { limit: 20, offset: 0 }

  try {
    const [feedbacks, total] = await Promise.all([
      db.emailFeedback.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          email: {
            select: {
              subject: true,
              from: true,
              receivedAt: true,
            },
          },
        },
      }),
      db.emailFeedback.count({ where: { userId } }),
    ])

    // Calculer les stats de précision
    const totalEmails = await db.email.count({ where: { userId, isProcessed: true } })
    const accuracy =
      totalEmails > 0
        ? ((totalEmails - total) / totalEmails) * 100
        : 100

    return NextResponse.json({
      feedbacks,
      total,
      pagination: { limit, offset },
      stats: {
        totalFeedbacks: total,
        totalEmails,
        accuracy: Math.round(accuracy * 10) / 10,
      },
    })
  } catch (err) {
    console.error('[Feedback] Error fetching feedbacks:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
