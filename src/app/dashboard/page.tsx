// ============================================================
// MailFlow — Dashboard utilisateur
// ============================================================

'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Mail,
  BarChart3,
  RefreshCw,
  Settings,
  LogOut,
  Zap,
  Clock,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  CreditCard,
  Bell,
  CheckCircle2,
  Download,
  Tag,
  Lock,
  Users,
  Filter,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { EmailList } from '@/components/EmailList'
import { StatsCard, StatsGrid } from '@/components/StatsCard'
import { MailAgent } from '@/components/MailAgent'
import type { EmailItem } from '@/components/EmailList'
import type { EmailCategory } from '@/components/CategoryBadge'

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
interface DashboardStats {
  totalProcessed: number
  accuracy: number
  urgentCount: number
  timeSavedMinutes: number
  byCategory: Record<string, number>
  todayCount: number
}

interface UserSession {
  name?: string
  email: string
  plan: string
  isOnboarded: boolean
  trialEndsAt?: string | null
  digestEnabled?: boolean
  digestTime?: string
  timezone?: string
  settings?: { customRules?: string | null; [key: string]: unknown }
}

// ----------------------------------------------------------
// Hook : charger les données du dashboard
// ----------------------------------------------------------
function useDashboardData() {
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [totalEmails, setTotalEmails] = useState<number>(0)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/emails?limit=500')
      if (!res.ok) throw new Error('Failed to fetch emails')
      const data = await res.json()
      setEmails(
        (data.emails ?? []).map((e: any) => ({
          ...e,
          receivedAt: new Date(e.receivedAt),
        }))
      )
      // total BDD (non paginé)
      if (typeof data.total === 'number') setTotalEmails(data.total)
    } catch (err) {
      console.error('[Dashboard] Error fetching emails:', err)
    }
  }, [])

  const fetchGmailTotal = useCallback(async () => {
    try {
      const res = await fetch('/api/emails?type=gmail-total')
      if (!res.ok) return
      const data = await res.json()
      if (typeof data.messagesTotal === 'number') setTotalEmails(data.messagesTotal)
    } catch {}
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/emails?type=stats')
      if (!res.ok) return
      const data = await res.json()
      setStats(data.stats)
    } catch {}
  }, [])

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (!res.ok) {
        // Non authentifié → rediriger
        window.location.href = '/'
        return
      }
      const data = await res.json()
      setUser(data.user)
    } catch {}
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchEmails(), fetchStats(), fetchUser()])
    setLastSyncedAt(new Date())
    setLoading(false)
    // Charger le vrai total Gmail en arrière-plan (appel API Google, légèrement plus lent)
    fetchGmailTotal()
  }, [fetchEmails, fetchStats, fetchUser, fetchGmailTotal])

  useEffect(() => {
    load()
  }, [load])

  // Auto-refresh toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(async () => {
      await Promise.all([fetchEmails(), fetchStats()])
      setLastSyncedAt(new Date())
    }, 30_000)
    return () => clearInterval(interval)
  }, [fetchEmails, fetchStats])

  const sync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/emails/process', { method: 'POST' })
      if (res.ok) {
        await fetchEmails()
        await fetchStats()
        setLastSyncedAt(new Date())
      }
    } catch (err) {
      setError('Erreur lors de la synchronisation')
    } finally {
      setSyncing(false)
    }
  }

  const handleFeedback = async (emailId: string, correctedCategory: EmailCategory) => {
    const res = await fetch('/api/emails/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, correctedCategory }),
    })
    if (!res.ok) throw new Error('Feedback failed')

    // Mettre à jour localement
    setEmails((prev) =>
      prev.map((e) =>
        e.id === emailId ? { ...e, category: correctedCategory } : e
      )
    )
  }

  return { emails, totalEmails, stats, user, loading, syncing, lastSyncedAt, error, sync, handleFeedback, fetchUser }
}

// ----------------------------------------------------------
// Composant Header du dashboard
// ----------------------------------------------------------
function DashboardHeader({
  user,
  syncing,
  lastSyncedAt,
  onSync,
}: {
  user: UserSession | null
  syncing: boolean
  lastSyncedAt: Date | null
  onSync: () => void
}) {
  const syncAgo = lastSyncedAt
    ? Math.round((Date.now() - lastSyncedAt.getTime()) / 1000)
    : null

  const getSyncLabel = () => {
    if (syncing) return 'Sync...'
    if (syncAgo === null) return 'Synchroniser'
    if (syncAgo < 10) return 'À jour'
    if (syncAgo < 60) return `il y a ${syncAgo}s`
    return `il y a ${Math.round(syncAgo / 60)}min`
  }

  // Pastille : verte si < 60s, orange si < 5min, grise sinon
  const dotColor =
    syncAgo !== null && syncAgo < 60
      ? 'bg-emerald-400'
      : syncAgo !== null && syncAgo < 300
      ? 'bg-amber-400'
      : 'bg-[#5a5a66]'
  return (
    <header className="sticky top-0 z-40 glass border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Mail className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-[#f0f0f5]">MailFlow</span>
            </Link>
            <span className="text-white/[0.12]">/</span>
            <span className="text-sm text-[#94949e]">Dashboard</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Plan badge */}
            {user && (
              <span
                className={`hidden sm:inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${
                  user.plan === 'free'
                    ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                    : user.plan === 'pro'
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    : user.plan === 'business'
                    ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                {user.plan}
              </span>
            )}

            {/* Sync button */}
            <button
              onClick={onSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[#94949e] hover:text-[#f0f0f5] hover:border-white/[0.15] text-xs font-medium transition-all duration-200 disabled:opacity-50"
            >
              <span className="relative">
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${syncing ? 'bg-indigo-400 animate-pulse' : dotColor}`} />
              </span>
              <span className="hidden sm:inline">{getSyncLabel()}</span>
            </button>

            {/* User menu */}
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-xl text-[#5a5a66] hover:text-[#94949e] hover:bg-white/[0.03] transition-all duration-200">
                <Bell className="w-4 h-4" />
              </button>
              <Link
                href="/dashboard?tab=settings"
                className="p-2 rounded-xl text-[#5a5a66] hover:text-[#94949e] hover:bg-white/[0.03] transition-all duration-200"
              >
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

// ----------------------------------------------------------
// Composant : Bannière contextuelle selon le plan
// ----------------------------------------------------------
function PlanBanner({
  plan,
  trialEndsAt,
  onUpgrade,
}: {
  plan: string
  trialEndsAt?: string | null
  onUpgrade: () => void
}) {
  // Calculer les jours restants de trial
  const trialDaysLeft = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const isOnTrial = plan === 'starter' && trialDaysLeft !== null && trialDaysLeft > 0

  if (isOnTrial) {
    const urgency = trialDaysLeft <= 3
    return (
      <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
        urgency
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-indigo-500/20 bg-indigo-500/5'
      }`}>
        <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${urgency ? 'text-red-400' : 'text-indigo-400'}`} />
        <div className="flex-1">
          <p className={`text-sm font-medium ${urgency ? 'text-red-300' : 'text-indigo-300'}`}>
            {urgency
              ? `⏰ Plus que ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''} d'essai gratuit !`
              : `🎁 Essai gratuit — encore ${trialDaysLeft} jours`}
          </p>
          <p className={`text-xs mt-0.5 ${urgency ? 'text-red-400/60' : 'text-indigo-400/60'}`}>
            {urgency
              ? 'Choisis un plan maintenant pour ne pas perdre le tri automatique de tes emails.'
              : 'Tu profites de toutes les fonctionnalités Starter. Sans carte bancaire.'}
          </p>
        </div>
        <button
          onClick={onUpgrade}
          className={`flex-shrink-0 px-3 py-1.5 text-white text-xs font-semibold rounded-xl transition-colors ${
            urgency ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'
          }`}
        >
          S'abonner →
        </button>
      </div>
    )
  }

  if (plan === 'free') {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-amber-400 font-medium">Plan gratuit — Le tri IA est désactivé</p>
          <p className="text-xs text-amber-400/60 mt-0.5">
            Passe à Starter ou Pro pour activer la classification automatique.
          </p>
        </div>
        <Link
          href="/dashboard?tab=billing"
          className="flex-shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition-colors"
        >
          Voir les offres
        </Link>
      </div>
    )
  }
  if (plan === 'starter') {
    return (
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-center gap-3">
        <Zap className="w-5 h-5 text-blue-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-blue-300 font-medium">Passez à Pro — Triez toute votre boîte mail</p>
          <p className="text-xs text-blue-400/60 mt-0.5">
            Pro permet de traiter jusqu'à 50 000 emails, catégories custom, export CSV et plus.
          </p>
        </div>
        <button
          onClick={onUpgrade}
          className="flex-shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors"
        >
          Passer à Pro
        </button>
      </div>
    )
  }
  if (plan === 'pro') {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-emerald-300 font-medium">Plan Pro actif ✓</p>
          <p className="text-xs text-emerald-400/60 mt-0.5">
            Tri de toute la boîte mail, catégories custom, export CSV — tout est activé.
          </p>
        </div>
      </div>
    )
  }
  if (plan === 'business') {
    return (
      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-purple-300 font-medium">Plan Business actif ✓</p>
          <p className="text-xs text-purple-400/60 mt-0.5">
            Accès API, multi-comptes, SLA 99.9% et support prioritaire 24/7 activés.
          </p>
        </div>
      </div>
    )
  }
  return null
}

// ----------------------------------------------------------
// Composant : Carte plan dans l'onglet Billing
// ----------------------------------------------------------
const PLAN_DETAILS: Record<string, {
  label: string
  price: string
  color: string
  badge: string
  limit: string
  features: string[]
}> = {
  free: {
    label: 'Gratuit',
    price: '0€/mois',
    color: 'text-zinc-400',
    badge: 'bg-zinc-800 text-zinc-400',
    limit: 'Tri IA désactivé',
    features: ['Dashboard de base', 'Statistiques limitées'],
  },
  starter: {
    label: 'Starter',
    price: '9€/mois',
    color: 'text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400',
    limit: "Jusqu'à 100 emails/jour",
    features: ['Tri IA GPT-4o-mini', 'Labels Gmail', 'Digest quotidien', '6 catégories', 'Feedback loop'],
  },
  pro: {
    label: 'Pro',
    price: '29€/mois',
    color: 'text-blue-400',
    badge: 'bg-blue-500/10 text-blue-400',
    limit: "Tri de toute la boîte mail (jusqu'à 50 000 msgs)",
    features: ['Tout Starter', 'Catégories personnalisées', 'Export CSV', 'Stats avancées', 'Priorité support'],
  },
  business: {
    label: 'Business',
    price: 'Sur devis',
    color: 'text-purple-400',
    badge: 'bg-purple-500/10 text-purple-400',
    limit: 'Volume sur-mesure',
    features: ['Tout Pro', 'Multi-comptes Gmail', 'Accès API', 'SLA 99.9%', 'Onboarding dédié', 'Support 24/7'],
  },
}

// ----------------------------------------------------------
// Composant : Onglet Billing complet
// ----------------------------------------------------------
function BillingTab({
  user,
  onCheckout,
  onPortal,
}: {
  user: UserSession | null
  onCheckout: (plan: string) => void
  onPortal: () => void
}) {
  const currentPlan = user?.plan ?? 'free'
  const details = PLAN_DETAILS[currentPlan]

  const upgradePlans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '9€/mois',
      limit: "100 emails/jour",
      highlighted: false,
      features: ['Tri IA GPT-4o-mini', 'Labels Gmail automatiques', 'Digest quotidien', '6 catégories'],
      cta: 'Démarrer Starter',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '29€/mois',
      limit: 'Toute la boîte mail',
      highlighted: true,
      features: ['Tout Starter', 'Catégories personnalisées', 'Export CSV', 'Stats avancées'],
      cta: 'Démarrer Pro',
    },
    {
      id: 'business',
      name: 'Business',
      price: 'Sur devis',
      limit: 'Volume sur-mesure',
      highlighted: false,
      features: ['Tout Pro', 'Multi-comptes Gmail', 'Accès API', 'SLA 99.9%'],
      cta: 'Contacter nos ventes',
      isContact: true,
    },
  ]

  // Plans proposés à l'upgrade : exclure le plan actuel et les plans inférieurs
  const planOrder = ['free', 'starter', 'pro', 'business']
  const currentIndex = planOrder.indexOf(currentPlan)
  const availablePlans = upgradePlans.filter((p) => planOrder.indexOf(p.id) > currentIndex)

  return (
    <div className="space-y-6">
      {/* Carte plan actuel */}
      <div className={`rounded-2xl border p-6 ${
        currentPlan === 'business' ? 'border-purple-500/20 bg-purple-500/5' :
        currentPlan === 'pro' ? 'border-blue-500/20 bg-blue-500/5' :
        currentPlan === 'starter' ? 'border-emerald-500/20 bg-emerald-500/5' :
        'border-white/[0.06] bg-[#0c0c10]'
      }`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${details.badge}`}>
                {details.label}
              </span>
              {currentPlan !== 'free' && (
                <span className="text-xs text-[#5a5a66]">actif</span>
              )}
            </div>
            <div className={`text-3xl font-bold mt-2 ${details.color}`}>{details.price}</div>
            <div className="text-xs text-[#5a5a66] mt-1">{details.limit}</div>
          </div>
          {currentPlan !== 'free' && (
            <button
              onClick={onPortal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] text-[#94949e] hover:text-[#f0f0f5] hover:border-white/[0.15] text-sm transition-colors"
            >
              Gérer l'abonnement
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Features incluses */}
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <p className="text-xs text-[#5a5a66] mb-2 font-medium">Inclus dans votre plan</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {details.features.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-[#94949e]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plans disponibles (upgrade) */}
      {availablePlans.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#94949e] mb-3">
            {currentPlan === 'free' ? 'Choisir un plan' : 'Passer à un plan supérieur'}
          </h4>
          <div className={`grid gap-4 ${availablePlans.length === 1 ? 'grid-cols-1 max-w-sm' : availablePlans.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
            {availablePlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative p-5 rounded-2xl border flex flex-col gap-4 ${
                  plan.highlighted
                    ? 'border-indigo-500/30 bg-indigo-500/5'
                    : 'border-white/[0.06] bg-[#0c0c10]'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-full">
                    Recommandé
                  </span>
                )}
                <div>
                  <div className="text-base font-bold text-[#f0f0f5]">{plan.name}</div>
                  <div className="text-2xl font-bold text-[#f0f0f5] mt-1">{plan.price}</div>
                  <div className="text-xs text-[#5a5a66] mt-0.5">{plan.limit}</div>
                </div>
                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-[#94949e]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.isContact ? (
                  <a
                    href="mailto:sales@mailflow.ai?subject=Demande%20devis%20Business%20-%20MailFlow"
                    className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold bg-[#131318] hover:bg-white/[0.06] border border-white/[0.08] text-[#f0f0f5] transition-colors"
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <button
                    onClick={() => onCheckout(plan.id)}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      plan.highlighted
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        : 'bg-[#131318] hover:bg-white/[0.06] border border-white/[0.08] text-[#f0f0f5]'
                    }`}
                  >
                    {plan.cta} — 14j gratuits
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message si plan max */}
      {currentPlan === 'business' && (
        <div className="text-center py-6">
          <p className="text-sm text-[#5a5a66]">Vous êtes sur notre offre la plus complète.</p>
          <p className="text-xs text-[#3d3d44] mt-1">
            Pour des besoins spécifiques,{' '}
            <a href="mailto:sales@mailflow.ai" className="text-purple-400 hover:underline">
              contactez notre équipe
            </a>.
          </p>
        </div>
      )}

      {/* Note annulation */}
      <p className="text-xs text-[#3d3d44] text-center">
        ✓ Annulation à tout moment &nbsp;·&nbsp; ✓ Sans engagement &nbsp;·&nbsp; ✓ Factures automatiques
      </p>
    </div>
  )
}

// ----------------------------------------------------------
// Composant : Activity feed
// ----------------------------------------------------------
function ActivityFeed({ emails }: { emails: EmailItem[] }) {
  const recentEmails = emails.slice(0, 5)

  const categoryLabels: Record<string, string> = {
    urgent: 'classé Urgent',
    personal: 'classé Personnel',
    business: 'classé Business',
    invoices: 'classé Factures',
    newsletters: 'classé Newsletters',
    spam: 'classé Spam',
  }

  const categoryColors: Record<string, string> = {
    urgent: 'text-red-400',
    personal: 'text-purple-400',
    business: 'text-blue-400',
    invoices: 'text-amber-400',
    newsletters: 'text-emerald-400',
    spam: 'text-zinc-500',
  }

  if (recentEmails.length === 0) {
    return (
      <div className="text-center py-8">
        <Mail className="w-8 h-8 text-white/[0.08] mx-auto mb-2" />
        <p className="text-sm text-[#5a5a66]">Aucune activité récente</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {recentEmails.map((email) => {
        const timeAgo = new Date(email.receivedAt).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })
        return (
          <div key={email.id} className="flex items-center gap-3 py-2 px-1">
            <span className="text-xs text-[#5a5a66] w-10 flex-shrink-0">{timeAgo}</span>
            <span className="flex-1 text-xs text-[#94949e] truncate">
              Email{' '}
              <span className={categoryColors[email.category] ?? 'text-[#94949e]'}>
                {categoryLabels[email.category] ?? email.category}
              </span>
              {' — '}
              <span className="text-[#5a5a66]">{email.subject}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ----------------------------------------------------------
// Composant : Onglet Réglages
// ----------------------------------------------------------
function SettingsTab({ user }: { user: UserSession | null }) {
  const [name, setName] = useState(user?.name ?? '')
  const [digestEnabled, setDigestEnabled] = useState(user?.digestEnabled ?? true)
  const [digestTime, setDigestTime] = useState(user?.digestTime ?? '08:00')
  const [timezone, setTimezone] = useState(user?.timezone ?? 'Europe/Paris')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, digestEnabled, digestTime, timezone }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      console.error('[Settings] Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    document.cookie = 'mailflow_session=; path=/; max-age=0'
    window.location.href = '/'
  }

  const handleFullReset = async () => {
    if (resetConfirmText !== 'RESET') return
    setResetLoading(true)
    setResetDone(false)
    try {
      const res = await fetch('/api/emails/sort-all?full=true', { method: 'DELETE' })
      if (res.ok) {
        setResetDone(true)
        setResetConfirmText('')
        setTimeout(() => setResetDone(false), 5000)
      }
    } catch (err) {
      console.error('[Settings] Reset error:', err)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Profil */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c10] p-6">
        <h3 className="text-[#f0f0f5] font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-400" />
          Profil
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#5a5a66] mb-1.5">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#050507] border border-white/[0.06] rounded-xl text-sm text-[#f0f0f5] focus:outline-none focus:border-indigo-500/50 transition-colors"
              placeholder="Votre nom"
            />
          </div>
          <div>
            <label className="block text-xs text-[#5a5a66] mb-1.5">Email</label>
            <div className="px-3 py-2 bg-[#050507] border border-white/[0.06] rounded-xl text-sm text-[#5a5a66]">
              {user?.email ?? '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Digest */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c10] p-6">
        <h3 className="text-[#f0f0f5] font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4 text-emerald-400" />
          Digest quotidien
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[#f0f0f5]">Activer le digest</div>
              <div className="text-xs text-[#5a5a66]">Recevez un résumé quotidien de vos emails</div>
            </div>
            <button
              onClick={() => setDigestEnabled(!digestEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                digestEnabled ? 'bg-indigo-600' : 'bg-white/[0.08]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  digestEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {digestEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#5a5a66] mb-1.5">Heure d&apos;envoi</label>
                <input
                  type="time"
                  value={digestTime}
                  onChange={(e) => setDigestTime(e.target.value)}
                  className="w-full px-3 py-2 bg-[#050507] border border-white/[0.06] rounded-xl text-sm text-[#f0f0f5] focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5a5a66] mb-1.5">Fuseau horaire</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#050507] border border-white/[0.06] rounded-xl text-sm text-[#f0f0f5] focus:outline-none focus:border-indigo-500/50 transition-colors"
                >
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Réinitialisation du compte */}
      <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-6">
        <h3 className="text-[#f0f0f5] font-semibold mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          Réinitialiser le compte
        </h3>
        <p className="text-xs text-[#5a5a66] mb-4">
          Supprime tous les emails triés et réinitialise le processus de tri. Les labels Gmail déjà appliqués ne seront pas supprimés. Cette action est irréversible.
        </p>
        {resetDone ? (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            Compte réinitialisé avec succès
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#5a5a66] mb-1.5">
                Tapez <span className="font-mono text-red-400">RESET</span> pour confirmer
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESET"
                className="w-48 px-3 py-2 bg-[#050507] border border-red-500/20 rounded-xl text-sm text-[#f0f0f5] focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-[#2a2a32]"
              />
            </div>
            <button
              onClick={handleFullReset}
              disabled={resetConfirmText !== 'RESET' || resetLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {resetLoading ? 'Réinitialisation...' : 'Réinitialiser le compte'}
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? 'Sauvegarde...' : saved ? '✓ Sauvegardé' : 'Sauvegarder'}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------
// Composant : Onglet Pro Tools
// ----------------------------------------------------------
function ProToolsTab({ emails, stats, user }: {
  emails: EmailItem[]
  stats: DashboardStats | null
  user: UserSession | null
}) {
  const isPro = user?.plan === 'pro' || user?.plan === 'business'
  const [relabeling, setRelabeling] = useState(false)
  const [relabelResult, setRelabelResult] = useState<{ labeled: number; errors: number } | null>(null)
  const [exportDone, setExportDone] = useState(false)

  // --- Export CSV ---
  const handleExportCSV = () => {
    const headers = ['Date', 'Expéditeur', 'Sujet', 'Catégorie', 'Confiance', 'Lu']
    const rows = emails.map((e) => [
      new Date(e.receivedAt).toLocaleDateString('fr-FR'),
      e.from,
      `"${e.subject.replace(/"/g, '""')}"`,
      e.category,
      e.confidence != null ? `${Math.round(e.confidence * 100)}%` : '—',
      e.isRead ? 'Oui' : 'Non',
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mailflow-emails-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportDone(true)
    setTimeout(() => setExportDone(false), 3000)
  }

  // --- Re-labelling Gmail ---
  const handleRelabel = async () => {
    setRelabeling(true)
    setRelabelResult(null)
    try {
      const res = await fetch('/api/emails/relabel', { method: 'POST' })
      const data = await res.json()
      if (res.ok) setRelabelResult({ labeled: data.labeled, errors: data.errors })
    } catch {
      setRelabelResult({ labeled: 0, errors: 1 })
    } finally {
      setRelabeling(false)
    }
  }

  // Stats avancées
  const topSenders = Object.entries(
    emails.reduce((acc, e) => {
      const domain = e.from.replace(/.*@/, '@')
      acc[domain] = (acc[domain] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const readRate = emails.length > 0
    ? Math.round((emails.filter((e) => e.isRead).length / emails.length) * 100)
    : 0

  const labeledRate = emails.length > 0
    ? Math.round((emails.filter((e) => e.isLabeled).length / emails.length) * 100)
    : 0

  const highConfidence = emails.filter((e) => (e.confidence ?? 0) >= 0.9).length

  // --- UI verrouillé si non Pro ---
  const LockedOverlay = () => (
    <div className="absolute inset-0 rounded-2xl bg-[#050507]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
      <Lock className="w-6 h-6 text-[#5a5a66]" />
      <p className="text-sm text-[#5a5a66] font-medium text-center px-4">
        Fonctionnalité réservée au plan Pro
      </p>
      <Link
        href="/dashboard?tab=billing"
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors"
      >
        Passer à Pro
      </Link>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-[#f0f0f5] font-semibold">Outils Pro</h2>
          <p className="text-xs text-[#5a5a66]">
            {isPro ? 'Toutes vos fonctionnalités avancées sont actives' : 'Disponible à partir du plan Pro'}
          </p>
        </div>
        {!isPro && (
          <Link
            href="/dashboard?tab=billing"
            className="ml-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Passer à Pro — 14j gratuits
          </Link>
        )}
      </div>

      {/* --- Export CSV --- */}
      <div className="relative rounded-2xl border border-white/[0.06] bg-[#0c0c10] p-6">
        {!isPro && <LockedOverlay />}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-[#f0f0f5] font-semibold mb-1">Export CSV</h3>
            <p className="text-sm text-[#5a5a66] mb-4">
              Téléchargez tous vos emails classifiés ({emails.length} emails chargés) au format CSV — compatible Excel, Google Sheets.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleExportCSV}
                disabled={!isPro || emails.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                {exportDone ? '✓ Téléchargement lancé !' : `Exporter ${emails.length} emails`}
              </button>
              <span className="text-xs text-[#5a5a66]">
                Colonnes : Date, Expéditeur, Sujet, Catégorie, Confiance, Lu
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* --- Stats avancées --- */}
      <div className="relative rounded-2xl border border-white/[0.06] bg-[#0c0c10] p-6">
        {!isPro && <LockedOverlay />}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-[#f0f0f5] font-semibold mb-4">Statistiques avancées</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Top expéditeurs */}
              <div>
                <h4 className="text-xs font-semibold text-[#5a5a66] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Top expéditeurs
                </h4>
                {topSenders.length === 0 ? (
                  <p className="text-xs text-[#3d3d44]">Aucune donnée</p>
                ) : (
                  <div className="space-y-2">
                    {topSenders.map(([domain, count]) => {
                      const max = topSenders[0][1]
                      const pct = Math.round((count / max) * 100)
                      return (
                        <div key={domain} className="flex items-center gap-2">
                          <span className="text-xs text-[#94949e] w-28 truncate">{domain}</span>
                          <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full bg-purple-600 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-[#5a5a66] w-6 text-right">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Métriques clés */}
              <div>
                <h4 className="text-xs font-semibold text-[#5a5a66] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5" /> Métriques qualité
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#94949e]">Taux de lecture</span>
                    <span className="text-xs font-semibold text-[#f0f0f5]">{readRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#94949e]">Labels appliqués</span>
                    <span className="text-xs font-semibold text-[#f0f0f5]">{labeledRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#94949e]">Précision IA</span>
                    <span className={`text-xs font-semibold ${(stats?.accuracy ?? 0) >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {stats?.accuracy ?? 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#94949e]">Emails aujourd&apos;hui</span>
                    <span className="text-xs font-semibold text-[#f0f0f5]">{stats?.todayCount ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#94949e]">Temps estimé économisé</span>
                    <span className="text-xs font-semibold text-purple-400">
                      {Math.round((stats?.timeSavedMinutes ?? 0) / 60)}h {(stats?.timeSavedMinutes ?? 0) % 60}min
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Catégories personnalisées --- */}
      <div className="relative rounded-2xl border border-white/[0.06] bg-[#0c0c10] p-6">
        {!isPro && <LockedOverlay />}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Tag className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-[#f0f0f5] font-semibold mb-1">Catégories personnalisées</h3>
            <p className="text-sm text-[#5a5a66] mb-3">
              Les catégories personnalisées peuvent être configurées dans les Réglages de votre compte.
              MailFlow les appliquera automatiquement à vos prochains emails.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {['urgent', 'personal', 'business', 'invoices', 'newsletters', 'spam'].map((cat) => {
                const count = stats?.byCategory?.[cat] ?? 0
                const catColors: Record<string, string> = {
                  urgent: 'border-red-500/20 text-red-400 bg-red-500/5',
                  personal: 'border-purple-500/20 text-purple-400 bg-purple-500/5',
                  business: 'border-blue-500/20 text-blue-400 bg-blue-500/5',
                  invoices: 'border-amber-500/20 text-amber-400 bg-amber-500/5',
                  newsletters: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
                  spam: 'border-zinc-500/20 text-zinc-500 bg-zinc-500/5',
                }
                return (
                  <div key={cat} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${catColors[cat]}`}>
                    <span className="capitalize">{cat}</span>
                    <span className="opacity-60">({count})</span>
                  </div>
                )
              })}
            </div>
            <Link
              href="/dashboard?tab=settings"
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Gérer les catégories dans les Réglages
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------
// Page Dashboard principale
// ----------------------------------------------------------
function DashboardContent() {
  const { emails, totalEmails, stats, user, loading, syncing, lastSyncedAt, error, sync, handleFeedback, fetchUser } = useDashboardData()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const checkoutStatus = searchParams.get('checkout')

  const validTabs = ['emails', 'stats', 'activity', 'pro', 'billing', 'settings'] as const
  type TabId = typeof validTabs[number]

  const initialTab: TabId = validTabs.includes(tabFromUrl as TabId) ? (tabFromUrl as TabId) : 'emails'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [checkoutSuccess, setCheckoutSuccess] = useState(false)

  // Sync tab with URL changes
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl as TabId)) {
      setActiveTab(tabFromUrl as TabId)
    }
  }, [tabFromUrl])

  // Gérer le retour depuis Stripe Checkout
  useEffect(() => {
    if (checkoutStatus === 'success') {
      setActiveTab('billing')
      setCheckoutSuccess(true)
      // Re-fetch user pour obtenir le nouveau plan
      fetchUser()
      // Nettoyer l'URL sans recharger la page
      const url = new URL(window.location.href)
      url.searchParams.delete('checkout')
      url.searchParams.delete('session_id')
      window.history.replaceState({}, '', url.toString())
      // Masquer la bannière après 6s
      setTimeout(() => setCheckoutSuccess(false), 6000)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabs = [
    { id: 'emails' as const, label: 'Emails', icon: Mail },
    { id: 'stats' as const, label: 'Statistiques', icon: BarChart3 },
    { id: 'activity' as const, label: 'Activité', icon: Clock },
    { id: 'pro' as const, label: 'Outils Pro', icon: Zap },
    { id: 'billing' as const, label: 'Abonnement', icon: CreditCard },
    { id: 'settings' as const, label: 'Réglages', icon: Settings },
  ]

  const handleCheckout = async (plan: string) => {
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkout', plan }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  const handlePortal = async () => {
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'portal' }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  return (
    <div className="min-h-screen bg-[#050507]">
      <DashboardHeader user={user} syncing={syncing} lastSyncedAt={lastSyncedAt} onSync={sync} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#f0f0f5]">
            Bonjour{user?.name ? ` ${user.name.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="text-sm text-[#5a5a66] mt-1">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>

        {/* Bannière succès paiement */}
        {checkoutSuccess && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300">
            <span className="text-xl">🎉</span>
            <div>
              <p className="font-semibold text-emerald-200">Abonnement activé avec succès !</p>
              <p className="text-sm text-emerald-400 mt-0.5">Votre nouveau plan est maintenant actif. Profitez de toutes les fonctionnalités MailFlow.</p>
            </div>
          </div>
        )}

        {/* Bannière plan */}
        {user && (
          <div className="mb-6">
            <PlanBanner
              plan={user.plan}
              trialEndsAt={user.trialEndsAt}
              onUpgrade={() => handleCheckout('pro')}
            />
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="mb-6 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Stats rapides */}
        <StatsGrid columns={4} className="mb-6">
          <StatsCard
            title="Total boîte mail"
            value={loading ? '—' : totalEmails.toLocaleString()}
            icon={Mail}
            iconColor="text-blue-400"
            loading={loading}
            subtitle={`${(stats?.totalProcessed ?? 0).toLocaleString()} classifiés par l'IA`}
          />
          <StatsCard
            title="Précision IA"
            value={loading ? '—' : `${stats?.accuracy ?? 0}%`}
            icon={Zap}
            iconColor="text-emerald-400"
            loading={loading}
            variant={!loading && (stats?.accuracy ?? 0) >= 90 ? 'highlighted' : 'default'}
          />
          <StatsCard
            title="Urgents"
            value={loading ? '—' : (stats?.urgentCount ?? 0)}
            icon={AlertCircle}
            iconColor="text-red-400"
            loading={loading}
            subtitle="Nécessitent votre attention"
          />
          <StatsCard
            title="Temps gagné"
            value={loading ? '—' : `${Math.round((stats?.timeSavedMinutes ?? 0) / 60)}h`}
            icon={TrendingUp}
            iconColor="text-purple-400"
            loading={loading}
            subtitle="Estimé ce mois"
          />
        </StatsGrid>

        {/* Tabs — pill style */}
        <div className="mb-8">
          <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-[#131318] text-[#f0f0f5] border border-white/[0.1] shadow-lg shadow-black/20'
                    : 'text-[#5a5a66] hover:text-[#94949e] border border-transparent'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Contenu des tabs */}
        {activeTab === 'emails' && (
          <EmailList
            emails={emails}
            loading={loading}
            onFeedback={handleFeedback}
            showFilters
          />
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c10] p-6">
              <h3 className="text-[#f0f0f5] font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Répartition par catégorie
              </h3>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-24 h-4 bg-white/[0.06] rounded animate-pulse" />
                      <div className="flex-1 h-4 bg-white/[0.06] rounded animate-pulse" />
                      <div className="w-8 h-4 bg-white/[0.06] rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(stats?.byCategory ?? {}).map(([cat, count]) => {
                    const total = stats?.totalProcessed ?? 1
                    const pct = Math.round((count / total) * 100)
                    const colors: Record<string, string> = {
                      urgent: 'bg-red-600',
                      personal: 'bg-purple-600',
                      business: 'bg-blue-600',
                      invoices: 'bg-amber-600',
                      newsletters: 'bg-emerald-600',
                      spam: 'bg-zinc-600',
                    }
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="w-20 text-xs text-[#94949e] capitalize">{cat}</span>
                        <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[cat] ?? 'bg-zinc-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs text-[#5a5a66]">
                          {count} ({pct}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c10] p-5">
            <h3 className="text-[#f0f0f5] font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Activité récente
            </h3>
            <ActivityFeed emails={emails} />
          </div>
        )}

        {activeTab === 'pro' && (
          <ProToolsTab emails={emails} stats={stats} user={user} />
        )}

        {activeTab === 'billing' && (
          <BillingTab user={user} onCheckout={handleCheckout} onPortal={handlePortal} />
        )}

        {activeTab === 'settings' && (
          <SettingsTab user={user} />
        )}
      </main>

      {/* ── Agent IA flottant (bas-droite) — Pro only ── */}
      <MailAgent
        isPro={user?.plan === 'pro' || user?.plan === 'business'}
        onUpgrade={() => {
          setActiveTab('billing')
          window.history.replaceState({}, '', '/dashboard?tab=billing')
        }}
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center animate-pulse">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <p className="text-[#5a5a66] text-sm">Chargement…</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
