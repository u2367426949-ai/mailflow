'use client'
// ============================================================
// MailFlow — Page de connexion
// /login — Redirige vers le dashboard si déjà connecté
// ============================================================

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Mail, ArrowRight, Shield, Zap, Clock, Loader2 } from 'lucide-react'
import { Suspense } from 'react'

// ----------------------------------------------------------
// Messages d'erreur lisibles
// ----------------------------------------------------------
const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Accès refusé. Tu as annulé la connexion Google.',
  csrf_mismatch: 'Erreur de sécurité. Réessaie.',
  token_exchange_failed: 'Impossible d\'échanger le code Google. Réessaie.',
  profile_fetch_failed: 'Impossible de récupérer ton profil Google. Réessaie.',
  auth_failed: 'Erreur d\'authentification. Réessaie.',
  invalid_callback: 'Callback invalide. Réessaie.',
}

// ----------------------------------------------------------
// Composant principal (utilise useSearchParams → wrappé en Suspense)
// ----------------------------------------------------------
function LoginContent() {
  const searchParams = useSearchParams()
  const errorKey = searchParams.get('error')
  const errorMessage = errorKey ? (ERROR_MESSAGES[errorKey] ?? 'Une erreur est survenue.') : null

  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // Vérifier si déjà connecté → rediriger vers le dashboard
  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (res.ok) {
          window.location.href = '/dashboard'
        } else {
          setChecking(false)
        }
      })
      .catch(() => setChecking(false))
  }, [])

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/gmail', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#3a3a3a] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-4 sm:px-6">
        <div className="max-w-6xl mx-auto h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-[#f5f5f5]">MailFlow</span>
          </Link>
          <Link
            href="/onboarding"
            className="text-sm text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors"
          >
            Pas de compte ? <span className="text-blue-400">Essai gratuit →</span>
          </Link>
        </div>
      </header>

      {/* Contenu centré */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">

          {/* Card connexion */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-8 shadow-2xl shadow-black/50">

            {/* Titre */}
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-blue-950/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-[#f5f5f5] mb-2">
                Connexion à MailFlow
              </h1>
              <p className="text-sm text-[#6a6a6a]">
                Connecte ton compte Google pour accéder à ton dashboard
              </p>
            </div>

            {/* Erreur */}
            {errorMessage && (
              <div className="mb-6 flex items-start gap-3 p-3.5 rounded-xl border border-red-800/50 bg-red-950/20 text-red-400 text-sm">
                <span className="text-base leading-none mt-0.5">⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Bouton Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white hover:bg-gray-50 disabled:opacity-60 text-gray-800 font-semibold rounded-xl border border-gray-200 transition-all hover:shadow-md active:scale-[0.98] text-sm"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              ) : (
                <GoogleIcon />
              )}
              {loading ? 'Connexion en cours...' : 'Continuer avec Google'}
            </button>

            {/* Séparateur */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-[#2a2a2a]" />
              <span className="text-xs text-[#3a3a3a]">SÉCURISÉ</span>
              <div className="flex-1 h-px bg-[#2a2a2a]" />
            </div>

            {/* Garanties */}
            <div className="space-y-2.5">
              {[
                { icon: Shield, text: 'Authentification OAuth2 officielle Google — aucun mot de passe stocké' },
                { icon: Zap, text: 'Accès limité aux métadonnées email (expéditeur, sujet, extrait)' },
                { icon: Clock, text: 'Révoque l\'accès à tout moment depuis Google → Sécurité' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-2.5">
                  <Icon className="w-3.5 h-3.5 text-[#4a4a4a] flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-[#5a5a5a] leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lien inscription */}
          <p className="text-center mt-6 text-sm text-[#6a6a6a]">
            Pas encore de compte ?{' '}
            <Link href="/onboarding" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Essai gratuit 14 jours →
            </Link>
          </p>

          {/* Liens légaux */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <Link href="/privacy" className="text-xs text-[#3a3a3a] hover:text-[#6a6a6a] transition-colors">
              Confidentialité
            </Link>
            <span className="text-[#2a2a2a]">·</span>
            <Link href="/terms" className="text-xs text-[#3a3a3a] hover:text-[#6a6a6a] transition-colors">
              CGV
            </Link>
            <span className="text-[#2a2a2a]">·</span>
            <a href="mailto:support@mailflow.ai" className="text-xs text-[#3a3a3a] hover:text-[#6a6a6a] transition-colors">
              Support
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}

// ----------------------------------------------------------
// Icône Google SVG
// ----------------------------------------------------------
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

// ----------------------------------------------------------
// Export
// ----------------------------------------------------------
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#3a3a3a] animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
