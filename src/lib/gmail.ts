// ============================================================
// MailFlow — Client Gmail API
// OAuth2 + fetch emails + apply labels
// ============================================================

import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { db } from './db'

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

  const response = await gmail.users.labels.list({ userId: 'me' })
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

  const response = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      color: color ?? { backgroundColor: '#4a86e8', textColor: '#ffffff' },
    },
  })

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
