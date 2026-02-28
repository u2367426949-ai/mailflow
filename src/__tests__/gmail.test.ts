// ============================================================
// MailFlow — Tests unitaires : Gmail lib
// Couvre : encryptToken/decryptToken, getGmailClient (token refresh),
//          fetchNewEmails, getOrCreateCategoryLabel
// ============================================================

import { encryptToken, decryptToken, createOAuth2Client } from '../lib/gmail'

// ----------------------------------------------------------
// Mocks
// ----------------------------------------------------------

// Mock de la DB Prisma
const mockUserFindUniqueOrThrow = jest.fn()
const mockUserUpdate = jest.fn()
const mockCategoryFindFirst = jest.fn()
const mockCategoryUpdate = jest.fn()

jest.mock('../lib/db', () => ({
  db: {
    user: {
      findUniqueOrThrow: mockUserFindUniqueOrThrow,
      update: mockUserUpdate,
    },
    category: {
      findFirst: mockCategoryFindFirst,
      update: mockCategoryUpdate,
    },
  },
}))

// Mock googleapis
const mockRefreshAccessToken = jest.fn()
const mockSetCredentials = jest.fn()
const mockMessagesList = jest.fn()
const mockMessagesGet = jest.fn()
const mockLabelsList = jest.fn()
const mockLabelsCreate = jest.fn()
const mockMessagesModify = jest.fn()

jest.mock('googleapis', () => {
  const mockOAuth2Client = {
    setCredentials: mockSetCredentials,
    generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/auth'),
    getToken: jest.fn(),
    refreshAccessToken: mockRefreshAccessToken,
  }

  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => mockOAuth2Client),
      },
      oauth2: jest.fn().mockReturnValue({
        userinfo: {
          get: jest.fn().mockResolvedValue({
            data: { id: 'google-id-123', email: 'user@gmail.com', name: 'Test User' },
          }),
        },
      }),
      gmail: jest.fn().mockReturnValue({
        users: {
          messages: {
            list: mockMessagesList,
            get: mockMessagesGet,
            modify: mockMessagesModify,
          },
          labels: {
            list: mockLabelsList,
            create: mockLabelsCreate,
          },
        },
      }),
    },
  }
})

// ----------------------------------------------------------
// Setup
// ----------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks()
  // Définir la clé de chiffrement pour les tests
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long'
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/gmail'
})

// ----------------------------------------------------------
// Tests : encryptToken / decryptToken
// ----------------------------------------------------------
describe('encryptToken / decryptToken', () => {
  it('should encrypt and decrypt a token correctly', () => {
    const originalToken = 'ya29.test_access_token_123456'
    const encrypted = encryptToken(originalToken)

    expect(encrypted).not.toBe(originalToken)
    expect(encrypted).toBeTruthy()
    expect(typeof encrypted).toBe('string')

    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(originalToken)
  })

  it('should produce different ciphertexts for the same token (random IV)', () => {
    const token = 'same_token_value'
    const encrypted1 = encryptToken(token)
    const encrypted2 = encryptToken(token)

    // Avec AES-GCM et IV aléatoire, deux chiffrements du même token doivent être différents
    expect(encrypted1).not.toBe(encrypted2)
  })

  it('should correctly encrypt and decrypt refresh tokens', () => {
    const refreshToken = '1//0gTestRefreshToken_xyzABCDEFGHIJKLMNOP'
    const encrypted = encryptToken(refreshToken)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(refreshToken)
  })

  it('should handle tokens with special characters', () => {
    const token = 'token-with+special/chars=and&symbols'
    const encrypted = encryptToken(token)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(token)
  })

  it('should handle long tokens', () => {
    const longToken = 'a'.repeat(1024)
    const encrypted = encryptToken(longToken)
    const decrypted = decryptToken(encrypted)
    expect(decrypted).toBe(longToken)
  })

  it('should throw on invalid encrypted data', () => {
    expect(() => decryptToken('invalid-base64-data')).toThrow()
  })
})

// ----------------------------------------------------------
// Tests : getGmailClient (token refresh)
// ----------------------------------------------------------
describe('getGmailClient', () => {
  const userId = 'user-id-123'
  const encryptedRefreshToken = encryptToken('refresh_token_value')
  const encryptedAccessToken = encryptToken('access_token_value')

  it('should refresh token when googleTokenExpiry is null (QA Fix #2)', async () => {
    const { getGmailClient } = await import('../lib/gmail')

    // Simuler un utilisateur avec googleTokenExpiry null
    mockUserFindUniqueOrThrow.mockResolvedValueOnce({
      googleAccessToken: encryptedAccessToken,
      googleRefreshToken: encryptedRefreshToken,
      googleTokenExpiry: null, // ← cas problématique corrigé
    })

    mockRefreshAccessToken.mockResolvedValueOnce({
      credentials: {
        access_token: 'new_access_token',
        expiry_date: Date.now() + 3600 * 1000,
      },
    })

    mockUserUpdate.mockResolvedValueOnce({})

    await getGmailClient(userId)

    // Le refresh DOIT avoir été appelé car expiry est null
    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1)
    expect(mockUserUpdate).toHaveBeenCalledTimes(1)
  })

  it('should refresh token when token expires in less than 5 minutes', async () => {
    const { getGmailClient } = await import('../lib/gmail')

    const expiresIn3Min = new Date(Date.now() + 3 * 60 * 1000)

    mockUserFindUniqueOrThrow.mockResolvedValueOnce({
      googleAccessToken: encryptedAccessToken,
      googleRefreshToken: encryptedRefreshToken,
      googleTokenExpiry: expiresIn3Min,
    })

    mockRefreshAccessToken.mockResolvedValueOnce({
      credentials: {
        access_token: 'new_access_token',
        expiry_date: Date.now() + 3600 * 1000,
      },
    })

    mockUserUpdate.mockResolvedValueOnce({})

    await getGmailClient(userId)

    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1)
  })

  it('should NOT refresh token when token is still valid (> 5 min)', async () => {
    const { getGmailClient } = await import('../lib/gmail')

    const expiresIn30Min = new Date(Date.now() + 30 * 60 * 1000)

    mockUserFindUniqueOrThrow.mockResolvedValueOnce({
      googleAccessToken: encryptedAccessToken,
      googleRefreshToken: encryptedRefreshToken,
      googleTokenExpiry: expiresIn30Min,
    })

    await getGmailClient(userId)

    expect(mockRefreshAccessToken).not.toHaveBeenCalled()
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('should throw if no refresh token', async () => {
    const { getGmailClient } = await import('../lib/gmail')

    mockUserFindUniqueOrThrow.mockResolvedValueOnce({
      googleAccessToken: encryptedAccessToken,
      googleRefreshToken: null, // ← pas de refresh token
      googleTokenExpiry: null,
    })

    await expect(getGmailClient(userId)).rejects.toThrow(
      'No refresh token found for user'
    )
  })

  it('should throw with clear message when refresh fails', async () => {
    const { getGmailClient } = await import('../lib/gmail')

    mockUserFindUniqueOrThrow.mockResolvedValueOnce({
      googleAccessToken: encryptedAccessToken,
      googleRefreshToken: encryptedRefreshToken,
      googleTokenExpiry: null, // Forcer le refresh
    })

    mockRefreshAccessToken.mockRejectedValueOnce(new Error('invalid_grant'))

    await expect(getGmailClient(userId)).rejects.toThrow(
      'Failed to refresh Google access token'
    )
  })

  it('should set fallback expiry when Google does not return expiry_date', async () => {
    const { getGmailClient } = await import('../lib/gmail')

    mockUserFindUniqueOrThrow.mockResolvedValueOnce({
      googleAccessToken: encryptedAccessToken,
      googleRefreshToken: encryptedRefreshToken,
      googleTokenExpiry: null,
    })

    // Google retourne des credentials sans expiry_date
    mockRefreshAccessToken.mockResolvedValueOnce({
      credentials: {
        access_token: 'new_access_token',
        expiry_date: undefined, // ← pas d'expiry
      },
    })

    let updatedData: Record<string, unknown> | null = null
    mockUserUpdate.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) => {
      updatedData = data
      return Promise.resolve({})
    })

    await getGmailClient(userId)

    // Le fallback doit avoir été utilisé (expiry dans ~1h)
    expect(updatedData).not.toBeNull()
    expect(updatedData?.googleTokenExpiry).toBeInstanceOf(Date)
    const expiryTs = (updatedData?.googleTokenExpiry as Date).getTime()
    expect(expiryTs).toBeGreaterThan(Date.now())
  })
})

// ----------------------------------------------------------
// Tests : fetchNewEmails
// ----------------------------------------------------------
describe('fetchNewEmails', () => {
  const userId = 'user-id-123'
  const encryptedRefreshToken = encryptToken('refresh_token_value')

  beforeEach(() => {
    // Token valide pour éviter le refresh
    mockUserFindUniqueOrThrow.mockResolvedValue({
      googleAccessToken: encryptToken('access_token'),
      googleRefreshToken: encryptedRefreshToken,
      googleTokenExpiry: new Date(Date.now() + 30 * 60 * 1000),
    })
  })

  it('should return empty array when no messages', async () => {
    const { fetchNewEmails } = await import('../lib/gmail')

    mockMessagesList.mockResolvedValueOnce({ data: { messages: [] } })

    const result = await fetchNewEmails(userId)
    expect(result).toEqual([])
  })

  it('should fetch and parse email details', async () => {
    const { fetchNewEmails } = await import('../lib/gmail')

    mockMessagesList.mockResolvedValueOnce({
      data: { messages: [{ id: 'msg-1' }] },
    })

    mockMessagesGet.mockResolvedValueOnce({
      data: {
        id: 'msg-1',
        threadId: 'thread-1',
        snippet: 'Test email content',
        labelIds: ['INBOX', 'UNREAD'],
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'me@gmail.com' },
            { name: 'Subject', value: 'Test Subject' },
            { name: 'Date', value: 'Mon, 28 Feb 2026 10:00:00 +0100' },
          ],
        },
      },
    })

    const result = await fetchNewEmails(userId)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('msg-1')
    expect(result[0].from).toBe('sender@example.com')
    expect(result[0].subject).toBe('Test Subject')
    expect(result[0].isRead).toBe(false) // UNREAD label → isRead false
    expect(result[0].snippet).toBe('Test email content')
  })

  it('should mark email as read when UNREAD label is absent', async () => {
    const { fetchNewEmails } = await import('../lib/gmail')

    mockMessagesList.mockResolvedValueOnce({
      data: { messages: [{ id: 'msg-1' }] },
    })

    mockMessagesGet.mockResolvedValueOnce({
      data: {
        id: 'msg-1',
        threadId: 'thread-1',
        snippet: 'Read email',
        labelIds: ['INBOX'], // No UNREAD
        payload: { headers: [] },
      },
    })

    const result = await fetchNewEmails(userId)
    expect(result[0].isRead).toBe(true)
  })

  it('should handle individual message fetch failures gracefully', async () => {
    const { fetchNewEmails } = await import('../lib/gmail')

    mockMessagesList.mockResolvedValueOnce({
      data: { messages: [{ id: 'msg-1' }, { id: 'msg-2' }] },
    })

    // Première requête échoue
    mockMessagesGet.mockRejectedValueOnce(new Error('API error'))
    // Deuxième réussit
    mockMessagesGet.mockResolvedValueOnce({
      data: {
        id: 'msg-2',
        threadId: 'thread-2',
        snippet: 'Valid email',
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'From', value: 'valid@example.com' },
            { name: 'Subject', value: 'Valid email' },
          ],
        },
      },
    })

    const result = await fetchNewEmails(userId)
    // Seulement le second email est retourné (le premier a échoué)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('msg-2')
  })
})

// ----------------------------------------------------------
// Tests : getOrCreateCategoryLabel
// ----------------------------------------------------------
describe('getOrCreateCategoryLabel', () => {
  const userId = 'user-id-123'
  const encryptedRefreshToken = encryptToken('refresh_token_value')

  beforeEach(() => {
    mockUserFindUniqueOrThrow.mockResolvedValue({
      googleAccessToken: encryptToken('access_token'),
      googleRefreshToken: encryptedRefreshToken,
      googleTokenExpiry: new Date(Date.now() + 30 * 60 * 1000),
    })
  })

  it('should return existing labelId from DB', async () => {
    const { getOrCreateCategoryLabel } = await import('../lib/gmail')

    mockCategoryFindFirst.mockResolvedValueOnce({
      id: 'cat-1',
      gmailLabelId: 'label-123',
    })

    const result = await getOrCreateCategoryLabel(userId, 'urgent')
    expect(result).toBe('label-123')
    // Ne doit pas appeler Gmail API
    expect(mockLabelsList).not.toHaveBeenCalled()
  })

  it('should return null for unknown category', async () => {
    const { getOrCreateCategoryLabel } = await import('../lib/gmail')

    const result = await getOrCreateCategoryLabel(userId, 'unknown_category')
    expect(result).toBeNull()
  })

  it('should find existing Gmail label and save to DB', async () => {
    const { getOrCreateCategoryLabel } = await import('../lib/gmail')

    // Pas de labelId en DB
    mockCategoryFindFirst.mockResolvedValueOnce({ id: 'cat-1', gmailLabelId: null })

    // Label existe déjà dans Gmail
    mockLabelsList.mockResolvedValueOnce({
      data: {
        labels: [
          { id: 'gmail-label-999', name: 'MailFlow/🔴 Urgent' },
        ],
      },
    })

    mockCategoryUpdate.mockResolvedValueOnce({})

    const result = await getOrCreateCategoryLabel(userId, 'urgent')
    expect(result).toBe('gmail-label-999')
    expect(mockLabelsCreate).not.toHaveBeenCalled()
    expect(mockCategoryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { gmailLabelId: 'gmail-label-999' } })
    )
  })

  it('should create Gmail label when not found', async () => {
    const { getOrCreateCategoryLabel } = await import('../lib/gmail')

    mockCategoryFindFirst.mockResolvedValueOnce({ id: 'cat-1', gmailLabelId: null })

    // Aucun label dans Gmail
    mockLabelsList.mockResolvedValueOnce({ data: { labels: [] } })

    // Création du label
    mockLabelsCreate.mockResolvedValueOnce({
      data: { id: 'new-label-id', name: 'MailFlow/🔴 Urgent', type: 'user' },
    })

    mockCategoryUpdate.mockResolvedValueOnce({})

    const result = await getOrCreateCategoryLabel(userId, 'urgent')
    expect(result).toBe('new-label-id')
    expect(mockLabelsCreate).toHaveBeenCalledTimes(1)
  })
})
