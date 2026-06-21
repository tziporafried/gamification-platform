import { type ReactNode } from 'react'
import { AnimatedCounter } from './AnimatedCounter'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: number
  gradient: string
  className?: string
}

export function StatCard({ icon, label, value, gradient, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-game-border bg-game-card p-4 transition-all duration-200 hover:border-brand-700/50',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white',
            gradient,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
          <AnimatedCounter
            value={value}
            className="text-2xl font-bold text-white"
          />
        </div>
      </div>
    </div>
  )
}
