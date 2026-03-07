// ============================================================
// MailFlow — Emails transactionnels (Resend)
// Bienvenue, rappels de trial, notifications
// ============================================================

import { Resend } from 'resend'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'hello@mailflow.ai'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mailflow.ai'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

let resendClient: Resend | null = null
function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY!)
  }
  return resendClient
}

// ----------------------------------------------------------
// Email : Bienvenue après inscription
// ----------------------------------------------------------
export async function sendWelcomeEmail(user: { email: string; name?: string | null }) {
  const firstName = escapeHtml(user.name?.split(' ')[0] ?? 'là')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur MailFlow</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-flex;align-items:center;gap:8px;">
        <span style="font-size:24px;">✉️</span>
        <span style="font-size:22px;font-weight:800;color:#f5f5f5;">MailFlow</span>
      </div>
    </div>

    <!-- Card principale -->
    <div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:40px 32px;margin-bottom:24px;">
      <h1 style="color:#f5f5f5;font-size:28px;font-weight:800;margin:0 0 12px 0;line-height:1.3;">
        Bienvenue ${firstName} 👋
      </h1>
      <p style="color:#a0a0a0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">
        Ton compte MailFlow est activé. L'IA va maintenant trier tes emails automatiquement —
        tu n'auras plus jamais à fouiller dans ta boîte Gmail.
      </p>

      <!-- Étapes -->
      <div style="margin-bottom:32px;">
        <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:16px;">
          <div style="width:32px;height:32px;background:#1e3a5f;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:700;color:#60a5fa;">1</div>
          <div>
            <div style="color:#f5f5f5;font-weight:600;margin-bottom:4px;">Gmail connecté ✓</div>
            <div style="color:#6a6a6a;font-size:14px;">L'IA commence à trier tes nouveaux emails en temps réel.</div>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:16px;">
          <div style="width:32px;height:32px;background:#1e3a5f;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:700;color:#60a5fa;">2</div>
          <div>
            <div style="color:#f5f5f5;font-weight:600;margin-bottom:4px;">Configure tes catégories</div>
            <div style="color:#6a6a6a;font-size:14px;">Active/désactive les 6 catégories selon tes besoins.</div>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:16px;">
          <div style="width:32px;height:32px;background:#1e3a5f;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:700;color:#60a5fa;">3</div>
          <div>
            <div style="color:#f5f5f5;font-weight:600;margin-bottom:4px;">Reçois ton digest quotidien</div>
            <div style="color:#6a6a6a;font-size:14px;">Chaque matin, un résumé des emails importants de la veille.</div>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${APP_URL}/dashboard"
           style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:700;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
          Accéder à mon dashboard →
        </a>
      </div>
    </div>

    <!-- Info trial -->
    <div style="background:#1c2a1c;border:1px solid #2d4a2d;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="color:#4ade80;font-weight:600;font-size:14px;margin:0 0 6px 0;">
        🎁 Essai gratuit de 14 jours activé
      </p>
      <p style="color:#86efac;font-size:13px;margin:0;line-height:1.6;">
        Profite de toutes les fonctionnalités Pro gratuitement pendant 14 jours.
        Sans carte bancaire. Tu choisiras un plan seulement si tu veux continuer.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding-top:16px;border-top:1px solid #2a2a2a;">
      <p style="color:#6a6a6a;font-size:12px;line-height:1.8;margin:0;">
        Une question ? Réponds à cet email ou écris-nous à
        <a href="mailto:support@mailflow.ai" style="color:#60a5fa;">support@mailflow.ai</a>
        <br>
        <a href="${APP_URL}/privacy" style="color:#6a6a6a;">Confidentialité</a>
        &nbsp;·&nbsp;
        <a href="${APP_URL}/terms" style="color:#6a6a6a;">CGV</a>
        <br><br>
        © 2026 MailFlow — NodeIA
      </p>
    </div>

  </div>
</body>
</html>
  `.trim()

  try {
    const { error } = await getResend().emails.send({
      from: `MailFlow <${FROM_EMAIL}>`,
      to: user.email,
      subject: '🎉 Bienvenue sur MailFlow — ton IA email est activée',
      html,
    })
    if (error) {
      console.error('[Email] Welcome email failed:', error)
    }
  } catch (err) {
    // Non bloquant — l'utilisateur est quand même créé
    console.error('[Email] Welcome email error:', err)
  }
}

// ----------------------------------------------------------
// Email : Rappel fin de trial (J-3 ou J-1)
// ----------------------------------------------------------
export async function sendTrialReminderEmail(
  user: { email: string; name?: string | null },
  daysLeft: 1 | 3
) {
  const firstName = escapeHtml(user.name?.split(' ')[0] ?? 'là')
  const isUrgent = daysLeft === 1

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ton essai MailFlow se termine bientôt</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:40px;">
      <span style="font-size:22px;font-weight:800;color:#f5f5f5;">✉️ MailFlow</span>
    </div>

    <!-- Card -->
    <div style="background:#141414;border:1px solid ${isUrgent ? '#7f1d1d' : '#713f12'};border-radius:16px;padding:40px 32px;margin-bottom:24px;">
      <div style="font-size:40px;text-align:center;margin-bottom:16px;">${isUrgent ? '⏰' : '⏳'}</div>
      <h1 style="color:#f5f5f5;font-size:24px;font-weight:800;text-align:center;margin:0 0 12px 0;">
        ${isUrgent
    ? 'Dernière chance — ton essai se termine demain'
    : `Ton essai MailFlow se termine dans ${daysLeft} jours`}
      </h1>
      <p style="color:#a0a0a0;font-size:15px;line-height:1.7;text-align:center;margin:0 0 28px 0;">
        Bonjour ${firstName}, ton essai gratuit expire dans
        <strong style="color:#f5f5f5;">${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong>.
        Pour continuer à profiter du tri IA, choisis un plan.
      </p>

      <!-- Plans -->
      <div style="display:grid;gap:12px;margin-bottom:28px;">
        <div style="border:1px solid #2a2a2a;border-radius:10px;padding:16px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="color:#f5f5f5;font-weight:700;">Starter</div>
            <div style="color:#6a6a6a;font-size:13px;">100 emails/jour</div>
          </div>
          <div style="color:#f5f5f5;font-weight:800;font-size:18px;">9€/mois</div>
        </div>
        <div style="border:2px solid #2563eb;border-radius:10px;padding:16px;display:flex;justify-content:space-between;align-items:center;background:#0f1f3d;">
          <div>
            <div style="color:#f5f5f5;font-weight:700;">Pro ⭐ Populaire</div>
            <div style="color:#6a6a6a;font-size:13px;">500 emails/jour</div>
          </div>
          <div style="color:#f5f5f5;font-weight:800;font-size:18px;">29€/mois</div>
        </div>
        <div style="border:1px solid #2a2a2a;border-radius:10px;padding:16px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="color:#f5f5f5;font-weight:700;">Business</div>
            <div style="color:#6a6a6a;font-size:13px;">2000 emails/jour</div>
          </div>
          <div style="color:#f5f5f5;font-weight:800;font-size:18px;">79€/mois</div>
        </div>
      </div>

      <div style="text-align:center;">
        <a href="${APP_URL}/dashboard?tab=billing"
           style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
          Choisir mon plan maintenant →
        </a>
        <p style="color:#6a6a6a;font-size:12px;margin:12px 0 0 0;">
          Annulation à tout moment · Sans engagement
        </p>
      </div>
    </div>

    <div style="text-align:center;padding-top:16px;border-top:1px solid #2a2a2a;">
      <p style="color:#6a6a6a;font-size:12px;margin:0;line-height:1.8;">
        <a href="mailto:support@mailflow.ai" style="color:#60a5fa;">support@mailflow.ai</a>
        &nbsp;·&nbsp;
        <a href="${APP_URL}/privacy" style="color:#6a6a6a;">Confidentialité</a>
        &nbsp;·&nbsp; © 2026 MailFlow
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()

  const subject = isUrgent
    ? '⏰ Dernière chance — ton essai MailFlow se termine demain'
    : `⏳ Plus que ${daysLeft} jours d'essai MailFlow — continue sans interruption`

  try {
    const { error } = await getResend().emails.send({
      from: `MailFlow <${FROM_EMAIL}>`,
      to: user.email,
      subject,
      html,
    })
    if (error) {
      console.error(`[Email] Trial reminder (J-${daysLeft}) failed:`, error)
    }
  } catch (err) {
    console.error(`[Email] Trial reminder error:`, err)
  }
}

// ----------------------------------------------------------
// Email : Trial expiré (J+0) — dernier push vers la conversion
// ----------------------------------------------------------
export async function sendTrialExpiredEmail(user: { email: string; name?: string | null }) {
  const firstName = escapeHtml(user.name?.split(' ')[0] ?? 'là')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Ton essai MailFlow a expiré</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:800;color:#f5f5f5;">✉️ MailFlow</span>
    </div>

    <div style="background:#141414;border:1px solid #7f1d1d;border-radius:16px;padding:40px 32px;margin-bottom:24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">😔</div>
      <h1 style="color:#f5f5f5;font-size:24px;font-weight:800;margin:0 0 12px 0;">
        Ton essai gratuit est terminé, ${firstName}
      </h1>
      <p style="color:#a0a0a0;font-size:15px;line-height:1.7;margin:0 0 8px 0;">
        Ton accès au tri IA automatique vient d'expirer. Tes emails ne seront plus
        classifiés jusqu'à ce que tu choisisses un plan.
      </p>
      <p style="color:#a0a0a0;font-size:15px;line-height:1.7;margin:0 0 28px 0;">
        Tes données et statistiques sont toujours là — tu peux continuer là où tu s'étais arrêté.
      </p>
      <a href="${APP_URL}/dashboard?tab=billing"
         style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;font-size:16px;padding:14px 36px;border-radius:12px;text-decoration:none;margin-bottom:16px;">
        Choisir mon plan · À partir de 9€/mois →
      </a>
      <p style="color:#6a6a6a;font-size:12px;margin:8px 0 0 0;">Sans engagement · Annulation à tout moment</p>
    </div>

    <div style="background:#1c1c1c;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="color:#f5f5f5;font-weight:600;font-size:14px;margin:0 0 12px 0;">
        Ce que tu perds sur le plan Free :
      </p>
      <ul style="color:#a0a0a0;font-size:14px;margin:0;padding:0 0 0 20px;line-height:2;">
        <li>❌ Tri IA automatique de tes nouveaux emails</li>
        <li>❌ Labels Gmail automatiques</li>
        <li>❌ Digest quotidien par email</li>
        <li>❌ Agent IA conversationnel</li>
      </ul>
    </div>

    <div style="text-align:center;padding-top:16px;border-top:1px solid #2a2a2a;">
      <p style="color:#6a6a6a;font-size:12px;margin:0;line-height:1.8;">
        Une question ? <a href="mailto:support@mailflow.ai" style="color:#60a5fa;">support@mailflow.ai</a>
        &nbsp;·&nbsp; © 2026 MailFlow
      </p>
    </div>
  </div>
</body>
</html>`.trim()

  try {
    const { error } = await getResend().emails.send({
      from: `MailFlow <${FROM_EMAIL}>`,
      to: user.email,
      subject: '😔 Ton essai MailFlow est terminé — Continue le tri IA dès maintenant',
      html,
    })
    if (error) {
      console.error('[Email] Trial expired email failed:', error)
    }
  } catch (err) {
    console.error('[Email] Trial expired email error:', err)
  }
}

// ----------------------------------------------------------
// Email : Confirmation de souscription
// ----------------------------------------------------------
export async function sendSubscriptionConfirmationEmail(
  user: { email: string; name?: string | null },
  plan: 'starter' | 'pro' | 'business'
) {
  const firstName = escapeHtml(user.name?.split(' ')[0] ?? 'là')

  const planDetails: Record<string, { label: string; price: string; color: string; perks: string[] }> = {
    starter: {
      label: 'Starter',
      price: '9€/mois',
      color: '#2563eb',
      perks: ['Tri IA automatique (100 emails/jour)', 'Labels Gmail automatiques', 'Digest quotidien', '6 catégories intelligentes', 'Feedback loop IA'],
    },
    pro: {
      label: 'Pro',
      price: '29€/mois',
      color: '#7c3aed',
      perks: ['Tri de toute la boîte mail (50 000 emails)', 'Catégories personnalisées', 'Export CSV', 'Stats avancées', 'Priorité support'],
    },
    business: {
      label: 'Business',
      price: 'Sur devis',
      color: '#0891b2',
      perks: ['Tout Pro', 'Multi-comptes Gmail', 'Accès API', 'SLA 99.9%', 'Support prioritaire 24/7'],
    },
  }

  const details = planDetails[plan]

  const perksHtml = details.perks
    .map(
      (p) =>
        `<li style="padding:6px 0;color:#a0a0a0;font-size:14px;border-bottom:1px solid #1e1e1e;">
          <span style="color:#4ade80;margin-right:8px;">✓</span>${escapeHtml(p)}
        </li>`
    )
    .join('')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Abonnement MailFlow confirmé</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:800;color:#f5f5f5;">✉️ MailFlow</span>
    </div>

    <div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:40px 32px;margin-bottom:24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">🎉</div>
      <h1 style="color:#f5f5f5;font-size:26px;font-weight:800;margin:0 0 8px 0;">
        Abonnement ${escapeHtml(details.label)} activé !
      </h1>
      <p style="color:#a0a0a0;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
        Bonjour ${firstName}, ton abonnement <strong style="color:#f5f5f5;">MailFlow ${escapeHtml(details.label)}</strong>
        est maintenant actif. Le tri IA de tes emails continue sans interruption.
      </p>

      <div style="display:inline-block;background:${escapeHtml(details.color)}22;border:1px solid ${escapeHtml(details.color)}44;border-radius:10px;padding:10px 24px;margin-bottom:28px;">
        <span style="color:${escapeHtml(details.color)};font-weight:700;font-size:18px;">${escapeHtml(details.price)}</span>
      </div>

      <ul style="text-align:left;list-style:none;padding:0;margin:0 0 28px 0;border-top:1px solid #2a2a2a;border-radius:8px;overflow:hidden;">
        ${perksHtml}
      </ul>

      <a href="${APP_URL}/dashboard"
         style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Accéder à mon dashboard →
      </a>
    </div>

    <div style="background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:18px 24px;margin-bottom:24px;">
      <p style="color:#a0a0a0;font-size:13px;margin:0;line-height:1.7;">
        💡 <strong style="color:#f5f5f5;">Retrouve tes factures</strong> à tout moment dans
        <a href="${APP_URL}/dashboard?tab=billing" style="color:#60a5fa;">Dashboard → Facturation</a>.
        Tu peux modifier ou annuler ton abonnement depuis le portail Stripe.
      </p>
    </div>

    <div style="text-align:center;padding-top:16px;border-top:1px solid #2a2a2a;">
      <p style="color:#6a6a6a;font-size:12px;margin:0;line-height:1.8;">
        Une question ? <a href="mailto:support@mailflow.ai" style="color:#60a5fa;">support@mailflow.ai</a>
        &nbsp;·&nbsp;
        <a href="${APP_URL}/privacy" style="color:#6a6a6a;">Confidentialité</a>
        &nbsp;·&nbsp; © 2026 MailFlow
      </p>
    </div>
  </div>
</body>
</html>`.trim()

  try {
    const { error } = await getResend().emails.send({
      from: `MailFlow <${FROM_EMAIL}>`,
      to: user.email,
      subject: `🎉 Abonnement MailFlow ${details.label} activé — merci !`,
      html,
    })
    if (error) console.error('[Email] Subscription confirmation failed:', error)
  } catch (err) {
    console.error('[Email] Subscription confirmation error:', err)
  }
}

// ----------------------------------------------------------
// Email : Résiliation d'abonnement
// ----------------------------------------------------------
export async function sendCancellationEmail(user: { email: string; name?: string | null }) {
  const firstName = escapeHtml(user.name?.split(' ')[0] ?? 'là')

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Ton abonnement MailFlow est résilié</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:800;color:#f5f5f5;">✉️ MailFlow</span>
    </div>

    <div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:40px 32px;margin-bottom:24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">👋</div>
      <h1 style="color:#f5f5f5;font-size:24px;font-weight:800;margin:0 0 12px 0;">
        Ton abonnement a été résilié
      </h1>
      <p style="color:#a0a0a0;font-size:15px;line-height:1.7;margin:0 0 8px 0;">
        Bonjour ${firstName}, la résiliation de ton abonnement MailFlow est confirmée.
      </p>
      <p style="color:#a0a0a0;font-size:15px;line-height:1.7;margin:0 0 28px 0;">
        Ton compte repasse en plan <strong style="color:#f5f5f5;">Free</strong> — tes données et
        statistiques sont conservées. Tu pourras te réabonner à tout moment.
      </p>

      <div style="background:#1c1c1c;border-radius:12px;padding:18px 20px;margin-bottom:28px;text-align:left;">
        <p style="color:#f5f5f5;font-weight:600;font-size:14px;margin:0 0 10px 0;">
          Ce qui change avec le plan Free :
        </p>
        <ul style="color:#a0a0a0;font-size:13px;margin:0;padding:0 0 0 4px;list-style:none;line-height:2.2;">
          <li>❌ Tri IA des nouveaux emails</li>
          <li>❌ Labels Gmail automatiques</li>
          <li>❌ Digest quotidien</li>
          <li>❌ Agent IA conversationnel</li>
          <li>✅ Dashboard et statistiques</li>
          <li>✅ Historique de tes emails traités</li>
        </ul>
      </div>

      <a href="${APP_URL}/dashboard?tab=billing"
         style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:12px;">
        Se réabonner →
      </a>
      <p style="color:#6a6a6a;font-size:12px;margin:4px 0 0 0;">Sans engagement · Annulation à tout moment</p>
    </div>

    <div style="background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:18px 24px;margin-bottom:24px;">
      <p style="color:#a0a0a0;font-size:13px;margin:0;line-height:1.7;">
        💬 <strong style="color:#f5f5f5;">Tu as une remarque ou une suggestion ?</strong>
        Réponds directement à cet email — on lit tous les feedbacks.
      </p>
    </div>

    <div style="text-align:center;padding-top:16px;border-top:1px solid #2a2a2a;">
      <p style="color:#6a6a6a;font-size:12px;margin:0;line-height:1.8;">
        <a href="mailto:support@mailflow.ai" style="color:#60a5fa;">support@mailflow.ai</a>
        &nbsp;·&nbsp;
        <a href="${APP_URL}/privacy" style="color:#6a6a6a;">Confidentialité</a>
        &nbsp;·&nbsp; © 2026 MailFlow
      </p>
    </div>
  </div>
</body>
</html>`.trim()

  try {
    const { error } = await getResend().emails.send({
      from: `MailFlow <${FROM_EMAIL}>`,
      to: user.email,
      subject: '👋 Résiliation confirmée — Ton abonnement MailFlow est annulé',
      html,
    })
    if (error) console.error('[Email] Cancellation email failed:', error)
  } catch (err) {
    console.error('[Email] Cancellation email error:', err)
  }
}

// ----------------------------------------------------------
// Email : Paiement échoué
// ----------------------------------------------------------
export async function sendPaymentFailedEmail(
  user: { email: string; name?: string | null },
  amount: number,
  currency: string
) {
  const firstName = escapeHtml(user.name?.split(' ')[0] ?? 'là')
  const amountFormatted = `${(amount / 100).toFixed(2).replace('.', ',')} ${currency.toUpperCase()}`

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Problème de paiement MailFlow</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:800;color:#f5f5f5;">✉️ MailFlow</span>
    </div>

    <div style="background:#141414;border:1px solid #7f1d1d;border-radius:16px;padding:40px 32px;margin-bottom:24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
      <h1 style="color:#f5f5f5;font-size:24px;font-weight:800;margin:0 0 12px 0;">
        Problème avec ton paiement
      </h1>
      <p style="color:#a0a0a0;font-size:15px;line-height:1.7;margin:0 0 6px 0;">
        Bonjour ${firstName}, le paiement de
        <strong style="color:#f5f5f5;">${escapeHtml(amountFormatted)}</strong>
        pour ton abonnement MailFlow a échoué.
      </p>
      <p style="color:#a0a0a0;font-size:14px;line-height:1.7;margin:0 0 28px 0;">
        Stripe va automatiquement retenter le prélèvement dans les prochains jours.
        Pour éviter toute interruption de service, mets à jour ta carte bancaire maintenant.
      </p>

      <a href="${APP_URL}/dashboard?tab=billing"
         style="display:inline-block;background:#dc2626;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:12px;">
        Mettre à jour ma carte →
      </a>
      <p style="color:#6a6a6a;font-size:12px;margin:4px 0 0 0;">
        Tu seras redirigé vers le portail Stripe sécurisé
      </p>
    </div>

    <div style="background:#1c1c1c;border-radius:12px;padding:18px 24px;margin-bottom:24px;">
      <p style="color:#a0a0a0;font-size:13px;margin:0;line-height:1.7;">
        ❓ <strong style="color:#f5f5f5;">Besoin d'aide ?</strong>
        Contacte-nous à
        <a href="mailto:support@mailflow.ai" style="color:#60a5fa;">support@mailflow.ai</a>
        — on répond sous 24h.
      </p>
    </div>

    <div style="text-align:center;padding-top:16px;border-top:1px solid #2a2a2a;">
      <p style="color:#6a6a6a;font-size:12px;margin:0;line-height:1.8;">
        <a href="${APP_URL}/privacy" style="color:#6a6a6a;">Confidentialité</a>
        &nbsp;·&nbsp; © 2026 MailFlow
      </p>
    </div>
  </div>
</body>
</html>`.trim()

  try {
    const { error } = await getResend().emails.send({
      from: `MailFlow <${FROM_EMAIL}>`,
      to: user.email,
      subject: '⚠️ Paiement échoué — Mets à jour ta carte MailFlow',
      html,
    })
    if (error) console.error('[Email] Payment failed email failed:', error)
  } catch (err) {
    console.error('[Email] Payment failed email error:', err)
  }
}
