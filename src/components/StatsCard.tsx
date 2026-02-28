// ============================================================
// MailFlow — Composant : StatsCard
// Carte de statistiques avec icône, valeur, tendance
// ============================================================

'use client'

import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react'

// ----------------------------------------------------------
// Props
// ----------------------------------------------------------
interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  iconColor?: string
  trend?: {
    value: number
    label?: string
    direction?: 'up' | 'down' | 'neutral'
  }
  variant?: 'default' | 'highlighted' | 'compact'
  loading?: boolean
  className?: string
}

// ----------------------------------------------------------
// Composant
// ----------------------------------------------------------
export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-400',
  trend,
  variant = 'default',
  loading = false,
  className,
}: StatsCardProps) {
  const trendDirection = trend?.direction ?? (trend && trend.value > 0 ? 'up' : trend && trend.value < 0 ? 'down' : 'neutral')

  const trendColor =
    trendDirection === 'up'
      ? 'text-emerald-400'
      : trendDirection === 'down'
      ? 'text-red-400'
      : 'text-zinc-500'

  const TrendIcon =
    trendDirection === 'up'
      ? TrendingUp
      : trendDirection === 'down'
      ? TrendingDown
      : Minus

  if (loading) {
    return (
      <div
        className={clsx(
          'rounded-2xl border border-white/[0.06] bg-[#0c0c10] p-5',
          className
        )}
      >
        <div className="h-4 w-24 bg-white/[0.04] rounded-lg mb-3 animate-shimmer" />
        <div className="h-8 w-16 bg-white/[0.04] rounded-lg mb-2 animate-shimmer" />
        <div className="h-3 w-32 bg-white/[0.04] rounded-lg animate-shimmer" />
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        className={clsx(
          'flex items-center justify-between p-4 rounded-2xl border border-white/[0.06] bg-[#0c0c10]',
          className
        )}
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <Icon className={clsx('w-4 h-4', iconColor)} />
            </div>
          )}
          <div>
            <div className="text-sm text-[#94949e]">{title}</div>
            {subtitle && <div className="text-xs text-[#5a5a66]">{subtitle}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-[#f0f0f5]">{value}</div>
          {trend && (
            <div className={clsx('flex items-center justify-end gap-1 text-xs', trendColor)}>
              <TrendIcon className="w-3 h-3" />
              <span>{trend.value > 0 ? '+' : ''}{trend.value}{trend.label ?? '%'}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'group rounded-2xl border bg-[#0c0c10] p-5 transition-all duration-300 card-hover',
        variant === 'highlighted'
          ? 'border-indigo-500/20 bg-indigo-500/[0.03]'
          : 'border-white/[0.06]',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm text-[#94949e] font-medium">{title}</span>
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:border-white/[0.1] transition-colors duration-300">
            <Icon className={clsx('w-4 h-4', iconColor)} />
          </div>
        )}
      </div>

      <div className="text-3xl font-bold text-[#f0f0f5] mb-1">{value}</div>

      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-2">
          {trend && (
            <div className={clsx('flex items-center gap-1 text-xs font-medium', trendColor)}>
              <TrendIcon className="w-3 h-3" />
              <span>
                {trend.value > 0 ? '+' : ''}
                {trend.value}
                {trend.label ?? '%'}
              </span>
            </div>
          )}
          {subtitle && <span className="text-xs text-[#5a5a66]">{subtitle}</span>}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------
// Groupe de StatsCards
// ----------------------------------------------------------
interface StatsGridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

export function StatsGrid({ children, columns = 4, className }: StatsGridProps) {
  const colClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[columns]

  return (
    <div className={clsx('grid gap-4', colClass, className)}>
      {children}
    </div>
  )
}

export default StatsCard
