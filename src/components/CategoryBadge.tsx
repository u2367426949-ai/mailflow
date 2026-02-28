// ============================================================
// MailFlow — Composant : CategoryBadge
// Badge coloré affichant la catégorie d'un email
// ============================================================

'use client'

import { clsx } from 'clsx'

export type EmailCategory =
  | 'urgent'
  | 'personal'
  | 'business'
  | 'invoices'
  | 'newsletters'
  | 'spam'
  | 'unknown'

interface CategoryConfig {
  label: string
  emoji: string
  className: string
  dotColor: string
}

const CATEGORY_CONFIG: Record<EmailCategory, CategoryConfig> = {
  urgent: {
    label: 'Urgent',
    emoji: '🔴',
    className: 'bg-red-900/30 text-red-400 border border-red-800/50',
    dotColor: 'bg-red-500',
  },
  personal: {
    label: 'Personnel',
    emoji: '👤',
    className: 'bg-purple-900/30 text-purple-400 border border-purple-800/50',
    dotColor: 'bg-purple-500',
  },
  business: {
    label: 'Business',
    emoji: '💼',
    className: 'bg-blue-900/30 text-blue-400 border border-blue-800/50',
    dotColor: 'bg-blue-500',
  },
  invoices: {
    label: 'Factures',
    emoji: '📄',
    className: 'bg-amber-900/30 text-amber-400 border border-amber-800/50',
    dotColor: 'bg-amber-500',
  },
  newsletters: {
    label: 'Newsletters',
    emoji: '📰',
    className: 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50',
    dotColor: 'bg-emerald-500',
  },
  spam: {
    label: 'Spam',
    emoji: '🗑️',
    className: 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50',
    dotColor: 'bg-zinc-500',
  },
  unknown: {
    label: 'Inconnu',
    emoji: '❓',
    className: 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50',
    dotColor: 'bg-zinc-400',
  },
}

// ----------------------------------------------------------
// Props
// ----------------------------------------------------------
interface CategoryBadgeProps {
  category: EmailCategory | string
  size?: 'xs' | 'sm' | 'md'
  showEmoji?: boolean
  showDot?: boolean
  confidence?: number
  className?: string
}

// ----------------------------------------------------------
// Composant
// ----------------------------------------------------------
export function CategoryBadge({
  category,
  size = 'sm',
  showEmoji = true,
  showDot = false,
  confidence,
  className,
}: CategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category as EmailCategory] ?? CATEGORY_CONFIG.unknown

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
        config.className,
        sizeClasses[size],
        className
      )}
      title={confidence !== undefined ? `Confiance: ${Math.round(confidence * 100)}%` : undefined}
    >
      {showDot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dotColor)} />
      )}
      {showEmoji && <span>{config.emoji}</span>}
      <span>{config.label}</span>
      {confidence !== undefined && confidence < 0.7 && (
        <span className="opacity-60 text-[10px]">({Math.round(confidence * 100)}%)</span>
      )}
    </span>
  )
}

// ----------------------------------------------------------
// Badge de confiance
// ----------------------------------------------------------
interface ConfidenceBadgeProps {
  confidence: number
  className?: string
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const pct = Math.round(confidence * 100)

  const colorClass =
    pct >= 85
      ? 'text-emerald-400 bg-emerald-900/30'
      : pct >= 60
      ? 'text-amber-400 bg-amber-900/30'
      : 'text-red-400 bg-red-900/30'

  return (
    <span
      className={clsx(
        'inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium',
        colorClass,
        className
      )}
    >
      {pct}%
    </span>
  )
}

export default CategoryBadge
