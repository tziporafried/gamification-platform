import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface ToastProps {
  message: string
  variant: 'success' | 'error'
  onDismiss: () => void
  autoDismissMs?: number
  size?: 'default' | 'large'
}

export function Toast({ message, variant, onDismiss, autoDismissMs, size = 'default' }: ToastProps) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!autoDismissMs) return
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(onDismiss, 200)
    }, autoDismissMs)
    return () => clearTimeout(timer)
  }, [autoDismissMs, onDismiss])

  function handleDismiss() {
    setExiting(true)
    setTimeout(onDismiss, 200)
  }

  const styles = {
    success: {
      bg: 'bg-surface-elevated border-success',
      text: 'text-success',
      icon: <CheckCircle2 size={18} className="text-success" />,
    },
    error: {
      bg: 'bg-surface-elevated border-danger',
      text: 'text-danger',
      icon: <XCircle size={18} className="text-danger" />,
    },
  }

  const s = styles[variant]
  const isLarge = size === 'large'

  return createPortal(
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 md:bottom-6">
      <div
        className={cn(
          'flex items-center rounded-xl border shadow-lg backdrop-blur-sm',
          isLarge ? 'gap-4 px-8 py-5' : 'gap-2.5 px-4 py-3',
          s.bg,
          exiting ? 'animate-toast-exit' : 'animate-toast-enter',
        )}
      >
        {isLarge ? (
          <span className="shrink-0">{variant === 'success' ? <CheckCircle2 size={32} className="text-success" /> : <XCircle size={32} className="text-danger" />}</span>
        ) : (
          s.icon
        )}
        <span className={cn(isLarge ? 'text-2xl font-bold tracking-tight md:text-3xl' : 'text-sm font-medium', s.text)}>{message}</span>
        <button
          onClick={handleDismiss}
          className={cn('rounded-md transition-colors', theme.textMuted, theme.hoverText, isLarge ? 'ml-2 p-1' : 'ml-1 p-0.5')}
        >
          <X size={isLarge ? 18 : 14} />
        </button>
      </div>
    </div>,
    document.body,
  )
}
