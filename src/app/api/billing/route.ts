// ============================================================
// MailFlow — Route API : Billing Stripe
// POST /api/billing/checkout — créer une session checkout
// POST /api/billing/portal — portail client Stripe
// GET  /api/billing/plans — liste des plans
// GET  /api/billing/invoices — factures de l'utilisateur
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  createCheckoutSession,
  createBillingPortalSession,
  getUserInvoices,
  getPublicPlans,
} from '@/lib/stripe'
import { getUserIdFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

// ----------------------------------------------------------
// POST — Créer une session Stripe Checkout
// Body: { action: 'checkout', plan: 'starter'|'pro'|'business' }
// Body: { action: 'portal' }
// ----------------------------------------------------------
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { action?: string; plan?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action } = body

  // --- Créer une session checkout ---
  if (action === 'checkout' || (!action && body.plan)) {
    const plan = body.plan as 'starter' | 'pro' | 'business'

    if (!plan || !['starter', 'pro', 'business'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be one of: starter, pro, business' },
        { status: 400 }
      )
    }

    try {
      const { url, sessionId } = await createCheckoutSession({
        userId,
        plan,
        successUrl: `${APP_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${APP_URL}/dashboard?checkout=canceled`,
        trialDays: 14,
      })

      return NextResponse.json({ url, sessionId })
    } catch (err) {
      console.error('[Billing] Checkout error:', err)
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }
  }

  // --- Créer une session portail client ---
  if (action === 'portal') {
    try {
      const { url } = await createBillingPortalSession(
        userId,
        `${APP_URL}/dashboard?tab=billing`
      )
      return NextResponse.json({ url })
    } catch (err) {
      console.error('[Billing] Portal error:', err)
      return NextResponse.json({ error: 'Failed to create billing portal session' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// ----------------------------------------------------------
// GET — Plans publics ou factures utilisateur
// Query: ?type=plans|invoices
// ----------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'plans'

  if (type === 'plans') {
    return NextResponse.json({ plans: getPublicPlans() })
  }

  if (type === 'invoices') {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const invoices = await getUserInvoices(userId)
      return NextResponse.json({ invoices })
    } catch (err) {
      console.error('[Billing] Invoices error:', err)
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Invalid type. Use: plans, invoices' }, { status: 400 })
}
