import { useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  titleClassName?: string
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, titleClassName, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

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
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className={cn('w-full max-w-md rounded-2xl border shadow-xl animate-scale-in', theme.bgInset, theme.border)}>
        <div className={cn('flex items-center justify-between border-b px-6 py-4', theme.border)}>
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
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
