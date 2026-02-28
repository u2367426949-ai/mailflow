// ============================================================
// MailFlow — Route API : Webhooks Stripe
// POST /api/webhooks/stripe
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient, syncSubscriptionFromStripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'

// ----------------------------------------------------------
// POST — Recevoir et traiter les événements Stripe
// ----------------------------------------------------------
export async function POST(request: NextRequest) {
  const stripe = getStripeClient()

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[Stripe Webhook] Invalid signature:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Vérifier l'idempotence — éviter de traiter le même événement deux fois
  const existingEvent = await db.stripeEvent.findUnique({
    where: { stripeEventId: event.id },
  })

  if (existingEvent?.processed) {
    console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping`)
    return NextResponse.json({ received: true, skipped: true })
  }

  // Enregistrer l'événement en DB
  await db.stripeEvent.upsert({
    where: { stripeEventId: event.id },
    update: { processed: false },
    create: {
      stripeEventId: event.id,
      type: event.type,
      data: event.data as any,
      processed: false,
    },
  })

  try {
    await handleStripeEvent(event)

    // Marquer comme traité
    await db.stripeEvent.update({
      where: { stripeEventId: event.id },
      data: { processed: true },
    })

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error(`[Stripe Webhook] Error handling event ${event.type}:`, err)
    return NextResponse.json(
      { error: 'Webhook handling failed', event: event.type },
      { status: 500 }
    )
  }
}

// ----------------------------------------------------------
// Dispatcher d'événements Stripe
// ----------------------------------------------------------
async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  console.log(`[Stripe Webhook] Processing event: ${event.type}`)

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice)
      break

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
      break

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
  }
}

// ----------------------------------------------------------
// checkout.session.completed
// ----------------------------------------------------------
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (!customerId || !subscriptionId) return

  // Récupérer les détails de l'abonnement
  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0]?.price.id ?? ''
  const trialEnd = subscription.trial_end

  await syncSubscriptionFromStripe(
    customerId,
    subscriptionId,
    subscription.status,
    priceId,
    trialEnd
  )

  console.log(`[Stripe Webhook] Checkout completed for customer ${customerId}`)
}

// ----------------------------------------------------------
// customer.subscription.updated / created
// ----------------------------------------------------------
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price.id ?? ''
  const trialEnd = subscription.trial_end

  await syncSubscriptionFromStripe(
    customerId,
    subscription.id,
    subscription.status,
    priceId,
    trialEnd
  )

  console.log(
    `[Stripe Webhook] Subscription updated: ${subscription.id} (status: ${subscription.status})`
  )
}

// ----------------------------------------------------------
// customer.subscription.deleted
// ----------------------------------------------------------
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string

  // Rétrograder vers free
  const user = await db.user.findFirst({
    where: { stripeCustomerId: customerId },
  })

  if (!user) return

  await db.user.update({
    where: { id: user.id },
    data: {
      plan: 'free',
      stripeSubscriptionId: null,
      trialEndsAt: null,
    },
  })

  console.log(`[Stripe Webhook] Subscription deleted for customer ${customerId}, downgraded to free`)
}

// ----------------------------------------------------------
// invoice.paid
// ----------------------------------------------------------
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // Logger simplement le paiement
  console.log(
    `[Stripe Webhook] Invoice paid: ${invoice.id} (${invoice.amount_paid / 100} ${invoice.currency})`
  )
}

// ----------------------------------------------------------
// invoice.payment_failed
// ----------------------------------------------------------
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string

  const user = await db.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true, email: true, name: true },
  })

  if (!user) return

  // TODO: Envoyer un email de notification via Resend
  console.warn(
    `[Stripe Webhook] Payment failed for user ${user.email} - invoice ${invoice.id}`
  )
}
