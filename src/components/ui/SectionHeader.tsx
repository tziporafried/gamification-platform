import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface SectionHeaderProps {
  icon: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
  iconClassName?: string
  titleClassName?: string
  subtitleClassName?: string
  size?: 'sm' | 'md'
  className?: string
}

const ICON_SIZE = { sm: 'h-8 w-8 rounded-lg', md: 'h-10 w-10 rounded-xl' }

export function SectionHeader({
  icon,
  title,
  subtitle,
  action,
  iconClassName = theme.iconBg,
  titleClassName,
  subtitleClassName,
  size = 'sm',
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-2">
        <div className={cn('flex items-center justify-center', ICON_SIZE[size], iconClassName)}>
          {icon}
        </div>
        <div>
          <h2 className={cn('font-bold', theme.text, size === 'md' ? 'text-xl' : 'text-lg', titleClassName)}>
            {title}
          </h2>
          {subtitle && <p className={cn('text-xs', theme.textMuted, subtitleClassName)}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}
