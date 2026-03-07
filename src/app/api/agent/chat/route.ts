// ============================================================
// MailFlow — Route API : Agent IA Gmail
// POST /api/agent/chat — Agent conversationnel avec function
// calling : peut rechercher, déplacer, labelliser, supprimer
// des emails, créer des labels, etc.
// PUT  /api/agent/chat — Sauvegarder les règles de tri
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth'
import {
  getGmailMessagesTotal,
  searchGmailMessages,
  listGmailLabels,
  createGmailLabel,
  batchModifyGmailMessages,
  trashGmailMessages,
  getGmailMessageBody,
} from '@/lib/gmail'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel : 60s pour les appels multi-tour

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
// Définitions des tools OpenAI (function calling)
// ----------------------------------------------------------
const agentTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_emails',
      description: 'Recherche des emails dans la boîte Gmail avec une requête. Syntaxe Gmail : from:, to:, subject:, is:unread, older_than:, newer_than:, has:attachment, label:, etc. Retourne les IDs, expéditeurs, sujets et snippets. TOUJOURS utiliser cette fonction avant de déplacer/supprimer des emails pour obtenir leurs IDs.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Requête de recherche Gmail (ex: "from:amazon.fr", "subject:facture is:unread", "older_than:30d from:newsletter@")' },
          maxResults: { type: 'number', description: 'Nombre max de résultats (défaut: 20, max: 50)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_email',
      description: 'Lire le contenu complet d\'un email (corps, sujet, expéditeur). Utile pour comprendre le contenu d\'un email spécifique avant de le trier.',
      parameters: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'ID du message Gmail à lire' },
        },
        required: ['messageId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_labels',
      description: 'Lister tous les labels Gmail disponibles dans la boîte mail. Retourne les IDs et noms des labels. Utilise cette fonction pour connaître les labels existants avant d\'en appliquer un.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_label',
      description: 'Créer un nouveau label Gmail personnalisé. Utilise cette fonction quand l\'utilisateur demande de créer un label qui n\'existe pas encore (ex: "Voiture", "Projets/Client X").',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom du label (ex: "Voiture", "Projets/Design", "Achats en ligne")' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_emails',
      description: 'Déplacer des emails en ajoutant/retirant des labels Gmail. Utilise search_emails d\'abord pour obtenir les IDs. Exemples : déplacer vers un label personnalisé, archiver (retirer INBOX), remettre en inbox.',
      parameters: {
        type: 'object',
        properties: {
          emailIds: { type: 'array', items: { type: 'string' }, description: 'Liste des IDs Gmail des messages à déplacer (max 100)' },
          addLabelIds: { type: 'array', items: { type: 'string' }, description: 'Labels à ajouter (IDs Gmail)' },
          removeLabelIds: { type: 'array', items: { type: 'string' }, description: 'Labels à retirer (ex: ["INBOX"] pour archiver)' },
        },
        required: ['emailIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_label',
      description: 'Appliquer un label Gmail à un ou plusieurs emails sans les retirer de l\'inbox. Utilise search_emails d\'abord pour obtenir les IDs.',
      parameters: {
        type: 'object',
        properties: {
          emailIds: { type: 'array', items: { type: 'string' }, description: 'Liste des IDs Gmail (max 100)' },
          labelId: { type: 'string', description: 'ID du label Gmail à appliquer' },
        },
        required: ['emailIds', 'labelId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_label',
      description: 'Retirer un label Gmail d\'un ou plusieurs emails.',
      parameters: {
        type: 'object',
        properties: {
          emailIds: { type: 'array', items: { type: 'string' }, description: 'Liste des IDs Gmail (max 100)' },
          labelId: { type: 'string', description: 'ID du label Gmail à retirer' },
        },
        required: ['emailIds', 'labelId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trash_emails',
      description: 'Mettre des emails à la corbeille. ATTENTION : demande TOUJOURS confirmation à l\'utilisateur avant de supprimer des emails. Ne supprime jamais sans accord explicite.',
      parameters: {
        type: 'object',
        properties: {
          emailIds: { type: 'array', items: { type: 'string' }, description: 'Liste des IDs Gmail à mettre à la corbeille (max 50)' },
        },
        required: ['emailIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'archive_emails',
      description: 'Archiver des emails (les retirer de l\'inbox sans les supprimer). Les emails restent accessibles via la recherche Gmail.',
      parameters: {
        type: 'object',
        properties: {
          emailIds: { type: 'array', items: { type: 'string' }, description: 'Liste des IDs Gmail à archiver (max 100)' },
        },
        required: ['emailIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_as_read',
      description: 'Marquer des emails comme lus.',
      parameters: {
        type: 'object',
        properties: {
          emailIds: { type: 'array', items: { type: 'string' }, description: 'Liste des IDs Gmail (max 100)' },
        },
        required: ['emailIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_as_unread',
      description: 'Marquer des emails comme non lus.',
      parameters: {
        type: 'object',
        properties: {
          emailIds: { type: 'array', items: { type: 'string' }, description: 'Liste des IDs Gmail (max 100)' },
        },
        required: ['emailIds'],
      },
    },
  },
]

// ----------------------------------------------------------
// Exécuteur de tools
// ----------------------------------------------------------
interface AgentAction {
  tool: string
  args: Record<string, unknown>
  result: Record<string, unknown>
}

async function executeTool(
  userId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case 'search_emails': {
        const query = String(args.query ?? '')
        const maxResults = Math.min(Number(args.maxResults) || 20, 50)
        const results = await searchGmailMessages(userId, query, maxResults)
        return JSON.stringify({ found: results.length, emails: results })
      }

      case 'read_email': {
        const messageId = String(args.messageId ?? '')
        if (!messageId) return JSON.stringify({ error: 'messageId requis' })
        const email = await getGmailMessageBody(userId, messageId)
        return JSON.stringify(email)
      }

      case 'list_labels': {
        const labels = await listGmailLabels(userId)
        return JSON.stringify({ labels })
      }

      case 'create_label': {
        const name = String(args.name ?? '').trim()
        if (!name || name.length > 100) return JSON.stringify({ error: 'Nom de label invalide' })
        const label = await createGmailLabel(userId, name)
        return JSON.stringify({ created: true, labelId: label.id, name: label.name })
      }

      case 'move_emails': {
        const emailIds = (args.emailIds as string[] ?? []).slice(0, 100)
        const addLabelIds = (args.addLabelIds as string[]) ?? []
        const removeLabelIds = (args.removeLabelIds as string[]) ?? []
        if (emailIds.length === 0) return JSON.stringify({ error: 'Aucun email spécifié' })
        const result = await batchModifyGmailMessages(userId, emailIds, addLabelIds, removeLabelIds)
        return JSON.stringify({ moved: result.modified })
      }

      case 'apply_label': {
        const emailIds = (args.emailIds as string[] ?? []).slice(0, 100)
        const labelId = String(args.labelId ?? '')
        if (emailIds.length === 0 || !labelId) return JSON.stringify({ error: 'emailIds et labelId requis' })
        const result = await batchModifyGmailMessages(userId, emailIds, [labelId])
        return JSON.stringify({ labeled: result.modified })
      }

      case 'remove_label': {
        const emailIds = (args.emailIds as string[] ?? []).slice(0, 100)
        const labelId = String(args.labelId ?? '')
        if (emailIds.length === 0 || !labelId) return JSON.stringify({ error: 'emailIds et labelId requis' })
        const result = await batchModifyGmailMessages(userId, emailIds, [], [labelId])
        return JSON.stringify({ unlabeled: result.modified })
      }

      case 'trash_emails': {
        const emailIds = (args.emailIds as string[] ?? []).slice(0, 50)
        if (emailIds.length === 0) return JSON.stringify({ error: 'Aucun email spécifié' })
        const result = await trashGmailMessages(userId, emailIds)
        return JSON.stringify(result)
      }

      case 'archive_emails': {
        const emailIds = (args.emailIds as string[] ?? []).slice(0, 100)
        if (emailIds.length === 0) return JSON.stringify({ error: 'Aucun email spécifié' })
        const result = await batchModifyGmailMessages(userId, emailIds, [], ['INBOX'])
        return JSON.stringify({ archived: result.modified })
      }

      case 'mark_as_read': {
        const emailIds = (args.emailIds as string[] ?? []).slice(0, 100)
        if (emailIds.length === 0) return JSON.stringify({ error: 'Aucun email spécifié' })
        const result = await batchModifyGmailMessages(userId, emailIds, [], ['UNREAD'])
        return JSON.stringify({ markedRead: result.modified })
      }

      case 'mark_as_unread': {
        const emailIds = (args.emailIds as string[] ?? []).slice(0, 100)
        if (emailIds.length === 0) return JSON.stringify({ error: 'Aucun email spécifié' })
        const result = await batchModifyGmailMessages(userId, emailIds, ['UNREAD'])
        return JSON.stringify({ markedUnread: result.modified })
      }

      default:
        return JSON.stringify({ error: `Outil inconnu : ${toolName}` })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Agent] Tool ${toolName} error:`, message)
    return JSON.stringify({ error: `Erreur lors de l'exécution : ${message}` })
  }
}

// ----------------------------------------------------------
// Prompt système de l'agent
// ----------------------------------------------------------
function buildAgentSystemPrompt(
  emailStats: { total: number; byCategory: Record<string, number>; topSenders: string[] },
  currentRules: string | null,
  emailSamples: string[],
  labelsContext: string
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

  return `Tu es l'Agent IA de MailFlow — un véritable ASSISTANT GMAIL intelligent et capable d'AGIR.
Tu tutois l'utilisateur. Tu es direct, proactif et efficace comme un vrai assistant personnel.

🔧 TES CAPACITÉS (TOOLS DISPONIBLES) :
Tu peux exécuter des ACTIONS RÉELLES sur la boîte Gmail de l'utilisateur :
- 🔍 **Rechercher** des emails (search_emails) — syntaxe Gmail : from:, subject:, is:unread, older_than:, etc.
- 📖 **Lire** le contenu d'un email (read_email) — pour comprendre un email spécifique
- 📋 **Lister les labels** (list_labels) — voir tous les labels Gmail existants
- 🏷️ **Créer un label** (create_label) — créer un nouveau label personnalisé
- 📁 **Déplacer des emails** (move_emails) — ajouter/retirer des labels, déplacer vers des dossiers
- 🏷️ **Appliquer un label** (apply_label) — taguer des emails avec un label
- ❌ **Retirer un label** (remove_label) — retirer un label d'emails
- 🗑️ **Supprimer** (trash_emails) — mettre à la corbeille (TOUJOURS demander confirmation avant !)
- 📦 **Archiver** (archive_emails) — retirer de l'inbox sans supprimer
- 👁️ **Marquer lu/non-lu** (mark_as_read / mark_as_unread)

⚡ WORKFLOW OBLIGATOIRE POUR LES ACTIONS :
1. TOUJOURS utiliser search_emails AVANT de déplacer/labelliser/supprimer pour obtenir les IDs des messages
2. TOUJOURS utiliser list_labels AVANT d'appliquer un label pour vérifier qu'il existe (sinon le créer avec create_label)
3. Pour les suppressions : TOUJOURS demander confirmation textuelle à l'utilisateur AVANT d'appeler trash_emails
4. Après une action, résume ce que tu as fait de manière claire et concise

🚫 RÈGLES DE SÉCURITÉ :
- Ne JAMAIS supprimer (trash) sans confirmation explicite de l'utilisateur
- Limiter les opérations batch à des lots raisonnables
- En cas d'erreur d'un tool, explique clairement le problème à l'utilisateur

TON RÔLE DE MANAGER :
En plus des actions Gmail, tu analyses et conseilles :
- 📊 Bilan de la boîte (volume, tendances, surcharge)
- 🔴 Alertes de surcharge : si trop de newsletters/spam
- 📰 Désabonnements : identifier les listes indésirables
- 🎯 Priorités : emails importants vs. bruit
- 🗂️ Règles de tri : proposer des règles adaptées
- 🧹 Nettoyage : suggérer quoi archiver/supprimer

CONTEXTE DE LA BOÎTE MAIL :
- ${emailStats.total} emails analysés au total
- Répartition actuelle :
${statsText || '  Aucune donnée'}
- Principaux expéditeurs (domaines) : ${sendersText}

LABELS GMAIL EXISTANTS :
${labelsContext || 'Aucun label récupéré'}

ÉCHANTILLON D'EMAILS RÉCENTS :
${samplesText}

RÈGLES DE TRI ACTUELLES :
${currentRules?.trim() || 'Aucune règle personnalisée configurée.'}

CATÉGORIES MAILFLOW : urgent, personal, business, invoices, newsletters, spam

QUAND TU PROPOSES DES RÈGLES DE TRI AUTOMATIQUE, utilise ce format :
---RULES---
Règle 1 en langage naturel
Règle 2 en langage naturel
---END_RULES---

FORMAT DE BILAN (1er message ou bilan demandé) :
1. 🔍 Résumé : état global en 2 lignes
2. ⚠️ Alertes : surcharges détectées
3. 📰 Désabonnements conseillés
4. 🎯 Priorités identifiées
5. 🗂️ Règles suggérées si pertinent (bloc ---RULES---)
6. 💡 Prochaine action recommandée

Sois direct, actionnable. Quand l'utilisateur demande une action concrète (déplacer, labelliser, supprimer, créer un label), EXÉCUTE-LA immédiatement avec les tools.`
}

// ----------------------------------------------------------
// POST — Envoyer un message à l'agent (avec function calling)
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
    // ── Récupérer le contexte ──────────────────────────────
    const [gmailTotal, categoryAgg, recentEmails, gmailLabels] = await Promise.all([
      getGmailMessagesTotal(userId).catch(() => db.email.count({ where: { userId } })),
      db.email.groupBy({
        by: ['category'],
        where: { userId },
        _count: { id: true },
      }),
      db.email.findMany({
        where: { userId },
        select: { from: true, subject: true, category: true },
        take: 30,
        orderBy: { receivedAt: 'desc' },
      }),
      listGmailLabels(userId).catch(() => []),
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

    const emailSamples = recentEmails.map((e) => {
      const sender = e.from.length > 40 ? e.from.substring(0, 40) + '…' : e.from
      const subject = e.subject.length > 60 ? e.subject.substring(0, 60) + '…' : e.subject
      return `  - De: ${sender} | Sujet: "${subject}" | Catégorie: ${e.category}`
    })

    // Labels Gmail pour le contexte
    const labelsContext = gmailLabels
      .filter((l) => l.type !== 'system' || ['INBOX', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT'].includes(l.id))
      .map((l) => `  - ${l.name} (id: ${l.id})`)
      .join('\n')

    const settings = user.settings as Record<string, unknown> | null
    const currentRules = typeof settings?.customRules === 'string' ? settings.customRules : null

    // ── Construire la conversation pour OpenAI ─────────────
    const openai = getOpenAI()
    const systemPrompt = buildAgentSystemPrompt(
      { total: gmailTotal, byCategory, topSenders },
      currentRules,
      emailSamples,
      labelsContext
    )

    const conversationMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...body.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    // ── Boucle de function calling ─────────────────────────
    const executedActions: AgentAction[] = []
    const MAX_TURNS = 8

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: conversationMessages,
        tools: agentTools,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 2000,
      })

      const choice = completion.choices[0]
      if (!choice) break

      const assistantMsg = choice.message
      // Ajouter le message de l'assistant à la conversation
      conversationMessages.push(assistantMsg)

      // Si pas de tool calls → on a la réponse finale
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        break
      }

      // Exécuter chaque tool call
      for (const toolCall of assistantMsg.tool_calls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(toolCall.function.arguments)
        } catch {
          args = {}
        }

        console.log(`[Agent] Tool call: ${toolCall.function.name}`, JSON.stringify(args).substring(0, 200))
        const result = await executeTool(userId, toolCall.function.name, args)

        executedActions.push({
          tool: toolCall.function.name,
          args,
          result: JSON.parse(result),
        })

        // Ajouter le résultat du tool à la conversation
        conversationMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        })
      }
    }

    // ── Extraire la réponse finale ─────────────────────────
    let reply = ''
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const msg = conversationMessages[i]
      if (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim()) {
        reply = msg.content
        break
      }
    }

    if (!reply) {
      reply = executedActions.length > 0
        ? 'Actions exécutées avec succès.'
        : 'Désolé, je n\'ai pas pu répondre.'
    }

    // Extraire les règles si présentes (compatibilité existante)
    const rulesMatch = reply.match(/---RULES---\n([\s\S]*?)\n---END_RULES---/)
    const extractedRules = rulesMatch ? rulesMatch[1].trim() : null

    return NextResponse.json({
      reply: reply.replace(/---RULES---\n[\s\S]*?\n---END_RULES---/, '').trim(),
      extractedRules,
      actions: executedActions,
    })
  } catch (err) {
    console.error('[Agent] Chat error:', err)
    return NextResponse.json({ error: 'Agent error' }, { status: 500 })
  }
}

// ----------------------------------------------------------
// PUT — Sauvegarder les règles extraites par l'agent
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
