import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface FormLabelProps {
  htmlFor?: string
  children: React.ReactNode
  className?: string
}

export function FormLabel({ htmlFor, children, className }: FormLabelProps) {
  return (
    <label htmlFor={htmlFor} className={cn('block text-sm font-medium mb-1', theme.label, className)}>
      {children}
    </label>
  )
}
