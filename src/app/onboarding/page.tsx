// ============================================================
// MailFlow — Page Onboarding (3 étapes)
// ============================================================

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Mail,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Shield,
  Zap,
  Bell,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from 'lucide-react'

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
interface CategoryConfig {
  name: string
  displayName: string
  description: string
  emoji: string
  enabled: boolean
}

// Catégories par défaut
const DEFAULT_CATEGORIES: CategoryConfig[] = [
  {
    name: 'urgent',
    displayName: 'Urgent / Action requise',
    description: 'Emails nécessitant une réponse rapide (< 24h)',
    emoji: '🔴',
    enabled: true,
  },
  {
    name: 'personal',
    displayName: 'Personnel',
    description: 'Amis, famille, newsletters perso',
    emoji: '👤',
    enabled: true,
  },
  {
    name: 'business',
    displayName: 'Business / Clients',
    description: 'Clients, prospects, collaborations professionnelles',
    emoji: '💼',
    enabled: true,
  },
  {
    name: 'invoices',
    displayName: 'Factures & Admin',
    description: 'Factures, documents administratifs, reçus',
    emoji: '📄',
    enabled: true,
  },
  {
    name: 'newsletters',
    displayName: 'Newsletters & Notifications',
    description: 'Newsletters, notifications d\'applications',
    emoji: '📰',
    enabled: true,
  },
  {
    name: 'spam',
    displayName: 'Spam & Bruit',
    description: 'Spam, promotions non sollicitées, bruit',
    emoji: '🗑️',
    enabled: true,
  },
]

// ----------------------------------------------------------
// Composant : Indicateur de progression
// ----------------------------------------------------------
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-indigo-600 w-8'
              : i === current
              ? 'bg-indigo-400 w-8'
              : 'bg-white/[0.06] w-4'
          }`}
        />
      ))}
      <span className="text-xs text-[#5a5a66] ml-2">
        {current + 1}/{total}
      </span>
    </div>
  )
}

// ----------------------------------------------------------
// Étape 1 : Connexion Google
// ----------------------------------------------------------
function Step1Connect({
  onNext,
  error,
}: {
  onNext: () => void
  error?: string | null
}) {
  const [loading, setLoading] = useState(false)

  const handleGoogleConnect = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/gmail', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('[Onboarding] Google connect failed:', err)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-[#f0f0f5] mb-2">Connecte ta boîte mail</h2>
        <p className="text-[#94949e] leading-relaxed">
          MailFlow ne stockera jamais tes mots de passe — nous utilisons l'authentification
          sécurisée OAuth 2.0 de Google.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm">
            {error === 'access_denied'
              ? 'Accès refusé. Veuillez autoriser l\'accès à Gmail.'
              : error === 'auth_failed'
              ? 'Authentification échouée. Réessaie.'
              : 'Une erreur est survenue. Réessaie.'}
          </span>
        </div>
      )}

      {/* Bouton Google */}
      <button
        onClick={handleGoogleConnect}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-xl transition-colors disabled:opacity-70 mb-4 shadow-lg"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        Continuer avec Google
      </button>

      {/* Outlook (bientôt) */}
      <button
        disabled
        className="w-full flex items-center justify-center gap-3 px-6 py-4 border border-white/[0.06] bg-[#0c0c10] text-[#5a5a66] font-medium rounded-xl opacity-50 cursor-not-allowed"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0078d4">
          <path d="M7.462 0H.54C.243 0 0 .243 0 .54v6.923c0 .297.243.54.54.54h6.922a.54.54 0 0 0 .54-.54V.54A.54.54 0 0 0 7.462 0zm8.076 0h-6.923c-.297 0-.54.243-.54.54v6.923c0 .297.243.54.54.54h6.923c.297 0 .54-.243.54-.54V.54a.54.54 0 0 0-.54-.54zM7.462 8.077H.54a.54.54 0 0 0-.54.54v6.922c0 .297.243.54.54.54h6.922a.54.54 0 0 0 .54-.54V8.617a.54.54 0 0 0-.54-.54zm8.076 0h-6.923a.54.54 0 0 0-.54.54v6.922c0 .297.243.54.54.54h6.923c.297 0 .54-.243.54-.54V8.617a.54.54 0 0 0-.54-.54z" />
        </svg>
        Continuer avec Outlook — Bientôt disponible
      </button>

      {/* Garanties */}
      <div className="mt-8 space-y-3">
        {[
          { icon: Shield, text: 'Tes mots de passe ne sont jamais stockés' },
          { icon: Zap, text: 'Connexion sécurisée OAuth 2.0' },
          { icon: CheckCircle2, text: 'Révocable à tout moment depuis Google' },
        ].map((item) => (
          <div key={item.text} className="flex items-center gap-3 text-sm text-[#5a5a66]">
            <item.icon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            {item.text}
          </div>
        ))}
      </div>
    </div>
  )
}

// ----------------------------------------------------------
// Étape 2 : Personnalisation des catégories
// ----------------------------------------------------------
function Step2Customize({
  categories,
  onChange,
  onNext,
  onBack,
}: {
  categories: CategoryConfig[]
  onChange: (categories: CategoryConfig[]) => void
  onNext: () => void
  onBack: () => void
}) {
  const toggle = (name: string) => {
    onChange(
      categories.map((c) =>
        c.name === name ? { ...c, enabled: !c.enabled } : c
      )
    )
  }

  const enabledCount = categories.filter((c) => c.enabled).length

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#f0f0f5] mb-2">
          Personnalise tes catégories
        </h2>
        <p className="text-[#94949e]">
          Active ou désactive les catégories selon tes besoins.
          Tu pourras les modifier plus tard.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => toggle(cat.name)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
              cat.enabled
                ? 'border-white/[0.08] bg-[#0c0c10] hover:border-white/[0.15]'
                : 'border-white/[0.04] bg-[#050507] opacity-60'
            }`}
          >
            <span className="text-2xl flex-shrink-0">{cat.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#f0f0f5]">{cat.displayName}</div>
              <div className="text-xs text-[#5a5a66] mt-0.5">{cat.description}</div>
            </div>
            <div className="flex-shrink-0">
              {cat.enabled ? (
                <ToggleRight className="w-6 h-6 text-indigo-400" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-white/[0.1]" />
              )}
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs text-[#5a5a66] mb-6 text-center">
        {enabledCount} catégorie{enabledCount > 1 ? 's' : ''} activée{enabledCount > 1 ? 's' : ''}
      </p>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 border border-white/[0.08] text-[#94949e] hover:text-[#f0f0f5] hover:border-white/[0.15] rounded-xl text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <button
          onClick={onNext}
          disabled={enabledCount === 0}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Continuer
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------
// Étape 3 : Activation
// ----------------------------------------------------------
function Step3Activate({
  digestEnabled,
  onToggleDigest,
  onActivate,
  onBack,
  loading,
}: {
  digestEnabled: boolean
  onToggleDigest: () => void
  onActivate: () => void
  onBack: () => void
  loading: boolean
}) {
  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <Zap className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-[#f0f0f5] mb-2">C'est parti ! 🚀</h2>
        <p className="text-[#94949e] leading-relaxed">
          MailFlow va maintenant analyser tes emails entrants et les trier automatiquement.
        </p>
      </div>

      {/* Ce que MailFlow va faire */}
      <div className="space-y-3 mb-6">
        {[
          { icon: Mail, text: 'Analyser tes emails entrants en temps réel' },
          { icon: Zap, text: 'Appliquer les labels correspondants dans Gmail' },
          { icon: CheckCircle2, text: 'S\'améliorer avec tes corrections' },
        ].map((item) => (
          <div
            key={item.text}
            className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-[#0c0c10]"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <item.icon className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-sm text-[#94949e]">{item.text}</span>
          </div>
        ))}
      </div>

      {/* Option digest */}
      <button
        onClick={onToggleDigest}
        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left mb-6 ${
          digestEnabled
            ? 'border-indigo-500/20 bg-indigo-500/5'
            : 'border-white/[0.06] bg-[#0c0c10] opacity-70'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            digestEnabled ? 'bg-indigo-500/10' : 'bg-white/[0.03]'
          }`}
        >
          <Bell className={`w-5 h-5 ${digestEnabled ? 'text-indigo-400' : 'text-[#5a5a66]'}`} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[#f0f0f5]">
            Recevoir le digest quotidien
          </div>
          <div className="text-xs text-[#5a5a66] mt-0.5">
            Un résumé de tes emails importants chaque matin à 8h
          </div>
        </div>
        <div className="flex-shrink-0">
          {digestEnabled ? (
            <ToggleRight className="w-6 h-6 text-indigo-400" />
          ) : (
            <ToggleLeft className="w-6 h-6 text-white/[0.1]" />
          )}
        </div>
      </button>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 border border-white/[0.08] text-[#94949e] hover:text-[#f0f0f5] hover:border-white/[0.15] rounded-xl text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <button
          onClick={onActivate}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:scale-100 shadow-lg shadow-emerald-600/25"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Activation...
            </>
          ) : (
            <>
              Activer MailFlow
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------
// Page Onboarding principale
// ----------------------------------------------------------
export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [categories, setCategories] = useState<CategoryConfig[]>(DEFAULT_CATEGORIES)
  const [digestEnabled, setDigestEnabled] = useState(true)
  const [activating, setActivating] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  // Lire l'erreur depuis l'URL (après callback OAuth)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')
    if (error) {
      setUrlError(error)
      // Si on est sur une étape ultérieure, revenir à l'étape 1
    }

    // Si on revient après OAuth avec succès, avancer à l'étape 2
    const authSuccess = params.get('auth')
    if (authSuccess === 'success') {
      setStep(1)
    }
  }, [])

  const handleActivate = async () => {
    setActivating(true)
    try {
      // Sauvegarder les préférences
      const enabledCategories = categories
        .filter((c) => c.enabled)
        .map((c) => c.name)

      await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digestEnabled,
          enabledCategories,
          isOnboarded: true,
        }),
      })

      // Rediriger vers le dashboard
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('[Onboarding] Activation failed:', err)
      setActivating(false)
    }
  }

  const TOTAL_STEPS = 3

  return (
    <div className="min-h-screen bg-[#050507] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Mail className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#f0f0f5]">MailFlow</span>
          </Link>
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </div>
      </header>

      {/* Contenu */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-lg">
          {/* Titre de l'étape */}
          <div className="text-center mb-2">
            <span className="text-xs text-[#5a5a66] uppercase tracking-widest font-medium">
              Étape {step + 1} sur {TOTAL_STEPS}
            </span>
          </div>

          {/* Contenu selon l'étape */}
          <div className="transition-all duration-300">
            {step === 0 && (
              <Step1Connect
                onNext={() => setStep(1)}
                error={urlError}
              />
            )}
            {step === 1 && (
              <Step2Customize
                categories={categories}
                onChange={setCategories}
                onNext={() => setStep(2)}
                onBack={() => setStep(0)}
              />
            )}
            {step === 2 && (
              <Step3Activate
                digestEnabled={digestEnabled}
                onToggleDigest={() => setDigestEnabled(!digestEnabled)}
                onActivate={handleActivate}
                onBack={() => setStep(1)}
                loading={activating}
              />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-4 text-xs text-[#5a5a66]">
          <Link href="/privacy" className="hover:text-[#94949e] transition-colors">
            Confidentialité
          </Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-[#94949e] transition-colors">
            CGV
          </Link>
          <span>·</span>
          <a href="mailto:support@mailflow.ai" className="hover:text-[#94949e] transition-colors">
            Support
          </a>
        </div>
      </footer>
    </div>
  )
}
