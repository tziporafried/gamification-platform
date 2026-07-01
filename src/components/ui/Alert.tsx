import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { alertVariants, type AlertVariant } from '@/lib/theme'

interface AlertProps {
  variant?: AlertVariant
  message?: string
  children?: ReactNode
  className?: string
}

export function Alert({ variant = 'error', message, children, className }: AlertProps) {
  return (
    <div className={cn(alertVariants[variant], 'p-3 text-sm', className)}>
      {children ?? message}
    </div>
  )
}
