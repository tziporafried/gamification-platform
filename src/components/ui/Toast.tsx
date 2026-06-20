import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastProps {
  message: string
  variant: 'success' | 'error'
  onDismiss: () => void
  autoDismissMs?: number
}

export function Toast({ message, variant, onDismiss, autoDismissMs }: ToastProps) {
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
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-800',
      icon: <CheckCircle2 size={18} className="text-emerald-500" />,
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: <XCircle size={18} className="text-red-500" />,
    },
  }

  const s = styles[variant]

  return createPortal(
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-lg',
          s.bg,
          exiting ? 'animate-toast-exit' : 'animate-toast-enter',
        )}
      >
        {s.icon}
        <span className={cn('text-sm font-medium', s.text)}>{message}</span>
        <button
          onClick={handleDismiss}
          className="ml-1 rounded-md p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>,
    document.body,
  )
}
