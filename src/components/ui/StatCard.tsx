import { type ReactNode } from 'react'
import { AnimatedCounter } from './AnimatedCounter'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: number
  iconColor?: string
  className?: string
}

export function StatCard({ icon, label, value, iconColor, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: (iconColor || '#7c3aed') + '14',
            color: iconColor || '#7c3aed',
          }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <AnimatedCounter
            value={value}
            className="text-xl font-bold text-gray-900"
          />
        </div>
      </div>
    </div>
  )
}
