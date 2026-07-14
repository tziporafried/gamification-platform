import { useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  titleClassName?: string
  children: ReactNode
  /** Optional override for the dimming layer behind the dialog. */
  overlayClassName?: string
  /** Optional override for the dialog panel (e.g. wider form modals). */
  dialogClassName?: string
  /** Optional override for the scrollable content area. */
  contentClassName?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  titleClassName,
  children,
  overlayClassName,
  dialogClassName,
  contentClassName,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className={cn(
          'absolute inset-0 bg-[rgba(40,25,20,0.4)] backdrop-blur-[1px]',
          overlayClassName,
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-modal shadow-modal animate-scale-in',
          dialogClassName,
        )}
      >
        <div className={cn('flex items-center justify-between border-b bg-modal px-6 py-4', theme.border)}>
          <h2 className={titleClassName ?? cn('text-lg font-semibold', theme.text)}>{title}</h2>
          <button
            onClick={onClose}
            className={cn('rounded-lg p-1 transition-colors', theme.textSubtle, theme.hoverSurface, theme.hoverText)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={cn('bg-modal px-6 py-4', contentClassName)}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
