import { cn } from '@/lib/utils'

interface ErrorAlertProps {
  message: string
  className?: string
}

export function ErrorAlert({ message, className }: ErrorAlertProps) {
  return (
    <div className={cn('rounded-lg bg-red-900/20 border border-red-800/30 p-3 text-sm text-red-300', className)}>
      {message}
    </div>
  )
}
