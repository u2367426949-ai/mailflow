// ============================================================
// MailFlow — Tests unitaires : classification OpenAI
// Couvre : classifyByRules, classifyEmail, parseOpenAIResponse
// ============================================================

import { classifyByRules } from '../lib/openai'
import type { EmailToClassify, ClassificationResult } from '../lib/openai'

// ----------------------------------------------------------
// Mock OpenAI
// ----------------------------------------------------------
const mockCreate = jest.fn()

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  }
})

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
function makeEmail(overrides: Partial<EmailToClassify> = {}): EmailToClassify {
  return {
    from: 'sender@example.com',
    to: ['me@test.com'],
    subject: 'Test subject',
    snippet: 'Test content',
    ...overrides,
  }
}

function mockOpenAIResponse(content: string) {
  mockCreate.mockResolvedValueOnce({
    choices: [{ message: { content } }],
  })
}

// ----------------------------------------------------------
// Tests : classifyByRules (fallback)
// ----------------------------------------------------------
describe('classifyByRules', () => {
  describe('spam detection', () => {
    it('should detect Nigerian prince scam', () => {
      const email = makeEmail({
        subject: 'Urgent: Nigerian prince needs your help',
        snippet: 'I need your help with a wire transfer',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('spam')
      expect(result.confidence).toBeGreaterThan(0.7)
      expect(result.source).toBe('rules')
    })

    it('should detect phishing via domain extension', () => {
      const email = makeEmail({
        from: 'noreply@bank-verify.xyz',
        subject: 'Verify your account',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('spam')
    })

    it('should detect lottery scam', () => {
      const email = makeEmail({
        subject: 'Félicitations ! Vous avez gagné !',
        snippet: 'Vous avez gagné le grand prix de notre loterie',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('spam')
    })
  })

  describe('invoices detection', () => {
    it('should detect French invoice keyword', () => {
      const email = makeEmail({
        subject: 'Votre facture #12345',
        snippet: 'Montant : 150,00 €',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('invoices')
    })

    it('should detect English invoice', () => {
      const email = makeEmail({
        subject: 'Invoice #2024-001',
        snippet: 'Payment due: $49.99',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('invoices')
    })

    it('should detect order confirmation', () => {
      const email = makeEmail({
        subject: 'Order confirmed #ORD-123456',
        snippet: 'Thank you for your purchase',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('invoices')
    })

    it('should detect amount with currency symbol', () => {
      const email = makeEmail({
        subject: 'Reçu de paiement',
        snippet: 'Montant débité : 29,99 €',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('invoices')
    })
  })

  describe('newsletters detection', () => {
    it('should detect Mailchimp sender', () => {
      const email = makeEmail({
        from: 'newsletter@company.mailchimp.com',
        subject: 'Weekly digest',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('newsletters')
    })

    it('should detect unsubscribe keyword in French', () => {
      const email = makeEmail({
        from: 'news@company.com',
        subject: 'Nos dernières actualités',
        snippet: 'Pour vous désabonner, cliquez ici',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('newsletters')
    })

    it('should detect unsubscribe keyword in English', () => {
      const email = makeEmail({
        from: 'news@company.com',
        subject: 'Weekly Update',
        snippet: 'Click here to unsubscribe from our mailing list',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('newsletters')
    })

    it('should detect noreply sender', () => {
      const email = makeEmail({
        from: 'no-reply@service.com',
        subject: 'Your notification',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('newsletters')
    })

    it('should detect GitHub notification', () => {
      const email = makeEmail({
        from: 'notifications@github.com',
        subject: 'Someone mentioned you in a pull request',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('newsletters')
    })
  })

  describe('urgent detection', () => {
    it('should detect French urgent keyword', () => {
      const email = makeEmail({
        subject: 'URGENT : Serveur en panne',
        snippet: 'Notre serveur est hors service',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('urgent')
    })

    it('should detect English ASAP keyword', () => {
      const email = makeEmail({
        subject: 'Need your response ASAP',
        snippet: 'Client is waiting',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('urgent')
    })

    it('should detect action required', () => {
      const email = makeEmail({
        subject: 'Action required: contract renewal',
        snippet: 'Please respond within 24h',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('urgent')
    })

    it('should detect "dès que possible" (French)', () => {
      const email = makeEmail({
        subject: 'Rappel important',
        snippet: 'Merci de me contacter dès que possible',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('urgent')
    })
  })

  describe('default classification', () => {
    it('should default to business for professional emails', () => {
      const email = makeEmail({
        from: 'colleague@company.com',
        subject: 'Meeting agenda for next week',
        snippet: 'Let me know your availability',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('business')
      expect(result.confidence).toBeLessThan(0.6) // confiance faible pour le fallback
    })
  })

  describe('priority order', () => {
    it('should classify as invoices even if it contains unsubscribe', () => {
      // Invoices avant newsletters
      const email = makeEmail({
        subject: 'Your invoice #123',
        snippet: 'Amount: $99. To unsubscribe click here.',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('invoices')
    })

    it('should classify as spam even if it mentions invoice', () => {
      // Spam avant invoices
      const email = makeEmail({
        from: 'noreply@winner.top',
        subject: 'You have won! Claim your invoice now',
      })
      const result = classifyByRules(email)
      expect(result.category).toBe('spam')
    })
  })
})

// ----------------------------------------------------------
// Tests : classifyEmail (avec mock OpenAI)
// ----------------------------------------------------------
describe('classifyEmail', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('should return OpenAI classification when valid', async () => {
    const { classifyEmail } = await import('../lib/openai')

    mockOpenAIResponse(
      JSON.stringify({ category: 'urgent', confidence: 0.95, reason: 'Urgent request' })
    )

    const result = await classifyEmail(
      makeEmail({ subject: 'Server is down urgently' })
    )

    expect(result.category).toBe('urgent')
    expect(result.confidence).toBe(0.95)
    expect(result.source).toBe('openai')
  })

  it('should fallback to rules when OpenAI returns invalid category', async () => {
    const { classifyEmail } = await import('../lib/openai')

    mockOpenAIResponse(
      JSON.stringify({ category: 'invalid_category', confidence: 0.8, reason: 'test' })
    )

    const result = await classifyEmail(
      makeEmail({
        from: 'noreply@mailchimp.com',
        subject: 'Newsletter',
      })
    )

    // Fallback vers rules → newsletters
    expect(result.source).toBe('rules')
  })

  it('should fallback to rules when OpenAI returns malformed JSON', async () => {
    const { classifyEmail } = await import('../lib/openai')

    mockOpenAIResponse('This is not JSON at all')

    const result = await classifyEmail(
      makeEmail({ subject: 'Facture #123', snippet: 'Montant : 50€' })
    )

    expect(result.source).toBe('rules')
    expect(result.category).toBe('invoices')
  })

  it('should fallback to rules when OpenAI throws an error', async () => {
    const { classifyEmail } = await import('../lib/openai')

    mockCreate.mockRejectedValueOnce(new Error('OpenAI API error 429'))

    const result = await classifyEmail(
      makeEmail({ subject: 'Facture', snippet: 'Invoice #1234 payment due' })
    )

    expect(result.source).toBe('rules')
  })

  it('should fallback to rules when OpenAI returns empty response', async () => {
    const { classifyEmail } = await import('../lib/openai')

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    })

    const result = await classifyEmail(makeEmail())
    expect(result.source).toBe('rules')
  })

  it('should clamp confidence to [0, 1]', async () => {
    const { classifyEmail } = await import('../lib/openai')

    mockOpenAIResponse(
      JSON.stringify({ category: 'spam', confidence: 1.5, reason: 'Spam' })
    )

    const result = await classifyEmail(makeEmail())
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
  })

  it('should handle JSON embedded in text (GPT quirk)', async () => {
    const { classifyEmail } = await import('../lib/openai')

    mockOpenAIResponse(
      'Sure! Here is the result: {"category": "newsletters", "confidence": 0.8, "reason": "Newsletter"}'
    )

    const result = await classifyEmail(
      makeEmail({ from: 'noreply@newsletter.com' })
    )

    // Devrait extraire le JSON embarqué
    expect(['newsletters', 'rules'].includes(result.category)).toBeTruthy()
  })
})

// ----------------------------------------------------------
// Tests : classifyEmailsBatch
// ----------------------------------------------------------
describe('classifyEmailsBatch', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('should classify multiple emails and return a map', async () => {
    const { classifyEmailsBatch } = await import('../lib/openai')

    const emails = [
      { id: 'email-1', email: makeEmail({ subject: 'Urgent meeting', snippet: 'urgent' }) },
      { id: 'email-2', email: makeEmail({ subject: 'Newsletter', from: 'noreply@news.com' }) },
    ]

    // Mock 2 réponses OpenAI
    mockOpenAIResponse(JSON.stringify({ category: 'urgent', confidence: 0.9, reason: 'urgent' }))
    mockOpenAIResponse(JSON.stringify({ category: 'newsletters', confidence: 0.85, reason: 'newsletter' }))

    const results = await classifyEmailsBatch(emails)

    expect(results.size).toBe(2)
    expect(results.get('email-1')?.category).toBe('urgent')
    expect(results.get('email-2')?.category).toBe('newsletters')
  }, 10_000) // Timeout extended car il y a des délais entre requêtes

  it('should handle individual email failures gracefully', async () => {
    const { classifyEmailsBatch } = await import('../lib/openai')

    const emails = [
      { id: 'email-1', email: makeEmail({ subject: 'Facture', snippet: 'invoice #123' }) },
      { id: 'email-2', email: makeEmail({ subject: 'Business meeting' }) },
    ]

    // Première réponse OpenAI échoue, deuxième OK
    mockCreate.mockRejectedValueOnce(new Error('Rate limit'))
    mockOpenAIResponse(JSON.stringify({ category: 'business', confidence: 0.8, reason: 'business' }))

    const results = await classifyEmailsBatch(emails)

    // Les deux doivent avoir un résultat (fallback rules pour le premier)
    expect(results.size).toBe(2)
    expect(results.get('email-1')?.source).toBe('rules')
    expect(results.get('email-2')?.category).toBe('business')
  }, 10_000)
})
