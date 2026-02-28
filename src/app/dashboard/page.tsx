// ============================================================
// MailFlow — Dashboard utilisateur
// ============================================================

'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
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
} from 'lucide-react'
import { EmailList } from '@/components/EmailList'
import { StatsCard, StatsGrid } from '@/components/StatsCard'
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
}

// ----------------------------------------------------------
// Hook : charger les données du dashboard
// ----------------------------------------------------------
function useDashboardData() {
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/emails?limit=50')
      if (!res.ok) throw new Error('Failed to fetch emails')
      const data = await res.json()
      setEmails(
        (data.emails ?? []).map((e: any) => ({
          ...e,
          receivedAt: new Date(e.receivedAt),
        }))
      )
    } catch (err) {
      console.error('[Dashboard] Error fetching emails:', err)
    }
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
    setLoading(false)
  }, [fetchEmails, fetchStats, fetchUser])

  useEffect(() => {
    load()
  }, [load])

  const sync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/emails/process', { method: 'POST' })
      if (res.ok) {
        await fetchEmails()
        await fetchStats()
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

  return { emails, stats, user, loading, syncing, error, sync, handleFeedback }
}

// ----------------------------------------------------------
// Composant Header du dashboard
// ----------------------------------------------------------
function DashboardHeader({
  user,
  syncing,
  onSync,
}: {
  user: UserSession | null
  syncing: boolean
  onSync: () => void
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#2a2a2a] bg-[#0a0a0a]/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-[#f5f5f5]">MailFlow</span>
            </Link>
            <span className="text-[#3a3a3a]">/</span>
            <span className="text-sm text-[#a0a0a0]">Dashboard</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Plan badge */}
            {user && (
              <span
                className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                  user.plan === 'free'
                    ? 'bg-zinc-800 text-zinc-400'
                    : user.plan === 'pro'
                    ? 'bg-blue-900/50 text-blue-400'
                    : user.plan === 'business'
                    ? 'bg-purple-900/50 text-purple-400'
                    : 'bg-emerald-900/50 text-emerald-400'
                }`}
              >
                {user.plan}
              </span>
            )}

            {/* Sync button */}
            <button
              onClick={onSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#3a3a3a] text-[#a0a0a0] hover:text-[#f5f5f5] hover:border-[#4a4a4a] text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Sync...' : 'Synchroniser'}</span>
            </button>

            {/* User menu */}
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg text-[#6a6a6a] hover:text-[#a0a0a0] hover:bg-[#1e1e1e] transition-colors">
                <Bell className="w-4 h-4" />
              </button>
              <Link
                href="/dashboard?tab=settings"
                className="p-2 rounded-lg text-[#6a6a6a] hover:text-[#a0a0a0] hover:bg-[#1e1e1e] transition-colors"
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
// Composant : Bannière plan gratuit
// ----------------------------------------------------------
function FreePlanBanner() {
  return (
    <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 flex items-center gap-3">
      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-amber-400 font-medium">
          Plan gratuit — Le tri IA est désactivé
        </p>
        <p className="text-xs text-amber-400/70 mt-0.5">
          Passe à un plan payant pour activer la classification automatique de tes emails.
        </p>
      </div>
      <Link
        href="/dashboard?tab=billing"
        className="flex-shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        Upgrader
      </Link>
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
        <Mail className="w-8 h-8 text-[#3a3a3a] mx-auto mb-2" />
        <p className="text-sm text-[#6a6a6a]">Aucune activité récente</p>
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
            <span className="text-xs text-[#6a6a6a] w-10 flex-shrink-0">{timeAgo}</span>
            <span className="flex-1 text-xs text-[#a0a0a0] truncate">
              Email{' '}
              <span className={categoryColors[email.category] ?? 'text-[#a0a0a0]'}>
                {categoryLabels[email.category] ?? email.category}
              </span>
              {' — '}
              <span className="text-[#6a6a6a]">{email.subject}</span>
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
  const [digestEnabled, setDigestEnabled] = useState(true)
  const [digestTime, setDigestTime] = useState('08:00')
  const [timezone, setTimezone] = useState('Europe/Paris')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  return (
    <div className="space-y-6">
      {/* Profil */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-6">
        <h3 className="text-[#f5f5f5] font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-400" />
          Profil
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#6a6a6a] mb-1.5">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-sm text-[#f5f5f5] focus:outline-none focus:border-blue-600"
              placeholder="Votre nom"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6a6a6a] mb-1.5">Email</label>
            <div className="px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-sm text-[#6a6a6a]">
              {user?.email ?? '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Digest */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-6">
        <h3 className="text-[#f5f5f5] font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4 text-emerald-400" />
          Digest quotidien
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[#f5f5f5]">Activer le digest</div>
              <div className="text-xs text-[#6a6a6a]">Recevez un résumé quotidien de vos emails</div>
            </div>
            <button
              onClick={() => setDigestEnabled(!digestEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                digestEnabled ? 'bg-blue-600' : 'bg-[#3a3a3a]'
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
                <label className="block text-xs text-[#6a6a6a] mb-1.5">Heure d&apos;envoi</label>
                <input
                  type="time"
                  value={digestTime}
                  onChange={(e) => setDigestTime(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-sm text-[#f5f5f5] focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs text-[#6a6a6a] mb-1.5">Fuseau horaire</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-sm text-[#f5f5f5] focus:outline-none focus:border-blue-600"
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

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {saving ? 'Sauvegarde...' : saved ? '✓ Sauvegardé' : 'Sauvegarder'}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------
// Page Dashboard principale
// ----------------------------------------------------------
function DashboardContent() {
  const { emails, stats, user, loading, syncing, error, sync, handleFeedback } = useDashboardData()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab')

  const validTabs = ['emails', 'stats', 'activity', 'billing', 'settings'] as const
  type TabId = typeof validTabs[number]

  const initialTab: TabId = validTabs.includes(tabFromUrl as TabId) ? (tabFromUrl as TabId) : 'emails'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  // Sync tab with URL changes
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl as TabId)) {
      setActiveTab(tabFromUrl as TabId)
    }
  }, [tabFromUrl])

  const tabs = [
    { id: 'emails' as const, label: 'Emails', icon: Mail },
    { id: 'stats' as const, label: 'Statistiques', icon: BarChart3 },
    { id: 'activity' as const, label: 'Activité', icon: Clock },
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
    <div className="min-h-screen bg-[#0a0a0a]">
      <DashboardHeader user={user} syncing={syncing} onSync={sync} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#f5f5f5]">
            Bonjour{user?.name ? ` ${user.name.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="text-sm text-[#6a6a6a] mt-1">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>

        {/* Bannière plan gratuit */}
        {user?.plan === 'free' && (
          <div className="mb-6">
            <FreePlanBanner />
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="mb-6 p-3 rounded-lg border border-red-800/50 bg-red-950/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Stats rapides */}
        <StatsGrid columns={4} className="mb-6">
          <StatsCard
            title="Emails traités"
            value={loading ? '—' : (stats?.totalProcessed ?? 0).toLocaleString()}
            icon={Mail}
            iconColor="text-blue-400"
            loading={loading}
            subtitle="Total depuis l'activation"
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

        {/* Tabs */}
        <div className="border-b border-[#2a2a2a] mb-6">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-[#f5f5f5]'
                    : 'border-transparent text-[#6a6a6a] hover:text-[#a0a0a0]'
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
            <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-6">
              <h3 className="text-[#f5f5f5] font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Répartition par catégorie
              </h3>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-24 h-4 bg-[#2a2a2a] rounded animate-pulse" />
                      <div className="flex-1 h-4 bg-[#2a2a2a] rounded animate-pulse" />
                      <div className="w-8 h-4 bg-[#2a2a2a] rounded animate-pulse" />
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
                        <span className="w-20 text-xs text-[#a0a0a0] capitalize">{cat}</span>
                        <div className="flex-1 h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[cat] ?? 'bg-zinc-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs text-[#6a6a6a]">
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
          <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-5">
            <h3 className="text-[#f5f5f5] font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Activité récente
            </h3>
            <ActivityFeed emails={emails} />
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Plan actuel */}
            <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-6">
              <h3 className="text-[#f5f5f5] font-semibold mb-4">Plan actuel</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-[#f5f5f5] capitalize">
                    {user?.plan ?? 'free'}
                  </div>
                  <div className="text-sm text-[#6a6a6a] mt-1">
                    {user?.plan === 'free'
                      ? 'Fonctionnalités limitées'
                      : 'Toutes les fonctionnalités incluses'}
                  </div>
                </div>
                {user?.plan !== 'free' && (
                  <button
                    onClick={handlePortal}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#3a3a3a] text-[#a0a0a0] hover:text-[#f5f5f5] hover:border-[#4a4a4a] text-sm transition-colors"
                  >
                    Gérer mon abonnement
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Plans disponibles si free */}
            {user?.plan === 'free' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'starter', name: 'Starter', price: '9€/mois', emails: '100 emails/jour' },
                  { id: 'pro', name: 'Pro', price: '29€/mois', emails: '500 emails/jour', highlighted: true },
                  { id: 'business', name: 'Business', price: '79€/mois', emails: '2000 emails/jour' },
                ].map((plan) => (
                  <div
                    key={plan.id}
                    className={`p-5 rounded-xl border ${
                      plan.highlighted
                        ? 'border-blue-600 bg-blue-950/20'
                        : 'border-[#2a2a2a] bg-[#141414]'
                    }`}
                  >
                    <div className="text-lg font-bold text-[#f5f5f5] mb-1">{plan.name}</div>
                    <div className="text-2xl font-bold text-[#f5f5f5] mb-1">{plan.price}</div>
                    <div className="text-xs text-[#6a6a6a] mb-4">{plan.emails}</div>
                    <button
                      onClick={() => handleCheckout(plan.id)}
                      className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                        plan.highlighted
                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                          : 'bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#3a3a3a] text-[#f5f5f5]'
                      }`}
                    >
                      Essayer 14 jours gratuit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <SettingsTab user={user} />
        )}
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#6a6a6a] text-sm">Chargement...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
