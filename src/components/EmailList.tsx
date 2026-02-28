// ============================================================
// MailFlow — Composant : EmailList
// Liste des emails triés avec catégories et actions
// ============================================================

'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  MailOpen,
  Mail,
  AlertTriangle,
  ChevronDown,
  ThumbsDown,
  ExternalLink,
  Loader2,
  Filter,
} from 'lucide-react'
import { CategoryBadge, ConfidenceBadge } from './CategoryBadge'
import type { EmailCategory } from './CategoryBadge'

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
export interface EmailItem {
  id: string
  gmailId: string
  from: string
  subject: string
  snippet: string
  receivedAt: Date | string
  category: EmailCategory
  confidence: number
  isRead: boolean
  isLabeled: boolean
  aiReason?: string | null
}

// ----------------------------------------------------------
// Props
// ----------------------------------------------------------
interface EmailListProps {
  emails: EmailItem[]
  loading?: boolean
  onFeedback?: (emailId: string, correctedCategory: EmailCategory) => Promise<void>
  showFilters?: boolean
  className?: string
}

// ----------------------------------------------------------
// Composant EmailRow (ligne d'email)
// ----------------------------------------------------------
function EmailRow({
  email,
  onFeedback,
}: {
  email: EmailItem
  onFeedback?: (emailId: string, correctedCategory: EmailCategory) => Promise<void>
}) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [corrected, setCorrected] = useState(false)

  const receivedAt =
    typeof email.receivedAt === 'string' ? new Date(email.receivedAt) : email.receivedAt

  const timeAgo = formatDistanceToNow(receivedAt, { addSuffix: true, locale: fr })

  const categories: EmailCategory[] = [
    'urgent',
    'personal',
    'business',
    'invoices',
    'newsletters',
    'spam',
  ]

  const handleFeedback = async (category: EmailCategory) => {
    if (!onFeedback) return
    setSubmitting(true)
    try {
      await onFeedback(email.id, category)
      setCorrected(true)
      setShowFeedback(false)
    } catch (err) {
      console.error('[EmailRow] Feedback failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Extraire le nom de l'expéditeur
  const senderName = email.from.match(/^(.+?)\s*</) 
    ? email.from.match(/^(.+?)\s*</)?.[1].trim()
    : email.from.split('@')[0]

  return (
    <div
      className={clsx(
        'group relative border-b border-white/[0.06] last:border-0 transition-colors hover:bg-white/[0.02]',
        !email.isRead && 'bg-white/[0.01]',
        email.isRead && 'opacity-80'
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Indicateur lu/non lu */}
        <div className="mt-1 flex-shrink-0">
          {email.isRead ? (
            <MailOpen className="w-4 h-4 text-[#5a5a66]" />
          ) : (
            <Mail className="w-4 h-4 text-indigo-400" />
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={clsx(
                  'text-sm truncate',
                  email.isRead ? 'text-[#94949e] font-normal' : 'text-[#f0f0f5] font-semibold'
                )}
              >
                {senderName}
              </span>
              {corrected && (
                <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  ✓ Corrigé
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-[#5a5a66]">{timeAgo}</span>
            </div>
          </div>

          <div
            className={clsx(
              'text-sm truncate mb-1',
              email.isRead ? 'text-[#94949e]' : 'text-[#f0f0f5]'
            )}
          >
            {email.subject}
          </div>

          <div className="text-xs text-[#5a5a66] truncate mb-2">{email.snippet}</div>

          {/* Badges et actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CategoryBadge category={email.category} size="xs" showEmoji />
              {email.confidence < 0.7 && (
                <ConfidenceBadge confidence={email.confidence} />
              )}
              {email.category === 'urgent' && (
                <AlertTriangle className="w-3 h-3 text-red-400" />
              )}
            </div>

            {/* Actions visibles au hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Ouvrir dans Gmail */}
              <a
                href={`https://mail.google.com/mail/u/0/#inbox/${email.gmailId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-white/[0.05] text-[#5a5a66] hover:text-[#94949e] transition-colors"
                title="Ouvrir dans Gmail"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* Feedback */}
              {onFeedback && !corrected && (
                <button
                  onClick={() => setShowFeedback(!showFeedback)}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors',
                    showFeedback
                      ? 'bg-white/[0.05] text-[#94949e]'
                      : 'text-[#5a5a66] hover:bg-white/[0.05] hover:text-[#94949e]'
                  )}
                  title="Mal classé ?"
                >
                  <ThumbsDown className="w-3 h-3" />
                  <span>Mal classé</span>
                  <ChevronDown
                    className={clsx(
                      'w-3 h-3 transition-transform',
                      showFeedback && 'rotate-180'
                    )}
                  />
                </button>
              )}
            </div>
          </div>

          {/* Dropdown de correction */}
          {showFeedback && (
            <div className="mt-2 p-2 rounded-xl border border-white/[0.06] bg-[#0c0c10]">
              <p className="text-xs text-[#94949e] mb-2">
                Dans quelle catégorie cet email devrait-il être ?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categories
                  .filter((c) => c !== email.category)
                  .map((category) => (
                    <button
                      key={category}
                      onClick={() => handleFeedback(category)}
                      disabled={submitting}
                      className="hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      <CategoryBadge category={category} size="xs" showEmoji />
                    </button>
                  ))}
                {submitting && <Loader2 className="w-4 h-4 animate-spin text-[#5a5a66]" />}
              </div>
              {email.aiReason && (
                <p className="mt-2 text-xs text-[#5a5a66] italic">
                  IA : {email.aiReason}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------
// Composant EmailList principal
// ----------------------------------------------------------
export function EmailList({
  emails,
  loading = false,
  onFeedback,
  showFilters = true,
  className,
}: EmailListProps) {
  const [activeFilter, setActiveFilter] = useState<EmailCategory | 'all'>('all')

  const categories: Array<{ id: EmailCategory | 'all'; label: string }> = [
    { id: 'all', label: 'Tous' },
    { id: 'urgent', label: '🔴 Urgent' },
    { id: 'business', label: '💼 Business' },
    { id: 'personal', label: '👤 Personnel' },
    { id: 'invoices', label: '📄 Factures' },
    { id: 'newsletters', label: '📰 Newsletters' },
    { id: 'spam', label: '🗑️ Spam' },
  ]

  const filteredEmails =
    activeFilter === 'all'
      ? emails
      : emails.filter((e) => e.category === activeFilter)

  if (loading) {
    return (
      <div className={clsx('rounded-2xl border border-white/[0.06] bg-[#0c0c10]', className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3 border-b border-white/[0.06] last:border-0 animate-pulse">
            <div className="w-4 h-4 mt-1 rounded bg-white/[0.06] flex-shrink-0" />
            <div className="flex-1">
              <div className="h-3 w-24 bg-white/[0.06] rounded mb-2" />
              <div className="h-3 w-full bg-white/[0.06] rounded mb-2" />
              <div className="h-3 w-3/4 bg-white/[0.06] rounded mb-2" />
              <div className="h-5 w-16 bg-white/[0.06] rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={clsx('rounded-2xl border border-white/[0.06] bg-[#0c0c10] overflow-hidden', className)}>
      {/* Filtres par catégorie */}
      {showFilters && (
        <div className="flex items-center gap-1 p-2 border-b border-white/[0.06] overflow-x-auto scrollbar-hide">
          <Filter className="w-3.5 h-3.5 text-[#5a5a66] flex-shrink-0 ml-1" />
          {categories.map((cat) => {
            const count = cat.id === 'all'
              ? emails.length
              : emails.filter((e) => e.category === cat.id).length

            return (
              <button
                key={cat.id}
                onClick={() => setActiveFilter(cat.id)}
                className={clsx(
                  'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                  activeFilter === cat.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-[#94949e] hover:bg-white/[0.05]'
                )}
              >
                {cat.label}
                {count > 0 && (
                  <span
                    className={clsx(
                      'ml-1.5 text-[10px]',
                      activeFilter === cat.id ? 'text-indigo-200' : 'text-[#5a5a66]'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Liste des emails */}
      {filteredEmails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MailOpen className="w-10 h-10 text-white/[0.08] mb-3" />
          <p className="text-[#5a5a66] text-sm">
            {activeFilter === 'all'
              ? 'Aucun email traité pour le moment'
              : `Aucun email dans la catégorie "${activeFilter}"`}
          </p>
        </div>
      ) : (
        filteredEmails.map((email) => (
          <EmailRow key={email.id} email={email} onFeedback={onFeedback} />
        ))
      )}
    </div>
  )
}

export default EmailList
