// ============================================================
// MailFlow — Tests unitaires : Stripe lib
// Couvre : syncSubscriptionFromStripe, canUseFeature,
//          createCheckoutSession, createBillingPortalSession,
//          getUserInvoices, getPublicPlans
// ============================================================

import {
  syncSubscriptionFromStripe,
  canUseFeature,
  getPublicPlans,
  PLAN_LIMITS,
  PLAN_PRICE_MAP,
} from '../lib/stripe'

// ----------------------------------------------------------
// Mocks
// ----------------------------------------------------------

// Mock Prisma
const mockUserFindFirst = jest.fn()
const mockUserFindUniqueOrThrow = jest.fn()
const mockUserUpdate = jest.fn()

jest.mock('../lib/db', () => ({
  db: {
    user: {
      findFirst: mockUserFindFirst,
      findUniqueOrThrow: mockUserFindUniqueOrThrow,
      update: mockUserUpdate,
    },
  },
}))

// Mock Stripe
const mockCheckoutSessionsCreate = jest.fn()
const mockBillingPortalSessionsCreate = jest.fn()
const mockCustomersCreate = jest.fn()
const mockInvoicesList = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
      },
    },
    billingPortal: {
      sessions: {
        create: mockBillingPortalSessionsCreate,
      },
    },
    customers: {
      create: mockCustomersCreate,
    },
    invoices: {
      list: mockInvoicesList,
    },
  }))
})

// ----------------------------------------------------------
// Setup
// ----------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'sk_test_123'
  process.env.STRIPE_STARTER_PRICE_ID = 'price_starter_123'
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro_123'
  process.env.STRIPE_BUSINESS_PRICE_ID = 'price_business_123'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

// ----------------------------------------------------------
// Tests : syncSubscriptionFromStripe
// ----------------------------------------------------------
describe('syncSubscriptionFromStripe', () => {
  const customerId = 'cus_test123'
  const subscriptionId = 'sub_test123'

  it('should update user plan to starter', async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: 'user-1', plan: 'free' })
    mockUserUpdate.mockResolvedValueOnce({})

    await syncSubscriptionFromStripe(
      customerId,
      subscriptionId,
      'active',
      'price_starter_123',
      null
    )

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'starter' }),
      })
    )
  })

  it('should update user plan to pro', async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: 'user-1', plan: 'starter' })
    mockUserUpdate.mockResolvedValueOnce({})

    await syncSubscriptionFromStripe(
      customerId,
      subscriptionId,
      'active',
      'price_pro_123',
      null
    )

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'pro' }),
      })
    )
  })

  it('should update user plan to business', async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: 'user-1', plan: 'free' })
    mockUserUpdate.mockResolvedValueOnce({})

    await syncSubscriptionFromStripe(
      customerId,
      subscriptionId,
      'active',
      'price_business_123',
      null
    )

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'business' }),
      })
    )
  })

  it('should downgrade to free when subscription is canceled', async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: 'user-1', plan: 'pro' })
    mockUserUpdate.mockResolvedValueOnce({})

    await syncSubscriptionFromStripe(
      customerId,
      subscriptionId,
      'canceled',
      'price_pro_123',
      null
    )

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'free' }),
      })
    )
  })

  it('should downgrade to free when subscription is unpaid', async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: 'user-1', plan: 'business' })
    mockUserUpdate.mockResolvedValueOnce({})

    await syncSubscriptionFromStripe(
      customerId,
      subscriptionId,
      'unpaid',
      'price_business_123',
      null
    )

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'free' }),
      })
    )
  })

  it('should downgrade to free when subscription is incomplete_expired', async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: 'user-1', plan: 'starter' })
    mockUserUpdate.mockResolvedValueOnce({})

    await syncSubscriptionFromStripe(
      customerId,
      subscriptionId,
      'incomplete_expired',
      'price_starter_123',
      null
    )

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'free' }),
      })
    )
  })

  it('should store trialEndsAt when trial period is set', async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: 'user-1', plan: 'free' })
    mockUserUpdate.mockResolvedValueOnce({})

    const trialEndTimestamp = Math.floor(Date.now() / 1000) + 14 * 24 * 3600

    await syncSubscriptionFromStripe(
      customerId,
      subscriptionId,
      'trialing',
      'price_pro_123',
      trialEndTimestamp
    )

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plan: 'pro',
          trialEndsAt: new Date(trialEndTimestamp * 1000),
        }),
      })
    )
  })

  it('should set trialEndsAt to null when no trial', async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: 'user-1', plan: 'free' })
    mockUserUpdate.mockResolvedValueOnce({})

    await syncSubscriptionFromStripe(
      customerId,
      subscriptionId,
      'active',
      'price_pro_123',
      null
    )

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ trialEndsAt: null }),
      })
    )
  })

  it('should do nothing when no user found for customerId', async () => {
    mockUserFindFirst.mockResolvedValueOnce(null)

    await syncSubscriptionFromStripe(
      'cus_unknown',
      subscriptionId,
      'active',
      'price_pro_123',
      null
    )

    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('should handle unknown price ID gracefully (defaults to free)', async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: 'user-1', plan: 'pro' })
    mockUserUpdate.mockResolvedValueOnce({})

    await syncSubscriptionFromStripe(
      customerId,
      subscriptionId,
      'active',
      'price_unknown_999',
      null
    )

    // Plan inconnu → reste free (par défaut)
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'free' }),
      })
    )
  })

  it('should save subscriptionId in DB', async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: 'user-1', plan: 'free' })
    mockUserUpdate.mockResolvedValueOnce({})

    await syncSubscriptionFromStripe(
      customerId,
      'sub_new_id',
      'active',
      'price_pro_123',
      null
    )

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stripeSubscriptionId: 'sub_new_id' }),
      })
    )
  })
})

// ----------------------------------------------------------
// Tests : canUseFeature
// ----------------------------------------------------------
describe('canUseFeature', () => {
  it('should return false for free plan', () => {
    expect(canUseFeature('free', 0)).toBe(false)
    expect(canUseFeature('free', 100)).toBe(false)
  })

  it('should return true for starter plan when under limit', () => {
    expect(canUseFeature('starter', 0)).toBe(true)
    expect(canUseFeature('starter', 50)).toBe(true)
    expect(canUseFeature('starter', 99)).toBe(true)
  })

  it('should return false for starter plan when at or above limit', () => {
    expect(canUseFeature('starter', 100)).toBe(false)
    expect(canUseFeature('starter', 150)).toBe(false)
  })

  it('should return true for pro plan when under limit', () => {
    expect(canUseFeature('pro', 0)).toBe(true)
    expect(canUseFeature('pro', 499)).toBe(true)
  })

  it('should return false for pro plan when at limit', () => {
    expect(canUseFeature('pro', 500)).toBe(false)
  })

  it('should return true for business plan when under limit', () => {
    expect(canUseFeature('business', 1999)).toBe(true)
  })

  it('should return false for business plan when at limit', () => {
    expect(canUseFeature('business', 2000)).toBe(false)
  })
})

// ----------------------------------------------------------
// Tests : createCheckoutSession
// ----------------------------------------------------------
describe('createCheckoutSession', () => {
  const userId = 'user-id-123'

  beforeEach(() => {
    // Utilisateur avec stripeCustomerId existant
    mockUserFindUniqueOrThrow.mockResolvedValue({
      stripeCustomerId: 'cus_existing_123',
      email: 'test@example.com',
      name: 'Test User',
    })
  })

  it('should create checkout session with correct plan', async () => {
    const { createCheckoutSession } = await import('../lib/stripe')

    mockCheckoutSessionsCreate.mockResolvedValueOnce({
      url: 'https://checkout.stripe.com/session_123',
      id: 'cs_test_123',
    })

    const result = await createCheckoutSession({
      userId,
      plan: 'pro',
      successUrl: 'http://localhost:3000/dashboard?checkout=success',
      cancelUrl: 'http://localhost:3000/dashboard?checkout=canceled',
      trialDays: 14,
    })

    expect(result.url).toBe('https://checkout.stripe.com/session_123')
    expect(result.sessionId).toBe('cs_test_123')
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_existing_123',
        mode: 'subscription',
      })
    )
  })

  it('should throw for invalid plan', async () => {
    const { createCheckoutSession } = await import('../lib/stripe')

    await expect(
      createCheckoutSession({
        userId,
        plan: 'invalid' as 'pro',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      })
    ).rejects.toThrow('Invalid plan')
  })

  it('should create Stripe customer if not existing', async () => {
    const { createCheckoutSession } = await import('../lib/stripe')

    // Utilisateur sans stripeCustomerId
    mockUserFindUniqueOrThrow.mockResolvedValueOnce({
      stripeCustomerId: null,
      email: 'new@example.com',
      name: 'New User',
    })

    mockCustomersCreate.mockResolvedValueOnce({ id: 'cus_new_123' })
    mockUserUpdate.mockResolvedValueOnce({})
    mockCheckoutSessionsCreate.mockResolvedValueOnce({
      url: 'https://checkout.stripe.com/new',
      id: 'cs_new_123',
    })

    const result = await createCheckoutSession({
      userId,
      plan: 'starter',
      successUrl: 'http://localhost:3000/success',
      cancelUrl: 'http://localhost:3000/cancel',
    })

    expect(mockCustomersCreate).toHaveBeenCalledTimes(1)
    expect(result.url).toBeTruthy()
  })
})

// ----------------------------------------------------------
// Tests : getUserInvoices
// ----------------------------------------------------------
describe('getUserInvoices', () => {
  it('should return empty array when user has no stripeCustomerId', async () => {
    const { getUserInvoices } = await import('../lib/stripe')

    mockUserFindUniqueOrThrow.mockResolvedValueOnce({
      stripeCustomerId: null,
    })

    const result = await getUserInvoices('user-1')
    expect(result).toEqual([])
    expect(mockInvoicesList).not.toHaveBeenCalled()
  })

  it('should return formatted invoices', async () => {
    const { getUserInvoices } = await import('../lib/stripe')

    mockUserFindUniqueOrThrow.mockResolvedValueOnce({
      stripeCustomerId: 'cus_123',
    })

    const mockInvoice = {
      id: 'in_test_123',
      number: 'INV-001',
      amount_paid: 2900,
      currency: 'eur',
      status: 'paid',
      created: 1706745600, // 2024-02-01
      invoice_pdf: 'https://stripe.com/invoice.pdf',
      hosted_invoice_url: 'https://invoice.stripe.com/123',
    }

    mockInvoicesList.mockResolvedValueOnce({
      data: [mockInvoice],
    })

    const result = await getUserInvoices('user-1')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('in_test_123')
    expect(result[0].amount).toBe(29) // 2900 / 100
    expect(result[0].currency).toBe('eur')
    expect(result[0].status).toBe('paid')
    expect(result[0].pdf).toBe('https://stripe.com/invoice.pdf')
  })
})

// ----------------------------------------------------------
// Tests : getPublicPlans
// ----------------------------------------------------------
describe('getPublicPlans', () => {
  it('should return 3 plans', () => {
    const plans = getPublicPlans()
    expect(plans).toHaveLength(3)
  })

  it('should have starter, pro, business plans', () => {
    const plans = getPublicPlans()
    const planIds = plans.map((p) => p.id)
    expect(planIds).toContain('starter')
    expect(planIds).toContain('pro')
    expect(planIds).toContain('business')
  })

  it('should mark pro as highlighted', () => {
    const plans = getPublicPlans()
    const proPlan = plans.find((p) => p.id === 'pro')
    expect(proPlan?.highlighted).toBe(true)
  })

  it('should have positive prices', () => {
    const plans = getPublicPlans()
    plans.forEach((plan) => {
      expect(plan.price).toBeGreaterThan(0)
    })
  })

  it('should include trialDays', () => {
    const plans = getPublicPlans()
    plans.forEach((plan) => {
      expect(plan.trialDays).toBe(14)
    })
  })

  it('should have email limits matching PLAN_LIMITS', () => {
    const plans = getPublicPlans()
    plans.forEach((plan) => {
      const expectedLimit = PLAN_LIMITS[plan.id as keyof typeof PLAN_LIMITS]?.emailsPerDay
      expect(plan.emailsPerDay).toBe(expectedLimit)
    })
  })
})

// ----------------------------------------------------------
// Tests : PLAN_LIMITS structure
// ----------------------------------------------------------
describe('PLAN_LIMITS', () => {
  it('should have all plans defined', () => {
    expect(PLAN_LIMITS.free).toBeDefined()
    expect(PLAN_LIMITS.starter).toBeDefined()
    expect(PLAN_LIMITS.pro).toBeDefined()
    expect(PLAN_LIMITS.business).toBeDefined()
  })

  it('should have free plan with 0 emails/day', () => {
    expect(PLAN_LIMITS.free.emailsPerDay).toBe(0)
  })

  it('should have increasing email limits by plan tier', () => {
    expect(PLAN_LIMITS.starter.emailsPerDay).toBeGreaterThan(0)
    expect(PLAN_LIMITS.pro.emailsPerDay).toBeGreaterThan(PLAN_LIMITS.starter.emailsPerDay)
    expect(PLAN_LIMITS.business.emailsPerDay).toBeGreaterThan(PLAN_LIMITS.pro.emailsPerDay)
  })

  it('should have features array for each plan', () => {
    Object.values(PLAN_LIMITS).forEach((plan) => {
      expect(Array.isArray(plan.features)).toBe(true)
    })
  })
})
