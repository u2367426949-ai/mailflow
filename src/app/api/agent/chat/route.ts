// ============================================================
// MailFlow — Route API : Agent IA conversationnel
// POST /api/agent/chat — conversation avec l'agent pour
// personnaliser les règles de tri
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import OpenAI from 'openai'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ----------------------------------------------------------
// Schéma de validation
// ----------------------------------------------------------
const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(2000),
  })).min(1).max(50),
})

// ----------------------------------------------------------
// Client OpenAI
// ----------------------------------------------------------
let openaiClient: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return openaiClient
}

// ----------------------------------------------------------
// Prompt système de l'agent
// ----------------------------------------------------------
function buildAgentSystemPrompt(
  emailStats: { total: number; byCategory: Record<string, number>; topSenders: string[] },
  currentRules: string | null
): string {
  const statsText = Object.entries(emailStats.byCategory)
    .map(([cat, count]) => `  ${cat}: ${count}`)
    .join('\n')

  const sendersText = emailStats.topSenders.length > 0
    ? emailStats.topSenders.join(', ')
    : 'Aucun email analysé pour le moment'

  return `Tu es l'agent IA de MailFlow, un assistant de tri email intelligent et amical.
Tu tutois l'utilisateur. Tu es concis et efficace.

TON OBJECTIF : aider l'utilisateur à configurer des règles de tri email personnalisées en conversant avec lui.
Tu dois comprendre ses habitudes, poser des questions pertinentes, et proposer des règles claires.

CONTEXTE DE LA BOÎTE MAIL :
- ${emailStats.total} emails analysés au total
- Répartition :
${statsText}
- Principaux expéditeurs : ${sendersText}

RÈGLES ACTUELLES (si elles existent) :
${currentRules?.trim() || 'Aucune règle personnalisée configurée.'}

CATÉGORIES DISPONIBLES : urgent, personal, business, invoices, newsletters, spam

INSTRUCTIONS :
1. Commence TOUJOURS par analyser le contexte (stats de la boîte) pour donner des recommandations pertinentes
2. Pose des questions concrètes : "Qui est ton manager ?", "Quel est le domaine de ton entreprise ?", "Quels expéditeurs sont importants ?"
3. Après chaque réponse de l'utilisateur, propose des règles concrètes
4. Si l'utilisateur valide, génère un bloc de règles finales

QUAND TU PROPOSES DES RÈGLES, utilise toujours ce format exact en fin de message :
---RULES---
Règle 1 en langage naturel
Règle 2 en langage naturel
---END_RULES---

Ce bloc sera automatiquement extrait et proposé à l'utilisateur pour application.
Si tu n'as pas encore de règles à proposer, ne mets pas de bloc ---RULES---.

Sois naturel, amical, et utile. Pas de formalités. Droit au but.`
}

// ----------------------------------------------------------
// POST — Envoyer un message à l'agent
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

  // Valider le body
  let body: z.infer<typeof chatSchema>
  try {
    const raw = await request.json()
    const result = chatSchema.safeParse(raw)
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 })
    }
    body = result.data
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    // Récupérer les stats de la boîte pour le contexte
    const [emailStats, categoryAgg] = await Promise.all([
      db.email.count({ where: { userId } }),
      db.email.groupBy({
        by: ['category'],
        where: { userId },
        _count: { id: true },
      }),
    ])

    // Top 10 expéditeurs (domaines)
    const topSendersRaw = await db.email.findMany({
      where: { userId },
      select: { from: true },
      take: 500,
      orderBy: { receivedAt: 'desc' },
    })

    const domainCounts: Record<string, number> = {}
    for (const e of topSendersRaw) {
      const domain = e.from.replace(/.*@/, '@').toLowerCase()
      domainCounts[domain] = (domainCounts[domain] ?? 0) + 1
    }
    const topSenders = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => `${domain} (${count})`)

    const byCategory: Record<string, number> = {}
    for (const item of categoryAgg) {
      byCategory[item.category] = item._count.id
    }

    // Récupérer les règles actuelles
    const settings = user.settings as Record<string, unknown> | null
    const currentRules = typeof settings?.customRules === 'string' ? settings.customRules : null

    // Appeler OpenAI
    const openai = getOpenAI()
    const systemPrompt = buildAgentSystemPrompt(
      { total: emailStats, byCategory, topSenders },
      currentRules
    )

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...body.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      temperature: 0.7,
      max_tokens: 600,
    })

    const reply = completion.choices[0]?.message?.content ?? 'Désolé, je n\'ai pas pu répondre.'

    // Extraire les règles si présentes
    const rulesMatch = reply.match(/---RULES---\n([\s\S]*?)\n---END_RULES---/)
    const extractedRules = rulesMatch ? rulesMatch[1].trim() : null

    return NextResponse.json({
      reply: reply.replace(/---RULES---\n[\s\S]*?\n---END_RULES---/, '').trim(),
      extractedRules,
    })
  } catch (err) {
    console.error('[Agent] Chat error:', err)
    return NextResponse.json({ error: 'Agent error' }, { status: 500 })
  }
}

// ----------------------------------------------------------
// PUT — Appliquer les règles extraites par l'agent
// ----------------------------------------------------------
export async function PUT(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let rules: string
  try {
    const raw = await request.json()
    rules = z.string().max(4000).parse(raw.rules)
  } catch {
    return NextResponse.json({ error: 'Invalid rules' }, { status: 400 })
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    })
    const settings = (user?.settings as Record<string, unknown>) ?? {}

    await db.user.update({
      where: { id: userId },
      data: {
        settings: {
          ...settings,
          customRules: rules,
        } as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Agent] Save rules error:', err)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }
}
