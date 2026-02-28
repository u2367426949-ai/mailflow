'use client'
// ============================================================
// MailFlow — Section Pricing avec toggle mensuel/annuel
// ============================================================

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 9,
    emails: 'Jusqu\'à 100 emails/jour',
    features: [
      'Tri IA GPT-4o-mini',
      'Labels Gmail automatiques',
      'Digest quotidien',
      '6 catégories',
      'Feedback loop',
      'Support email',
    ],
    highlighted: false,
    cta: 'Commencer',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 29,
    emails: 'Tri de toute la boîte mail (jusqu\'à 50 000 messages)',
    badge: 'Populaire',
    features: [
      'Tri de toute la boîte mail',
      'Catégories personnalisées',
      'Export CSV',
      'Stats avancées',
      'Priorité support',
      'Onboarding guidé',
    ],
    highlighted: true,
    cta: 'Choisir Pro',
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 79,
    emails: 'Sur-mesure — contactez-nous pour un devis',
    features: [
      'Tout Pro',
      'Multi-comptes Gmail',
      'Accès API',
      'SLA 99.9%',
      'Onboarding & intégration dédiée',
      'Support prioritaire 24/7',
    ],
    highlighted: false,
    cta: 'Contactez nos ventes',
  },
]

const ANNUAL_DISCOUNT = 0.8 // -20%

export function PricingSection() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="py-24 border-t border-[#2a2a2a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f5f5f5] mb-4">
            Tarifs simples et transparents
          </h2>
          <p className="text-[#a0a0a0] text-lg mb-8">
            14 jours d&apos;essai gratuit sur tous les plans. Sans carte bancaire.
          </p>

          {/* Toggle mensuel / annuel */}
          <div className="inline-flex items-center gap-3 p-1 rounded-xl bg-[#141414] border border-[#2a2a2a]">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                !annual
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#a0a0a0] hover:text-[#f5f5f5]'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                annual
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#a0a0a0] hover:text-[#f5f5f5]'
              }`}
            >
              Annuel
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${annual ? 'bg-white/20 text-white' : 'bg-emerald-900/50 text-emerald-400'}`}>
                -20%
              </span>
            </button>
          </div>

          {annual && (
            <p className="mt-3 text-sm text-emerald-400 font-medium">
              🎉 Vous économisez jusqu&apos;à <strong>{Math.round(79 * 12 * 0.2)}€/an</strong> avec la facturation annuelle
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const displayPrice = annual
              ? Math.round(plan.monthlyPrice * ANNUAL_DISCOUNT)
              : plan.monthlyPrice
            const annualTotal = Math.round(plan.monthlyPrice * 12 * ANNUAL_DISCOUNT)

            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-6 ${
                  plan.highlighted
                    ? 'border-blue-600 bg-blue-950/20'
                    : 'border-[#2a2a2a] bg-[#141414]'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-[#f5f5f5] mb-1">{plan.name}</h3>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-bold text-[#f5f5f5]">{displayPrice}€</span>
                    <span className="text-[#a0a0a0] mb-1">/mois</span>
                  </div>
                  {annual ? (
                    <div className="space-y-0.5">
                      <p className="text-xs text-emerald-400 font-medium">
                        Facturé {annualTotal}€/an
                      </p>
                      <p className="text-xs text-[#6a6a6a] line-through">
                        vs {plan.monthlyPrice * 12}€/an en mensuel
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-[#6a6a6a]">{plan.emails}</p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-[#a0a0a0]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.id === 'business' ? (
                  <a
                    href={`mailto:sales@mailflow.ai?subject=Demande%20devis%20Business%20-%20MailFlow`}
                    className={`block w-full text-center py-3 px-6 rounded-xl font-semibold text-sm transition-all ${
                      plan.highlighted
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'
                        : 'bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#3a3a3a] text-[#f5f5f5]'
                    }`}
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <Link
                    href={`/onboarding?plan=${plan.id}&billing=${annual ? 'annual' : 'monthly'}`}
                    className={`block w-full text-center py-3 px-6 rounded-xl font-semibold text-sm transition-all ${
                      plan.highlighted
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'
                        : 'bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#3a3a3a] text-[#f5f5f5]'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
            )
          })}
        </div>

        {/* Garantie */}
        <div className="mt-10 text-center">
          <p className="text-sm text-[#6a6a6a]">
            ✓ Annulation à tout moment &nbsp;·&nbsp; ✓ Sans engagement &nbsp;·&nbsp; ✓ Factures automatiques
          </p>
        </div>
      </div>
    </section>
  )
}
