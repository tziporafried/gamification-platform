import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface PageTitleProps {
  title: string
  subtitle?: string
  action?: ReactNode
  size?: 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = { md: 'text-xl', lg: 'text-2xl', xl: 'text-3xl' }

export function PageTitle({ title, subtitle, action, size = 'lg', className }: PageTitleProps) {
  return (
    <div className={cn('flex w-full items-center justify-between gap-4', className)}>
      <div className="min-w-0 flex-1 text-right">
        <h1 className={cn('font-bold', SIZES[size], theme.text)}>{title}</h1>
        {subtitle && <p className={cn('mt-1 text-sm', theme.textMuted)}>{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
