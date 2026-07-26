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
      bg: 'bg-surface-elevated border-success-text',
      text: 'text-success-text',
      icon: <CheckCircle2 size={18} className="text-success-text" aria-hidden="true" />,
    },
    error: {
      bg: 'bg-surface-elevated border-danger-text',
      text: 'text-danger-text',
      icon: <XCircle size={18} className="text-danger-text" aria-hidden="true" />,
    },
  }

  const s = styles[variant]
  const isLarge = size === 'large'

  return createPortal(
    // Above dialogs (z-[200]): a toast is often the result of an action taken
    // inside one, and behind the overlay it would never be seen.
    <div className="fixed bottom-20 left-1/2 z-[300] -translate-x-1/2 md:bottom-6">
      <div
        // Errors interrupt; success is polite. Without this the toast appeared
        // and vanished with no announcement at all (WCAG 4.1.3).
        role={variant === 'error' ? 'alert' : 'status'}
        aria-live={variant === 'error' ? 'assertive' : 'polite'}
        className={cn(
          'flex items-center rounded-xl border shadow-lg backdrop-blur-sm',
          isLarge ? 'gap-4 px-8 py-5' : 'gap-2.5 px-4 py-3',
          s.bg,
          exiting ? 'animate-toast-exit' : 'animate-toast-enter',
          'motion-reduce:animate-none',
        )}
      >
        {isLarge ? (
          <span className="shrink-0" aria-hidden="true">{variant === 'success' ? <CheckCircle2 size={32} className="text-success-text" /> : <XCircle size={32} className="text-danger-text" />}</span>
        ) : (
          s.icon
        )}
        <span className={cn(isLarge ? 'text-2xl font-bold tracking-tight md:text-3xl' : 'text-sm font-medium', s.text)}>{message}</span>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="סגירת ההודעה"
          className={cn('rounded-md transition-colors', theme.textMuted, theme.hoverText, theme.focusRing, isLarge ? 'ml-2 p-1' : 'ml-1 p-0.5')}
        >
          <X size={isLarge ? 18 : 14} aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
