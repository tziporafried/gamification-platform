import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ModalActionsProps {
  children: ReactNode
  className?: string
}

/** Modal footer button row — primary action leftmost, group aligned left in RTL. */
export function ModalActions({ children, className }: ModalActionsProps) {
  return (
    <div className={cn('flex flex-row-reverse justify-start gap-3 pt-2', className)}>
      {children}
    </div>
  )
}
