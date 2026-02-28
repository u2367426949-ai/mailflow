// ============================================================
// MailFlow — Politique de confidentialité (RGPD)
// ============================================================

import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Politique de confidentialité — MailFlow',
  description: 'Comment MailFlow collecte, utilise et protège vos données personnelles.',
}

export default function PrivacyPage() {
  const lastUpdated = '28 février 2026'

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-[#f5f5f5]">MailFlow</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#f5f5f5] mb-3">
            Politique de confidentialité
          </h1>
          <p className="text-[#6a6a6a] text-sm">Dernière mise à jour : {lastUpdated}</p>
        </div>

        <div className="prose-custom space-y-10">

          {/* Intro */}
          <Section title="1. Qui sommes-nous ?">
            <p>
              MailFlow est un service SaaS édité par <strong>NodeIA</strong>, dont le site est accessible à l'adresse{' '}
              <a href="https://mailflow.ai" className="text-blue-400 hover:underline">mailflow.ai</a>.
            </p>
            <p>
              Nous prenons la protection de vos données personnelles très au sérieux et respectons la réglementation
              européenne en vigueur (RGPD — Règlement UE 2016/679).
            </p>
            <p>
              <strong>Contact DPO :</strong>{' '}
              <a href="mailto:privacy@mailflow.ai" className="text-blue-400 hover:underline">
                privacy@mailflow.ai
              </a>
            </p>
          </Section>

          {/* Données collectées */}
          <Section title="2. Données collectées">
            <p>Nous collectons uniquement les données nécessaires au fonctionnement du service :</p>
            <Table
              headers={['Donnée', 'Source', 'Finalité']}
              rows={[
                ['Adresse email', 'Google OAuth', 'Identification du compte'],
                ['Nom et avatar', 'Google OAuth', 'Personnalisation de l\'interface'],
                ['Google ID', 'Google OAuth', 'Authentification unique'],
                ['Tokens OAuth (chiffrés AES-256)', 'Google OAuth', 'Accès à l\'API Gmail'],
                ['Métadonnées des emails (expéditeur, objet, extrait)', 'API Gmail', 'Classification IA'],
                ['Catégorie et score de confiance IA', 'OpenAI GPT-4o-mini', 'Tri automatique'],
                ['Feedback utilisateur', 'Dashboard', 'Amélioration de la précision'],
                ['Informations de paiement', 'Stripe (tokenisé)', 'Gestion de l\'abonnement'],
                ['Données de navigation (logs)', 'Vercel', 'Sécurité et débogage'],
              ]}
            />
            <Note>
              ⚠️ MailFlow <strong>n'accède jamais au corps complet de vos emails</strong>. Seuls l'expéditeur,
              le sujet et un court extrait (snippet) sont traités pour la classification.
            </Note>
          </Section>

          {/* Base légale */}
          <Section title="3. Base légale du traitement">
            <ul>
              <li>
                <strong>Exécution du contrat</strong> (art. 6.1.b RGPD) — Traitement des emails, classification IA,
                gestion du compte.
              </li>
              <li>
                <strong>Consentement explicite</strong> (art. 6.1.a RGPD) — Connexion OAuth Google, envoi du digest
                quotidien.
              </li>
              <li>
                <strong>Intérêt légitime</strong> (art. 6.1.f RGPD) — Sécurité, lutte contre la fraude, amélioration
                du service.
              </li>
              <li>
                <strong>Obligation légale</strong> (art. 6.1.c RGPD) — Conservation des données de facturation.
              </li>
            </ul>
          </Section>

          {/* Sous-traitants */}
          <Section title="4. Sous-traitants et transferts de données">
            <Table
              headers={['Service', 'Pays', 'Rôle', 'Garanties']}
              rows={[
                ['Vercel', 'USA / UE', 'Hébergement et déploiement', 'DPA + SCCs'],
                ['Neon / Supabase', 'UE', 'Base de données PostgreSQL', 'Hébergement EU'],
                ['OpenAI', 'USA', 'Classification IA (GPT-4o-mini)', 'DPA + SCCs'],
                ['Stripe', 'USA / UE', 'Paiement et facturation', 'DPA + SCCs'],
                ['Resend', 'USA', 'Envoi des digests email', 'DPA + SCCs'],
                ['Upstash', 'USA / UE', 'Rate limiting (Redis)', 'DPA + SCCs'],
              ]}
            />
            <p>
              Les transferts vers des pays tiers (USA) sont encadrés par des Clauses Contractuelles Types (SCCs)
              approuvées par la Commission Européenne.
            </p>
          </Section>

          {/* Durée de conservation */}
          <Section title="5. Durée de conservation">
            <ul>
              <li><strong>Données de compte</strong> — Conservées pendant la durée de l'abonnement + 30 jours après
                la résiliation.</li>
              <li><strong>Métadonnées d'emails</strong> — Conservées 12 mois glissants.</li>
              <li><strong>Données de facturation</strong> — 10 ans (obligation légale).</li>
              <li><strong>Logs de sécurité</strong> — 90 jours.</li>
            </ul>
          </Section>

          {/* Droits */}
          <Section title="6. Vos droits RGPD">
            <p>Vous disposez des droits suivants sur vos données personnelles :</p>
            <ul>
              <li><strong>Droit d'accès</strong> — Obtenir une copie de vos données (art. 15)</li>
              <li><strong>Droit de rectification</strong> — Corriger des données inexactes (art. 16)</li>
              <li><strong>Droit à l'effacement</strong> — Supprimer votre compte et vos données (art. 17)</li>
              <li><strong>Droit à la portabilité</strong> — Exporter vos données en JSON/CSV (art. 20)</li>
              <li><strong>Droit d'opposition</strong> — S'opposer à certains traitements (art. 21)</li>
              <li><strong>Droit à la limitation</strong> — Suspendre le traitement de vos données (art. 18)</li>
            </ul>
            <p>
              Pour exercer ces droits, envoyez un email à{' '}
              <a href="mailto:privacy@mailflow.ai" className="text-blue-400 hover:underline">
                privacy@mailflow.ai
              </a>
              . Nous répondons dans un délai maximum de 30 jours.
            </p>
            <p>
              Vous avez également le droit de déposer une réclamation auprès de la{' '}
              <a
                href="https://www.cnil.fr/fr/plaintes"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                CNIL
              </a>
              .
            </p>
          </Section>

          {/* Sécurité */}
          <Section title="7. Sécurité des données">
            <ul>
              <li>Tokens OAuth Google chiffrés en <strong>AES-256</strong> avant stockage en base.</li>
              <li>Communications chiffrées en <strong>TLS 1.3</strong> (HTTPS forcé).</li>
              <li>Accès à la base de données restreint au réseau interne.</li>
              <li>Audits de sécurité réguliers.</li>
              <li>Aucun mot de passe utilisateur stocké (authentification OAuth uniquement).</li>
            </ul>
          </Section>

          {/* Cookies */}
          <Section title="8. Cookies">
            <p>MailFlow utilise uniquement des cookies strictement nécessaires au fonctionnement du service :</p>
            <Table
              headers={['Cookie', 'Durée', 'Finalité']}
              rows={[
                ['mailflow_session', 'Session (7j)', 'Maintien de la session authentifiée (JWT httpOnly)'],
                ['oauth_state', '10 minutes', 'Protection CSRF lors de la connexion OAuth Google'],
              ]}
            />
            <p>Aucun cookie de tracking ou publicitaire n'est utilisé.</p>
          </Section>

          {/* Modifications */}
          <Section title="9. Modifications de cette politique">
            <p>
              Nous pouvons mettre à jour cette politique de confidentialité. En cas de modification substantielle,
              vous serez notifié par email au moins 30 jours avant l'entrée en vigueur des changements.
            </p>
          </Section>

          {/* Contact */}
          <Section title="10. Contact">
            <p>Pour toute question relative à cette politique :</p>
            <ul>
              <li>Email : <a href="mailto:privacy@mailflow.ai" className="text-blue-400 hover:underline">privacy@mailflow.ai</a></li>
              <li>Support : <a href="mailto:support@mailflow.ai" className="text-blue-400 hover:underline">support@mailflow.ai</a></li>
            </ul>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2a2a2a] py-8 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#6a6a6a]">
          <span>© 2026 MailFlow — NodeIA</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-blue-400">Confidentialité</Link>
            <Link href="/terms" className="hover:text-[#a0a0a0] transition-colors">CGV</Link>
            <a href="mailto:support@mailflow.ai" className="hover:text-[#a0a0a0] transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ----------------------------------------------------------
// Composants locaux
// ----------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-[#f5f5f5] mb-4 pb-2 border-b border-[#2a2a2a]">{title}</h2>
      <div className="space-y-3 text-[#a0a0a0] text-sm leading-relaxed [&_strong]:text-[#f5f5f5] [&_a]:text-blue-400 [&_a:hover]:underline [&_ul]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#2a2a2a] mt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a2a2a] bg-[#141414]">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#6a6a6a] uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#141414] transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-[#a0a0a0]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 rounded-lg border border-amber-800/40 bg-amber-950/20 text-amber-300 text-sm leading-relaxed mt-3">
      {children}
    </div>
  )
}
