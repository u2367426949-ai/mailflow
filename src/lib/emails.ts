// ============================================================
// MailFlow — Emails transactionnels (Resend)
// Bienvenue, rappels de trial, notifications
// ============================================================

import { Resend } from 'resend'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'hello@mailflow.ai'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mailflow.ai'

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
  const firstName = user.name?.split(' ')[0] ?? 'là'

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
  const firstName = user.name?.split(' ')[0] ?? 'là'
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
