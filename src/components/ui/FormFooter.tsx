import { ReactNode } from 'react'
import { ModalActions } from './ModalActions'

interface FormFooterProps {
  children: ReactNode
  className?: string
}

export function FormFooter({ children, className }: FormFooterProps) {
  return <ModalActions className={className}>{children}</ModalActions>
}
