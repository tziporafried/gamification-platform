import { cn } from '@/lib/utils'

interface XPBarProps {
  current: number
  target: number
  label?: string
  className?: string
}

export function XPBar({ current, target, label, className }: XPBarProps) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-gray-600">{label}</span>
          <span className="tabular-nums text-gray-400">
            {current.toLocaleString()} / {target.toLocaleString()}
          </span>
        </div>
      )}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percentage}%`,
            background: 'linear-gradient(90deg, #059669, #34d399)',
          }}
        >
          <div
            className="absolute inset-0 rounded-full opacity-30 animate-shimmer"
            style={{
              backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      </div>
    </div>
  )
}
