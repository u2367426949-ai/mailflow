// ============================================================
// MailFlow — Client Gmail API
// OAuth2 + fetch emails + apply labels
// ============================================================

import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { db } from './db'

// ----------------------------------------------------------
// Throttle Gmail API : limite le débit et retry sur 429
// Gmail quota = 250 queries/min/user. On se limite à ~150/min.
// ----------------------------------------------------------
const GMAIL_MIN_DELAY_MS = 400 // ~150 req/min max
const GMAIL_MAX_RETRIES = 3
const userLastCall = new Map<string, number>()

async function gmailThrottle(userId: string): Promise<void> {
  const now = Date.now()
  const last = userLastCall.get(userId) ?? 0
  const wait = GMAIL_MIN_DELAY_MS - (now - last)
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait))
  }
  userLastCall.set(userId, Date.now())
}

function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const code = (err as { code?: number }).code
    if (code === 429) return true
    const message = (err as { message?: string }).message ?? ''
    if (message.includes('Quota exceeded') || message.includes('Rate Limit')) return true
  }
  return false
}

async function withRetry<T>(fn: () => Promise<T>, userId: string): Promise<T> {
  for (let attempt = 0; attempt < GMAIL_MAX_RETRIES; attempt++) {
    try {
      await gmailThrottle(userId)
      return await fn()
    } catch (err) {
      if (isRateLimitError(err) && attempt < GMAIL_MAX_RETRIES - 1) {
        const backoff = Math.pow(2, attempt + 1) * 1000 // 2s, 4s, 8s
        console.warn(`[Gmail] Rate limited for user ${userId}, retrying in ${backoff}ms (attempt ${attempt + 1})`)
        await new Promise((r) => setTimeout(r, backoff))
        continue
      }
      throw err
    }
  }
  throw new Error('Unreachable')
}

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
export interface GmailMessage {
  id: string
  threadId: string
  from: string
  to: string[]
  cc: string[]
  subject: string
  snippet: string
  receivedAt: Date
  labels: string[]
  isRead: boolean
}

export interface GmailLabel {
  id: string
  name: string
  type?: string
}

// ----------------------------------------------------------
// Création du client OAuth2
// ----------------------------------------------------------
export function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )
}

// ----------------------------------------------------------
// Générer l'URL d'autorisation Google
// ----------------------------------------------------------
export function getAuthorizationUrl(state: string): string {
  const oauth2Client = createOAuth2Client()

  const scopes = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.labels',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ]

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state,
    prompt: 'consent', // Force le refresh token
  })
}

// ----------------------------------------------------------
// Échanger un code contre des tokens
// ----------------------------------------------------------
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

// ----------------------------------------------------------
// Obtenir le profil utilisateur Google
// ----------------------------------------------------------
export async function getGoogleProfile(accessToken: string) {
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data } = await oauth2.userinfo.get()

  return {
    googleId: data.id!,
    email: data.email!,
    name: data.name ?? undefined,
    avatar: data.picture ?? undefined,
  }
}

// ----------------------------------------------------------
// Chiffrement / déchiffrement des tokens (AES-256-GCM)
// ----------------------------------------------------------
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

function getKeyBuffer(): Buffer {
  // Dériver une clé 32 bytes via SHA-256 (plus sûr que le padding avec des zéros)
  const crypto = require('crypto') as typeof import('crypto')
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
}

export function encryptToken(token: string): string {
  if (typeof window !== 'undefined') {
    // Côté client : pas de chiffrement
    return token
  }
  const crypto = require('crypto') as typeof import('crypto')
  const iv = crypto.randomBytes(12)
  const key = getKeyBuffer()
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptToken(encryptedToken: string): string {
  if (typeof window !== 'undefined') {
    return encryptedToken
  }
  const crypto = require('crypto') as typeof import('crypto')
  const buf = Buffer.from(encryptedToken, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const key = getKeyBuffer()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

// ----------------------------------------------------------
// Obtenir un client Gmail authentifié pour un utilisateur
// Rafraîchit automatiquement le token si expiré ou si expiry est null
// FIX QA #2 : gestion correcte quand googleTokenExpiry est null
// ----------------------------------------------------------
export async function getGmailClient(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
    },
  })

  if (!user.googleRefreshToken) {
    throw new Error('No refresh token found for user. Re-authentication required.')
  }

  const oauth2Client = createOAuth2Client()

  const refreshToken = decryptToken(user.googleRefreshToken)
  const accessToken = user.googleAccessToken ? decryptToken(user.googleAccessToken) : undefined

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    // Ne pas passer expiry_date si null — évite les comportements indéfinis
    ...(user.googleTokenExpiry && { expiry_date: user.googleTokenExpiry.getTime() }),
  })

  const now = Date.now()

  // FIX : si googleTokenExpiry est null OU si le token expire dans moins de 5 min
  // → on force le refresh. Cas nul arrive après première connexion sans refresh_token.
  const expiry = user.googleTokenExpiry?.getTime() ?? null
  const needsRefresh =
    expiry === null || // Token expiry inconnu → refresh préventif
    expiry - now < 5 * 60 * 1000 // Token expire dans moins de 5 min

  if (needsRefresh) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken()
      oauth2Client.setCredentials(credentials)

      // Mettre à jour en base
      await db.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: credentials.access_token
            ? encryptToken(credentials.access_token)
            : undefined,
          // Toujours mettre à jour l'expiry même si credentials.expiry_date est undefined
          googleTokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : new Date(Date.now() + 3600 * 1000), // Fallback : 1h si Google ne précise pas
        },
      })
    } catch (err) {
      // Enrichir l'erreur avec plus de contexte
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Gmail] Failed to refresh token for user ${userId}: ${message}`)
      throw new Error(
        `Failed to refresh Google access token. User must re-authenticate. Reason: ${message}`
      )
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

// ----------------------------------------------------------
// Récupérer le nombre total de messages dans la boîte Gmail
// ----------------------------------------------------------
export async function getGmailMessagesTotal(userId: string): Promise<number> {
  const gmail = await getGmailClient(userId)
  const { data } = await gmail.users.getProfile({ userId: 'me' })
  return data.messagesTotal ?? 0
}

// ----------------------------------------------------------
// Récupérer les nouveaux emails depuis la dernière sync
// ----------------------------------------------------------
export async function fetchNewEmails(
  userId: string,
  since?: Date,
  maxResults = 50
): Promise<GmailMessage[]> {
  return fetchEmails(userId, { since, maxResults, scope: 'inbox' })
}

// ----------------------------------------------------------
// Récupérer TOUS les emails de la boîte mail (avec pagination)
// Supporte 10 000+ emails grâce au pageToken
// ----------------------------------------------------------
export async function fetchAllMailboxEmails(
  userId: string,
  maxResults = 50000,
  onProgress?: (fetched: number) => void
): Promise<GmailMessage[]> {
  return fetchEmails(userId, { maxResults, scope: 'all', onProgress })
}

// ----------------------------------------------------------
// Fonction interne : récupérer des emails avec pagination
// ----------------------------------------------------------
interface FetchEmailsOptions {
  since?: Date
  maxResults?: number
  scope?: 'inbox' | 'all'   // 'all' = toute la boîte mail
  onProgress?: (fetched: number) => void
}

async function fetchEmails(
  userId: string,
  options: FetchEmailsOptions = {}
): Promise<GmailMessage[]> {
  const { since, maxResults = 50, scope = 'inbox', onProgress } = options
  const gmail = await getGmailClient(userId)

  // Construire la query Gmail
  // 'all' = pas de filtre in:inbox, on prend tout sauf spam/trash
  let query = scope === 'all' ? '-in:spam -in:trash' : 'in:inbox'
  if (since) {
    const sinceTimestamp = Math.floor(since.getTime() / 1000)
    query += ` after:${sinceTimestamp}`
  }

  // Phase 1 : Collecter tous les message IDs avec pagination
  const allMessageIds: Array<{ id: string }> = []
  let pageToken: string | undefined = undefined
  const PAGE_SIZE = 500 // Max autorisé par Gmail API

  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listResponse: any = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(PAGE_SIZE, maxResults - allMessageIds.length),
      pageToken,
    })

    const messages = listResponse.data.messages ?? []
    for (const msg of messages) {
      if (msg.id) {
        allMessageIds.push({ id: msg.id })
      }
    }

    pageToken = listResponse.data.nextPageToken ?? undefined

    // Callback de progression (pour le sort-all)
    if (onProgress) onProgress(allMessageIds.length)

    console.log(`[Gmail] Listed ${allMessageIds.length} message IDs (page done, hasMore: ${!!pageToken})`)
  } while (pageToken && allMessageIds.length < maxResults)

  if (allMessageIds.length === 0) return []

  // Phase 2 : Récupérer les détails de chaque message (en batch de 25 pour performance)
  const results: GmailMessage[] = []
  const BATCH_SIZE = 25

  for (let i = 0; i < allMessageIds.length; i += BATCH_SIZE) {
    const batch = allMessageIds.slice(i, i + BATCH_SIZE)

    const batchResults = await Promise.allSettled(
      batch.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date'],
        })

        const headers = detail.data.payload?.headers ?? []
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

        const from = getHeader('From')
        const toRaw = getHeader('To')
        const ccRaw = getHeader('Cc')
        const subject = getHeader('Subject')
        const dateStr = getHeader('Date')

        const to = toRaw
          ? toRaw.split(',').map((s) => s.trim()).filter(Boolean)
          : []
        const cc = ccRaw
          ? ccRaw.split(',').map((s) => s.trim()).filter(Boolean)
          : []

        const labelIds = detail.data.labelIds ?? []
        const isRead = !labelIds.includes('UNREAD')

        return {
          id: msg.id,
          threadId: detail.data.threadId ?? '',
          from,
          to,
          cc,
          subject,
          snippet: detail.data.snippet ?? '',
          receivedAt: dateStr ? new Date(dateStr) : new Date(),
          labels: labelIds,
          isRead,
        } as GmailMessage
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      } else if (result.status === 'rejected') {
        console.error('[Gmail] Failed to fetch message details:', result.reason?.message ?? 'unknown error')
      }
    }
  }

  return results
}

// ----------------------------------------------------------
// Lister les labels Gmail de l'utilisateur
// ----------------------------------------------------------
export async function listGmailLabels(userId: string): Promise<GmailLabel[]> {
  const gmail = await getGmailClient(userId)

  const response = await withRetry(
    () => gmail.users.labels.list({ userId: 'me' }),
    userId
  )
  return (response.data.labels ?? []).map((l) => ({
    id: l.id!,
    name: l.name!,
    type: l.type ?? undefined,
  }))
}

// ----------------------------------------------------------
// Créer un label Gmail
// ----------------------------------------------------------
export async function createGmailLabel(
  userId: string,
  name: string,
  color?: { backgroundColor: string; textColor: string }
): Promise<GmailLabel> {
  const gmail = await getGmailClient(userId)

  const response = await withRetry(
    () => gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
        color: color ?? { backgroundColor: '#4a86e8', textColor: '#ffffff' },
      },
    }),
    userId
  )

  return {
    id: response.data.id!,
    name: response.data.name!,
    type: response.data.type ?? undefined,
  }
}

// ----------------------------------------------------------
// Appliquer un label à un email Gmail
// ----------------------------------------------------------
export async function applyLabelToEmail(
  userId: string,
  gmailMessageId: string,
  labelId: string
): Promise<void> {
  const gmail = await getGmailClient(userId)

  await gmail.users.messages.modify({
    userId: 'me',
    id: gmailMessageId,
    requestBody: {
      addLabelIds: [labelId],
    },
  })
}

// ----------------------------------------------------------
// Déplacer un email : ajouter le label catégorie + retirer de INBOX
// Gère les cas spéciaux (spam → SPAM, etc.)
// ----------------------------------------------------------
export async function moveEmail(
  userId: string,
  gmailMessageId: string,
  categoryLabelId: string,
  categorySlug: string
): Promise<void> {
  const gmail = await getGmailClient(userId)

  // Construire les labels à ajouter / retirer
  const addLabelIds: string[] = [categoryLabelId]
  const removeLabelIds: string[] = ['INBOX'] // Retirer de l'inbox par défaut

  // Cas spéciaux
  if (categorySlug === 'spam') {
    // Déplacer vers le dossier Spam Gmail natif
    addLabelIds.push('SPAM')
  } else if (categorySlug === 'urgent') {
    // Les urgents restent dans l'inbox + marqués importants
    removeLabelIds.length = 0 // NE PAS retirer de l'inbox
    addLabelIds.push('IMPORTANT')
  } else if (categorySlug === 'personal') {
    // Les persos restent dans l'inbox
    removeLabelIds.length = 0
  }

  await gmail.users.messages.modify({
    userId: 'me',
    id: gmailMessageId,
    requestBody: {
      addLabelIds,
      removeLabelIds,
    },
  })
}

// ----------------------------------------------------------
// Obtenir ou créer le label Gmail pour une catégorie MailFlow
// ----------------------------------------------------------

// Mapping catégorie → couleur Gmail
// Gmail n'accepte qu'une palette de couleurs prédéfinie.
// Référence : https://developers.google.com/gmail/api/reference/rest/v1/users.labels
const CATEGORY_LABEL_CONFIG: Record<
  string,
  { name: string; color: { backgroundColor: string; textColor: string } }
> = {
  urgent: {
    name: '🔴 Urgent',
    color: { backgroundColor: '#cc3a21', textColor: '#ffffff' },
  },
  personal: {
    name: '👤 Personnel',
    color: { backgroundColor: '#a46a21', textColor: '#ffffff' },
  },
  business: {
    name: '💼 Business',
    color: { backgroundColor: '#3066be', textColor: '#ffffff' },
  },
  invoices: {
    name: '📄 Factures',
    color: { backgroundColor: '#f2c960', textColor: '#000000' },
  },
  newsletters: {
    name: '📰 Newsletters',
    color: { backgroundColor: '#0b804b', textColor: '#ffffff' },
  },
  spam: {
    name: '🗑️ Spam',
    color: { backgroundColor: '#666666', textColor: '#ffffff' },
  },
}

export async function getOrCreateCategoryLabel(
  userId: string,
  categorySlug: string
): Promise<string | null> {
  const config = CATEGORY_LABEL_CONFIG[categorySlug]
  if (!config) return null

  // Vérifier en DB si on a déjà le label ID
  const category = await db.category.findFirst({
    where: { userId, name: categorySlug },
    select: { id: true, gmailLabelId: true },
  })

  if (category?.gmailLabelId) {
    return category.gmailLabelId
  }

  // Vérifier si le label existe déjà dans Gmail
  const existingLabels = await listGmailLabels(userId)
  const existing = existingLabels.find((l) => l.name === config.name)

  let labelId: string

  if (existing) {
    labelId = existing.id
  } else {
    // Créer le label
    const created = await createGmailLabel(userId, config.name, config.color)
    labelId = created.id
  }

  // Sauvegarder en DB
  if (category) {
    await db.category.update({
      where: { id: category.id },
      data: { gmailLabelId: labelId },
    })
  }

  return labelId
}

// ----------------------------------------------------------
// Rechercher des emails Gmail avec une requête
// Utilise la syntaxe de recherche Gmail (from:, subject:, is:, etc.)
// ----------------------------------------------------------
export async function searchGmailMessages(
  userId: string,
  query: string,
  maxResults = 20
): Promise<Array<{ id: string; from: string; subject: string; snippet: string; date: string; labels: string[] }>> {
  const gmail = await getGmailClient(userId)
  const safeMax = Math.min(Math.max(maxResults, 1), 50)

  const listResponse = await withRetry(
    () => gmail.users.messages.list({ userId: 'me', q: query, maxResults: safeMax }),
    userId
  )

  const messages = listResponse.data.messages ?? []
  if (messages.length === 0) return []

  // Sequential batches of 5 to respect rate limits
  const BATCH = 5
  const results: Array<{ id: string; from: string; subject: string; snippet: string; date: string; labels: string[] }> = []

  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      batch.map(async (msg) => {
        const detail = await withRetry(
          () => gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          }),
          userId
        )
        const headers = detail.data.payload?.headers ?? []
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''
        return {
          id: msg.id!,
          from: getHeader('From'),
          subject: getHeader('Subject'),
          snippet: detail.data.snippet ?? '',
          date: getHeader('Date'),
          labels: detail.data.labelIds ?? [],
        }
      })
    )
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value)
    }
  }

  return results
}

// ----------------------------------------------------------
// Modification batch de messages Gmail (ajouter/retirer des labels)
// Supporte jusqu'à 1000 messages par appel Gmail API
// ----------------------------------------------------------
export async function batchModifyGmailMessages(
  userId: string,
  messageIds: string[],
  addLabelIds: string[] = [],
  removeLabelIds: string[] = []
): Promise<{ modified: number }> {
  if (messageIds.length === 0) return { modified: 0 }
  const gmail = await getGmailClient(userId)

  const CHUNK = 1000
  for (let i = 0; i < messageIds.length; i += CHUNK) {
    const chunk = messageIds.slice(i, i + CHUNK)
    await withRetry(
      () => gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: chunk,
          addLabelIds: addLabelIds.length > 0 ? addLabelIds : undefined,
          removeLabelIds: removeLabelIds.length > 0 ? removeLabelIds : undefined,
        },
      }),
      userId
    )
  }

  return { modified: messageIds.length }
}

// ----------------------------------------------------------
// Mettre des emails à la corbeille
// ----------------------------------------------------------
export async function trashGmailMessages(
  userId: string,
  messageIds: string[]
): Promise<{ trashed: number; errors: number }> {
  if (messageIds.length === 0) return { trashed: 0, errors: 0 }
  const gmail = await getGmailClient(userId)
  const safeIds = messageIds.slice(0, 50) // Limiter à 50 par sécurité

  let trashed = 0
  let errors = 0

  // Sequential batches of 3 to respect rate limits
  const BATCH = 3
  for (let i = 0; i < safeIds.length; i += BATCH) {
    const batch = safeIds.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      batch.map((id) => withRetry(
        () => gmail.users.messages.trash({ userId: 'me', id }),
        userId
      ))
    )
    for (const r of settled) {
      if (r.status === 'fulfilled') trashed++
      else errors++
    }
  }

  return { trashed, errors }
}

// ----------------------------------------------------------
// Récupérer le corps d'un email Gmail
// ----------------------------------------------------------
export async function getGmailMessageBody(
  userId: string,
  messageId: string
): Promise<{ subject: string; from: string; body: string; snippet: string }> {
  const gmail = await getGmailClient(userId)

  const detail = await withRetry(
    () => gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' }),
    userId
  )

  const headers = detail.data.payload?.headers ?? []
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

  // Extraire le corps texte (text/plain en priorité, sinon text/html nettoyé)
  let body = ''
  const payload = detail.data.payload

  function extractBody(part: typeof payload): string {
    if (!part) return ''
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf8')
    }
    if (part.parts) {
      for (const sub of part.parts) {
        const text = extractBody(sub)
        if (text) return text
      }
    }
    // Fallback HTML
    if (part.mimeType === 'text/html' && part.body?.data) {
      const html = Buffer.from(part.body.data, 'base64').toString('utf8')
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    }
    return ''
  }

  body = extractBody(payload)
  // Limiter la taille pour ne pas exploser le contexte
  if (body.length > 2000) body = body.substring(0, 2000) + '…'

  return {
    subject: getHeader('Subject'),
    from: getHeader('From'),
    body,
    snippet: detail.data.snippet ?? '',
  }
}
