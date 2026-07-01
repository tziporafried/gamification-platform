import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FormFooterProps {
  children: ReactNode
  className?: string
}

export function FormFooter({ children, className }: FormFooterProps) {
  return (
    <div className={cn('flex gap-3 pt-2', className)}>
      {children}
    </div>
  )
}
