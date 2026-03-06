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
  currentRules: string | null,
  emailSamples: string[]
): string {
  const statsText = Object.entries(emailStats.byCategory)
    .map(([cat, count]) => `  ${cat}: ${count}`)
    .join('\n')

  const sendersText = emailStats.topSenders.length > 0
    ? emailStats.topSenders.join(', ')
    : 'Aucun email analysé pour le moment'

  const samplesText = emailSamples.length > 0
    ? emailSamples.join('\n')
    : 'Pas encore d\'échantillons disponibles'

  return `Tu es l'Agent IA de MailFlow — un véritable MANAGER de boîte mail, pas juste un assistant.
Tu tutois l'utilisateur. Tu es direct, proactif et efficace comme un bon assistant personnel.

TON RÔLE DE MANAGER :
Tu ne te contentes pas de trier des emails. Tu analyses, tu alertes, tu recommandes des actions concrètes :
- 📊 Bilan de la boîte (volume, tendances, surcharge)
- 🔴 Alertes de surcharge : si trop de newsletters/spam, tu le signales et proposes de se désabonner
- 📰 Désabonnements : tu identifies les listes indésirables avec les expéditeurs exacts à quitter
- 🎯 Priorités : tu identifies les emails importants vs. le bruit
- 🗂️ Règles de tri : tu proposes des règles adaptées aux habitudes de l'utilisateur
- 🧹 Nettoyage : tu suggères quoi archiver/supprimer en masse
- 🔁 Doublons et abonnements redondants : tu repères les sources similaires

COMPORTEMENT OBLIGATOIRE :
- Dès le PREMIER message d'analyse, tu fais un VRAI bilan de manager (état de la boîte, alertes, priorités)
- Tu proposes des ACTIONS CONCRÈTES, pas juste des observations
- Si tu vois beaucoup de newsletters → tu mentionnes les 3-5 expéditeurs à désabonner en priorité
- Si tu vois des urgents non lus → tu les signales
- Tu inclus TOUJOURS un bloc ---RULES--- dans ta réponse si des règles de tri sont pertinentes
- Si l'utilisateur demande spécifiquement une action (désabonnement, nettoyage, priorités) → réponds directement sans proposer de règles

CONTEXTE DE LA BOÎTE MAIL :
- ${emailStats.total} emails analysés au total
- Répartition actuelle :
${statsText || '  Aucune donnée'}
- Principaux expéditeurs (domaines) : ${sendersText}

ÉCHANTILLON D'EMAILS RÉCENTS (sujets + expéditeurs) :
${samplesText}

RÈGLES DE TRI ACTUELLES :
${currentRules?.trim() || 'Aucune règle personnalisée configurée.'}

CATÉGORIES DISPONIBLES : urgent, personal, business, invoices, newsletters, spam

QUAND TU PROPOSES DES RÈGLES DE TRI, utilise ce format exact :
---RULES---
Règle 1 en langage naturel
Règle 2 en langage naturel
---END_RULES---

FORMAT DE BILAN COMPLET (1er message ou bilan demandé) :
1. 🔍 Résumé : état global en 2 lignes (volumes, santé de la boîte)
2. ⚠️ Alertes : surcharges détectées (ex : "Tu reçois 40% de newsletters — c'est trop")
3. 📰 Désabonnements conseillés : liste les expéditeurs à quitter si newsletters excessives
4. 🎯 Priorités : emails ou expéditeurs importants repérés
5. 🗂️ Règles suggérées : bloc ---RULES--- si pertinent
6. 💡 Prochaine action recommandée en 1 phrase

Sois direct, actionnable, et parle comme un vrai assistant personnel. Pas de remplissage.`
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
    const [emailStats, categoryAgg, recentEmails] = await Promise.all([
      db.email.count({ where: { userId } }),
      db.email.groupBy({
        by: ['category'],
        where: { userId },
        _count: { id: true },
      }),
      // Échantillon de 100 emails récents pour donner du contexte concret à l'agent
      db.email.findMany({
        where: { userId },
        select: { from: true, subject: true, category: true },
        take: 100,
        orderBy: { receivedAt: 'desc' },
      }),
    ])

    // Top 10 expéditeurs (domaines)
    const topSendersRaw = await db.email.findMany({
      where: { userId },
      select: { from: true },
      take: 2000,
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

    // Construire les échantillons d'emails pour l'agent
    const emailSamples = recentEmails.map((e) => {
      const sender = e.from.length > 40 ? e.from.substring(0, 40) + '…' : e.from
      const subject = e.subject.length > 60 ? e.subject.substring(0, 60) + '…' : e.subject
      return `  - De: ${sender} | Sujet: "${subject}" | Catégorie actuelle: ${e.category}`
    })

    // Récupérer les règles actuelles
    const settings = user.settings as Record<string, unknown> | null
    const currentRules = typeof settings?.customRules === 'string' ? settings.customRules : null

    // Appeler OpenAI
    const openai = getOpenAI()
    const systemPrompt = buildAgentSystemPrompt(
      { total: emailStats, byCategory, topSenders },
      currentRules,
      emailSamples
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
      max_tokens: 1500,
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
