// ============================================================
// MailFlow — Conditions Générales de Vente et d'Utilisation
// ============================================================

import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Conditions Générales — MailFlow',
  description: 'Conditions générales de vente et d\'utilisation du service MailFlow.',
}

export default function TermsPage() {
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
            Conditions Générales de Vente et d&apos;Utilisation
          </h1>
          <p className="text-[#6a6a6a] text-sm">Dernière mise à jour : {lastUpdated}</p>
        </div>

        <div className="space-y-10">

          <Section title="1. Présentation du service">
            <p>
              MailFlow est un service SaaS de tri automatique d&apos;emails par intelligence artificielle,
              édité par <strong>NodeIA</strong> (ci-après &quot;l&apos;Éditeur&quot;).
            </p>
            <p>
              En accédant au service MailFlow et en créant un compte, vous acceptez sans réserve les présentes
              Conditions Générales de Vente et d&apos;Utilisation (CGVU). Si vous n&apos;acceptez pas ces conditions,
              vous ne devez pas utiliser le service.
            </p>
            <InfoBox>
              Pour toute question : <a href="mailto:support@mailflow.ai" className="text-blue-400 hover:underline">support@mailflow.ai</a>
            </InfoBox>
          </Section>

          <Section title="2. Accès au service">
            <p>MailFlow est accessible :</p>
            <ul>
              <li>Aux personnes physiques majeures (18 ans et plus)</li>
              <li>Aux personnes morales représentées par un représentant légal autorisé</li>
              <li>Disposant d&apos;un compte Google Gmail valide</li>
            </ul>
            <p>
              L&apos;inscription nécessite la connexion via OAuth2 Google. Aucun mot de passe n&apos;est créé ni
              stocké par MailFlow.
            </p>
          </Section>

          <Section title="3. Plans et tarification">
            <p>MailFlow propose les plans suivants :</p>
            <Table
              headers={['Plan', 'Prix', 'Emails/jour', 'Fonctionnalités principales']}
              rows={[
                ['Free', 'Gratuit', '—', 'Dashboard lecture seule, pas de tri IA actif'],
                ['Starter', '9 € / mois', '100', 'Tri IA, labels Gmail, digest quotidien'],
                ['Pro', '29 € / mois', '500', 'Tout Starter + catégories perso, stats avancées, export CSV'],
                ['Business', '79 € / mois', '2 000', 'Tout Pro + multi-comptes, accès API, SLA 99.9%'],
              ]}
            />
            <p>
              Tous les prix sont indiqués en euros TTC. La TVA applicable est celle en vigueur dans votre pays
              de résidence (directive européenne 2006/112/CE).
            </p>
            <p>
              <strong>Période d&apos;essai gratuite :</strong> 14 jours sans engagement sur les plans payants.
              Aucune carte bancaire requise pour démarrer l&apos;essai. Le paiement n&apos;est prélevé qu&apos;à
              l&apos;issue de la période d&apos;essai si vous choisissez de continuer.
            </p>
          </Section>

          <Section title="4. Facturation et paiement">
            <p>
              Les paiements sont gérés par <strong>Stripe</strong>, prestataire de services de paiement certifié
              PCI-DSS. MailFlow ne stocke jamais vos coordonnées bancaires.
            </p>
            <ul>
              <li>
                <strong>Abonnement mensuel :</strong> Prélèvement automatique le même jour chaque mois à la date
                de souscription.
              </li>
              <li>
                <strong>Abonnement annuel :</strong> Prélèvement annuel avec réduction de 20% par rapport au tarif
                mensuel.
              </li>
              <li>
                <strong>Échec de paiement :</strong> En cas d&apos;échec, vous serez notifié par email. Sans
                régularisation sous 7 jours, votre compte basculera en plan Free.
              </li>
            </ul>
            <p>
              Les factures sont émises par Stripe et accessibles dans votre espace client via le portail de
              facturation.
            </p>
          </Section>

          <Section title="5. Résiliation et remboursement">
            <ul>
              <li>
                <strong>Résiliation à tout moment :</strong> Vous pouvez annuler votre abonnement à tout moment
                depuis le portail de facturation dans votre dashboard. La résiliation prend effet à la fin de la
                période de facturation en cours.
              </li>
              <li>
                <strong>Politique de remboursement :</strong> Aucun remboursement prorata n&apos;est accordé pour
                les jours restants. Toutefois, en cas de problème technique majeur imputable à MailFlow (indisponibilité
                &gt; 24h consécutives), un avoir pourra être accordé sur demande.
              </li>
              <li>
                <strong>Droit de rétractation :</strong> Conformément à l&apos;article L221-28 du Code de la
                consommation, le droit de rétractation de 14 jours ne s&apos;applique pas aux services numériques
                dont l&apos;exécution a commencé avec votre accord. La période d&apos;essai gratuite remplace ce droit.
              </li>
            </ul>
          </Section>

          <Section title="6. Utilisation acceptable">
            <p>Vous vous engagez à ne pas utiliser MailFlow pour :</p>
            <ul>
              <li>Toute activité illégale ou contraire à l&apos;ordre public</li>
              <li>Le spam, le phishing ou toute forme de fraude</li>
              <li>Contourner les limites techniques du service (rate limiting, quotas)</li>
              <li>Revendre ou sublicencier l&apos;accès au service à des tiers</li>
              <li>Tenter d&apos;accéder aux données d&apos;autres utilisateurs</li>
              <li>Effectuer du reverse engineering du service</li>
            </ul>
            <p>
              Toute violation entraîne la suspension immédiate du compte sans remboursement.
            </p>
          </Section>

          <Section title="7. Disponibilité du service (SLA)">
            <Table
              headers={['Plan', 'SLA garanti', 'Support', 'Temps de réponse']}
              rows={[
                ['Free / Starter', 'Meilleur effort', 'Email', '72h ouvrées'],
                ['Pro', '99.5% / mois', 'Email prioritaire', '24h ouvrées'],
                ['Business', '99.9% / mois', 'Email + Chat 24/7', '4h'],
              ]}
            />
            <p>
              Les opérations de maintenance programmées sont annoncées 48h à l&apos;avance par email et ne comptent
              pas dans le calcul du SLA.
            </p>
          </Section>

          <Section title="8. Propriété intellectuelle">
            <p>
              MailFlow et l&apos;ensemble de ses composants (code, design, marque, algorithmes) sont la propriété
              exclusive de NodeIA. Toute reproduction, même partielle, sans autorisation écrite est interdite.
            </p>
            <p>
              Vous conservez l&apos;entière propriété de vos données (emails, catégories, feedbacks). MailFlow
              dispose d&apos;une licence limitée pour traiter ces données dans le seul but de fournir le service.
            </p>
          </Section>

          <Section title="9. Limitation de responsabilité">
            <p>
              MailFlow est fourni &quot;en l&apos;état&quot;. L&apos;Éditeur ne saurait être tenu responsable :
            </p>
            <ul>
              <li>Des décisions prises sur la base des classifications IA (précision non garantie à 100%)</li>
              <li>Des pertes indirectes, perte de chiffre d&apos;affaires ou de données</li>
              <li>Des interruptions de service liées à des tiers (Google, Vercel, Stripe)</li>
              <li>Des emails mal classifiés ayant entraîné une omission de traitement</li>
            </ul>
            <p>
              La responsabilité totale de l&apos;Éditeur est plafonnée aux sommes effectivement versées par
              l&apos;utilisateur au cours des 3 derniers mois.
            </p>
          </Section>

          <Section title="10. Données personnelles">
            <p>
              Le traitement de vos données personnelles est décrit dans notre{' '}
              <Link href="/privacy" className="text-blue-400 hover:underline">
                Politique de confidentialité
              </Link>
              , qui fait partie intégrante des présentes CGVU.
            </p>
          </Section>

          <Section title="11. Modification des conditions">
            <p>
              L&apos;Éditeur se réserve le droit de modifier les présentes CGVU à tout moment. Vous serez notifié
              par email au moins <strong>30 jours avant</strong> toute modification substantielle. La poursuite de
              l&apos;utilisation du service après cette date vaut acceptation des nouvelles conditions.
            </p>
          </Section>

          <Section title="12. Droit applicable et litiges">
            <p>
              Les présentes CGVU sont soumises au droit français. En cas de litige, une solution amiable sera
              recherchée en priorité.
            </p>
            <p>
              Conformément à l&apos;article L612-1 du Code de la consommation, vous pouvez recourir gratuitement
              au médiateur de la consommation compétent.
            </p>
            <p>
              À défaut de résolution amiable, les tribunaux compétents seront ceux du ressort du siège social
              de NodeIA.
            </p>
          </Section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2a2a2a] py-8 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#6a6a6a]">
          <span>© 2026 MailFlow — NodeIA</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-[#a0a0a0] transition-colors">Confidentialité</Link>
            <Link href="/terms" className="text-blue-400">CGV</Link>
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
      <div className="space-y-3 text-[#a0a0a0] text-sm leading-relaxed [&_strong]:text-[#f5f5f5] [&_ul]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5">
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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-lg border border-blue-800/40 bg-blue-950/20 text-blue-300 text-sm leading-relaxed">
      {children}
    </div>
  )
}
