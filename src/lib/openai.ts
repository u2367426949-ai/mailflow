// ============================================================
// MailFlow — Classification email avec OpenAI GPT-4o-mini
// ============================================================

import OpenAI from 'openai'

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
export type EmailCategory =
  | 'urgent'
  | 'personal'
  | 'business'
  | 'invoices'
  | 'newsletters'
  | 'spam'
  | 'unknown'

export interface ClassificationResult {
  category: EmailCategory
  confidence: number
  reason: string
  source?: 'openai' | 'rules' | 'fallback'
}

export interface EmailToClassify {
  from: string
  to: string[]
  subject: string
  snippet: string
}

// ----------------------------------------------------------
// Client OpenAI singleton
// ----------------------------------------------------------
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })
  }
  return openaiClient
}

// ----------------------------------------------------------
// Prompt système
// ----------------------------------------------------------
const SYSTEM_PROMPT = `Tu es un classificateur d'emails professionnel. Tu dois catégoriser chaque email dans exactement une catégorie, avec un score de confiance. Réponds UNIQUEMENT en JSON valide, sans texte avant ou après.`

// ----------------------------------------------------------
// Construire le prompt utilisateur
// ----------------------------------------------------------
function buildUserPrompt(email: EmailToClassify): string {
  const toStr = email.to.slice(0, 3).join(', ')

  return `Catégories disponibles :
- urgent : nécessite une action rapide (délai < 24h), demande critique, problème bloquant, mots-clés 'urgent', 'asap', 'important', 'impératif', 'immédiatement'
- personal : emails personnels (amis, famille), ton informel, prénom uniquement, sans rapport avec le travail
- business : communication professionnelle non urgente (clients, partenaires, collègues), suivi de projet, propositions commerciales, réunions
- invoices : factures, reçus, documents financiers, confirmations de paiement, mots-clés 'facture', 'invoice', 'payment', 'receipt', 'reçu', 'montant', 'règlement'
- newsletters : newsletters, promotions, contenu marketing, notifications d'abonnement, expéditeurs type Mailchimp/Substack
- spam : spam évident, phishing, publicité non sollicitée, emails indésirables

Règles de priorité :
1. Si l'email contient une demande urgente EXPLICITE avec délai court → urgent
2. Les newsletters/promotions vont dans newsletters, même si d'un client
3. Les factures vont dans invoices, même si urgentes
4. En cas de doute → business avec confiance basse

Email à classer :
De : ${email.from}
À : ${toStr}
Sujet : ${email.subject}
Extrait : ${email.snippet}

Réponds en JSON : {"category": "...", "confidence": 0.0, "reason": "..."}`
}

// ----------------------------------------------------------
// VALID_CATEGORIES — liste exhaustive
// ----------------------------------------------------------
const VALID_CATEGORIES: EmailCategory[] = [
  'urgent',
  'personal',
  'business',
  'invoices',
  'newsletters',
  'spam',
]

// ----------------------------------------------------------
// Classification par règles — FALLBACK robuste
// Amélioré QA #1 : règles multi-langue, plus de patterns
// ----------------------------------------------------------
export function classifyByRules(email: EmailToClassify): ClassificationResult {
  const text = `${email.from} ${email.subject} ${email.snippet}`.toLowerCase()
  const fromLower = email.from.toLowerCase()
  const subjectLower = email.subject.toLowerCase()

  // ----------------------------------------------------------
  // 1. SPAM — détection prioritaire (avant newsletters)
  // ----------------------------------------------------------
  const spamPatterns = [
    // Phishing / arnaque
    /nigerian prince|loterie|lottery|you('ve| have) won|félicitations.*gagné|congratulations.*won/i,
    /vérif(ier|ication) (votre |your )?(compte|account|identity)/i,
    /wire transfer|western union|moneygram/i,
    /click here to claim|cliquer ici pour réclamer/i,
    /verify your account.*24h|vérifiez votre compte.*24h/i,

    // Domaines suspicieux
    /@[a-z0-9-]+\.(xyz|top|loan|win|click|download|stream)$/i,

    // Contenu spam typique
    /free (prize|gift|iphone|money)|cadeau gratuit/i,
    /earn \$\d+/i,
    /no prescription needed|sans ordonnance/i,
    /\b(viagra|cialis|levitra)\b/i,
  ]

  if (spamPatterns.some((pattern) => pattern.test(text))) {
    return {
      category: 'spam',
      confidence: 0.85,
      reason: 'Contenu typique de spam ou phishing détecté',
      source: 'rules',
    }
  }

  // ----------------------------------------------------------
  // 2. INVOICES — avant newsletters (une facture peut avoir "unsubscribe")
  // ----------------------------------------------------------
  const invoicePatterns = [
    /\b(facture|invoice|receipt|reçu|quittance)\b/i,
    /\b(payment|paiement|règlement|solde|montant dû)\b/i,
    /\b(billing|facturation|statement|relevé)\b/i,
    /order (confirmation|confirmed)|commande (confirmée|numéro)/i,
    /\b(debit|crédit|prélèvement|virement)\b/i,
    /\btax(e)?s?\b.*\b(due|à payer|déclaration)\b/i,
    // Formats montants courants : 12,50 € ou $49.99
    /\d+[,.]?\d*\s*[€$£¥]/,
    // Sujet typique de facture
    /sujet.*facture|invoice #\d+|ref.*\d{4,}/i,
  ]

  if (invoicePatterns.some((pattern) => pattern.test(text))) {
    return {
      category: 'invoices',
      confidence: 0.8,
      reason: 'Mots-clés financiers ou document de facturation détecté',
      source: 'rules',
    }
  }

  // ----------------------------------------------------------
  // 3. NEWSLETTERS / NOTIFICATIONS
  // ----------------------------------------------------------
  const newsletterPatterns = [
    // Expéditeurs connus
    /@(mailchimp|sendgrid|mailgun|constantcontact|klaviyo|brevo|sendinblue|substack|convertkit|drip|hubspot|marketo)\./i,
    /noreply|no-reply|donotreply|do-not-reply/i,
    // Contenu marketing
    /\b(unsubscribe|se désabonner|désabonnement|gérer vos préférences|manage preferences)\b/i,
    /\b(newsletter|digest|weekly update|mise à jour hebdomadaire)\b/i,
    /\b(promotion|promo|deal|offre spéciale|limited time|offre limitée|sale|soldes)\b/i,
    /\b(new product|nouveau produit|lancement|launch|now available|disponible maintenant)\b/i,
    // Notifications automatiques
    /\b(notification|alert|rappel automatique|automated|no reply)\b/i,
    /github.*(mention|pull request|issue|commit|action)|gitlab.*(merge request|pipeline)/i,
    /\b(linkedin|twitter|facebook|instagram).*(notification|mentioned|liked|followed)\b/i,
  ]

  if (newsletterPatterns.some((pattern) => pattern.test(text))) {
    return {
      category: 'newsletters',
      confidence: 0.75,
      reason: 'Expéditeur automatique ou contenu marketing/newsletter détecté',
      source: 'rules',
    }
  }

  // ----------------------------------------------------------
  // 4. URGENT
  // ----------------------------------------------------------
  const urgentPatterns = [
    // Multi-langue : FR + EN
    /\b(urgent|urgente|urgently|asap|as soon as possible)\b/i,
    /\b(immédiat|immédiatement|immediately|right away)\b/i,
    /\b(impératif|imperative|critique|critical|bloquant|blocking)\b/i,
    /\b(dès que possible|au plus vite|as fast as possible)\b/i,
    /\b(deadline|échéance|date limite).*aujourd('hui|'hui)|today\b.*\b(deadline|due)\b/i,
    /\b(action requise|action required|response needed|réponse requise)\b/i,
    /\b(incident|outage|panne|down|hors service)\b/i,
    // Détection contexte urgent dans le sujet (pattern plus strict)
    /^(re|fwd)?:?\s*(urgent|action required|réponse urgente)/i,
  ]

  if (urgentPatterns.some((pattern) => pattern.test(text))) {
    return {
      category: 'urgent',
      confidence: 0.75,
      reason: 'Mots-clés d\'urgence détectés (multi-langue)',
      source: 'rules',
    }
  }

  // ----------------------------------------------------------
  // 5. PERSONAL — expéditeurs personnels (heuristique)
  // ----------------------------------------------------------
  const personalPatterns = [
    // Domaines perso courants
    /@(gmail|yahoo|hotmail|outlook|live|icloud|protonmail|laposte|orange|sfr|free)\.(fr|com|net|org)\s*$/i,
    // Ton informel dans le sujet
    /^(re|fwd)?:?\s*(salut|bonjour|coucou|hey|yo|hello|hi)\b/i,
    // Préfixes personnels dans le sujet
    /^(re|fwd)?:?\s*(rdv|anniversaire|weekend|dîner|apéro|vacances)\b/i,
  ]

  // Uniquement si l'expéditeur correspond (and no professional signals)
  const hasProfessionalSignals =
    /@[a-z0-9-]+\.(com|fr|io|net|org|co)$/i.test(fromLower) &&
    !personalPatterns[0].test(fromLower)

  if (!hasProfessionalSignals && personalPatterns.some((p) => p.test(text))) {
    return {
      category: 'personal',
      confidence: 0.65,
      reason: 'Expéditeur personnel ou ton informel détecté',
      source: 'rules',
    }
  }

  // ----------------------------------------------------------
  // 6. Default : business (professionnel non urgent)
  // ----------------------------------------------------------
  return {
    category: 'business',
    confidence: 0.45,
    reason: 'Classification par défaut — aucune règle spécifique correspondante',
    source: 'rules',
  }
}

// ----------------------------------------------------------
// Valider et parser le JSON retourné par OpenAI
// FIX QA #7 : validation robuste avec fallback
// ----------------------------------------------------------
function parseOpenAIResponse(raw: string): ClassificationResult | null {
  // Essai 1 : JSON direct
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>

    // Valider que les champs existent et ont les bons types
    if (typeof parsed !== 'object' || parsed === null) return null

    const category = parsed.category as string | undefined
    const confidence = parsed.confidence as number | undefined
    const reason = parsed.reason as string | undefined

    // Valider la catégorie
    if (!category || !VALID_CATEGORIES.includes(category as EmailCategory)) {
      console.warn(`[OpenAI] Invalid category returned: ${category}`)
      return null
    }

    // Valider la confiance (0-1)
    const validConfidence =
      typeof confidence === 'number' && isFinite(confidence)
        ? Math.min(1, Math.max(0, confidence))
        : 0.5

    return {
      category: category as EmailCategory,
      confidence: validConfidence,
      reason: typeof reason === 'string' && reason.length > 0 ? reason : 'Classified by AI',
      source: 'openai',
    }
  } catch {
    // Essai 2 : extraire le JSON d'une réponse partiellement non-JSON
    // (GPT peut parfois préfixer du texte malgré le system prompt)
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return parseOpenAIResponse(jsonMatch[0]) // récursion avec le JSON extrait
      }
    } catch {
      // Silencieux
    }

    console.warn('[OpenAI] Failed to parse response as JSON:', raw.substring(0, 200))
    return null
  }
}

// ----------------------------------------------------------
// Classifier un email via GPT-4o-mini
// ----------------------------------------------------------
export async function classifyEmail(
  email: EmailToClassify
): Promise<ClassificationResult> {
  const openai = getOpenAIClient()

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(email) },
      ],
      temperature: 0.1,
      max_tokens: 150, // Optimisé QA #11 : réduit de 200 à 150 (JSON compact suffit)
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) {
      throw new Error('Empty response from OpenAI')
    }

    // Valider le JSON retourné (FIX QA #7)
    const result = parseOpenAIResponse(raw)
    if (!result) {
      // JSON invalide ou catégorie inconnue → fallback
      console.warn('[OpenAI] Invalid JSON structure, falling back to rules')
      return classifyByRules(email)
    }

    return result
  } catch (err) {
    // Distinguer les erreurs de quota vs les erreurs réseau
    const errorMessage = err instanceof Error ? err.message : String(err)

    if (errorMessage.includes('429') || errorMessage.includes('rate_limit')) {
      console.warn('[OpenAI] Rate limit hit, falling back to rules')
    } else if (errorMessage.includes('insufficient_quota')) {
      console.error('[OpenAI] Quota exceeded, falling back to rules')
    } else {
      console.error('[OpenAI] Classification failed, falling back to rules:', errorMessage)
    }

    // Fallback vers les règles
    return classifyByRules(email)
  }
}

// ----------------------------------------------------------
// Classifier plusieurs emails en batch
// Avec rate limiting intégré (100ms entre requêtes)
// ----------------------------------------------------------
export async function classifyEmailsBatch(
  emails: Array<{ id: string; email: EmailToClassify }>
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>()

  // Traitement séquentiel pour respecter les rate limits OpenAI
  for (const { id, email } of emails) {
    const result = await classifyEmail(email)
    results.set(id, result)

    // Pause de 100ms entre les requêtes (évite le rate limit OpenAI)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return results
}

// ----------------------------------------------------------
// Générer un résumé du digest quotidien
// ----------------------------------------------------------
export interface DigestSummaryInput {
  urgentEmails: Array<{ from: string; subject: string; snippet: string }>
  stats: {
    total: number
    byCategory: Record<string, number>
    accuracy?: number
  }
  userName: string
}

export async function generateDigestSummary(input: DigestSummaryInput): Promise<string> {
  const openai = getOpenAIClient()

  const urgentList = input.urgentEmails
    .slice(0, 5)
    .map((e, i) => `${i + 1}. De: ${e.from} | Sujet: ${e.subject} | ${e.snippet}`)
    .join('\n')

  const statsText = Object.entries(input.stats.byCategory)
    .map(([cat, count]) => `  - ${cat}: ${count}`)
    .join('\n')

  const prompt = `Tu es un assistant email. Génère un court résumé (2-3 phrases max) en français pour le digest quotidien de ${input.userName}.

Stats d'hier :
- Total emails traités : ${input.stats.total}
${input.stats.accuracy ? `- Précision IA : ${Math.round(input.stats.accuracy * 100)}%` : ''}
${statsText}

Emails urgents (${input.urgentEmails.length}) :
${urgentList || 'Aucun email urgent'}

Génère un résumé concis et utile, en tutoyant l'utilisateur.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    })

    return (
      completion.choices[0]?.message?.content ??
      `Voici ton digest quotidien. ${input.stats.total} emails traités hier.`
    )
  } catch {
    return `Voici ton digest quotidien. ${input.stats.total} emails traités hier.`
  }
}
