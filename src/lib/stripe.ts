// ============================================================
// MailFlow — Client Stripe
// Création checkout, gestion abonnements, portail client
// ============================================================

import Stripe from 'stripe'
import { db } from './db'
import type { Plan } from '@prisma/client'

// ----------------------------------------------------------
// Client Stripe singleton
// ----------------------------------------------------------
let stripeClient: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
      typescript: true,
    })
  }
  return stripeClient
}

// ----------------------------------------------------------
// Mapping plan → price ID (lazy to avoid build-time crashes)
// ----------------------------------------------------------
export function getPlanPriceMap(): Record<string, string> {
  return {
    starter: process.env.STRIPE_STARTER_PRICE_ID ?? '',
    pro: process.env.STRIPE_PRO_PRICE_ID ?? '',
    business: process.env.STRIPE_BUSINESS_PRICE_ID ?? '',
  }
}

export const PLAN_PRICE_MAP: Record<string, string> = {
  starter: '',
  pro: '',
  business: '',
}

// ----------------------------------------------------------
// Mapping plan → limits
// ----------------------------------------------------------
export const PLAN_LIMITS: Record<
  Plan,
  { emailsPerDay: number; features: string[] }
> = {
  free: {
    emailsPerDay: 0,
    features: ['Dashboard', 'Stats basiques'],
  },
  starter: {
    emailsPerDay: 100,
    features: [
      'Tri IA',
      'Labels Gmail',
      'Digest quotidien',
      '6 catégories',
      'Feedback loop',
    ],
  },
  pro: {
    emailsPerDay: 500,
    features: [
      'Tout Starter',
      'Catégories personnalisées',
      'Export CSV',
      'Priorité support',
    ],
  },
  business: {
    emailsPerDay: 2000,
    features: [
      'Tout Pro',
      'API access',
      'Multi-comptes',
      'SLA 99.9%',
      'Onboarding dédié',
    ],
  },
}

// ----------------------------------------------------------
// Créer ou récupérer un customer Stripe
// ----------------------------------------------------------
export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const stripe = getStripeClient()

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, name: true },
  })

  if (user.stripeCustomerId) {
    return user.stripeCustomerId
  }

  // Créer un nouveau customer
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId },
  })

  // Sauvegarder en DB
  await db.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}

// ----------------------------------------------------------
// Créer une session Stripe Checkout
// ----------------------------------------------------------
export interface CreateCheckoutOptions {
  userId: string
  plan: 'starter' | 'pro' | 'business'
  successUrl: string
  cancelUrl: string
  trialDays?: number
}

export async function createCheckoutSession(
  options: CreateCheckoutOptions
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripeClient()

  const { userId, plan, successUrl, cancelUrl, trialDays = 14 } = options

  const priceId = getPlanPriceMap()[plan]
  if (!priceId) {
    throw new Error(`Invalid plan: ${plan}`)
  }

  const customerId = await getOrCreateStripeCustomer(userId)

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    subscription_data: {
      trial_period_days: trialDays,
      metadata: { userId, plan },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, plan },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  })

  if (!session.url) {
    throw new Error('Failed to create Stripe checkout session')
  }

  return { url: session.url, sessionId: session.id }
}

// ----------------------------------------------------------
// Créer une session Stripe Billing Portal
// ----------------------------------------------------------
export async function createBillingPortalSession(
  userId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const stripe = getStripeClient()

  const customerId = await getOrCreateStripeCustomer(userId)

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return { url: session.url }
}

// ----------------------------------------------------------
// Récupérer les factures d'un utilisateur
// ----------------------------------------------------------
export async function getUserInvoices(userId: string) {
  const stripe = getStripeClient()

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })

  if (!user.stripeCustomerId) {
    return []
  }

  const invoices = await stripe.invoices.list({
    customer: user.stripeCustomerId,
    limit: 24,
  })

  return invoices.data.map((inv) => ({
    id: inv.id,
    number: inv.number,
    amount: inv.amount_paid / 100,
    currency: inv.currency,
    status: inv.status,
    date: new Date(inv.created * 1000),
    pdf: inv.invoice_pdf,
    hostedUrl: inv.hosted_invoice_url,
  }))
}

// ----------------------------------------------------------
// Synchroniser l'abonnement Stripe avec notre DB
// ----------------------------------------------------------
export async function syncSubscriptionFromStripe(
  customerId: string,
  subscriptionId: string,
  status: string,
  priceId: string,
  trialEnd: number | null
): Promise<void> {
  const user = await db.user.findFirst({
    where: { stripeCustomerId: customerId },
  })

  if (!user) {
    console.error(`[Stripe] No user found for customer ${customerId}`)
    return
  }

  // Déterminer le plan depuis le price ID
  let plan: Plan = 'free'
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) plan = 'starter'
  else if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = 'pro'
  else if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) plan = 'business'

  // Si l'abonnement est annulé ou inactif → free
  if (['canceled', 'unpaid', 'incomplete_expired'].includes(status)) {
    plan = 'free'
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      plan,
      stripeSubscriptionId: subscriptionId,
      trialEndsAt: trialEnd ? new Date(trialEnd * 1000) : null,
    },
  })
}

// ----------------------------------------------------------
// Vérifier si un utilisateur peut utiliser une fonctionnalité
// ----------------------------------------------------------
export function canUseFeature(plan: Plan, emailsProcessedToday: number): boolean {
  if (plan === 'free') return false

  const limit = PLAN_LIMITS[plan].emailsPerDay
  return emailsProcessedToday < limit
}

// ----------------------------------------------------------
// Construire les plans publics (pour la landing page)
// ----------------------------------------------------------
export function getPublicPlans() {
  return [
    {
      id: 'starter',
      name: 'Starter',
      price: 9,
      currency: 'EUR',
      interval: 'month',
      emailsPerDay: 100,
      trialDays: 14,
      features: PLAN_LIMITS.starter.features,
      highlighted: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 29,
      currency: 'EUR',
      interval: 'month',
      emailsPerDay: 500,
      trialDays: 14,
      features: PLAN_LIMITS.pro.features,
      highlighted: true,
    },
    {
      id: 'business',
      name: 'Business',
      price: 79,
      currency: 'EUR',
      interval: 'month',
      emailsPerDay: 2000,
      trialDays: 14,
      features: PLAN_LIMITS.business.features,
      highlighted: false,
    },
  ]
}
