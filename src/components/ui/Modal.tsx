import { useEffect, useId, useRef, ReactNode } from 'react'
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
  /** Optional override for the title bar (e.g. glass / borderless headers). */
  headerClassName?: string
  /** Optional override for the scrollable content area. */
  contentClassName?: string
}

/** Elements that can hold focus inside the dialog, in DOM order. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function Modal({
  isOpen,
  onClose,
  title,
  titleClassName,
  children,
  overlayClassName,
  dialogClassName,
  headerClassName,
  contentClassName,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  // The element that had focus when the dialog opened, so it can be restored.
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // Escape reads onClose through a ref so the effect below can depend on
  // `isOpen` alone. Callers routinely pass an inline/unmemoized handler, and a
  // new identity per render would re-run the effect - stealing focus back to
  // the first control on every keystroke.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!isOpen) return

    restoreFocusRef.current = document.activeElement as HTMLElement | null

    function focusable(): HTMLElement[] {
      const root = dialogRef.current
      if (!root) return []
      return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement)
    }

    // Move focus in. Prefer the first control; fall back to the dialog itself so
    // the screen reader lands inside rather than staying behind the overlay.
    const first = focusable()[0]
    if (first) first.focus()
    else dialogRef.current?.focus()

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      // Focus trap - wrap at both ends so Tab never escapes to the page behind.
      const items = focusable()
      if (items.length === 0) {
        e.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      const active = document.activeElement

      if (!e.shiftKey && active === lastItem) {
        e.preventDefault()
        firstItem.focus()
      } else if (e.shiftKey && active === firstItem) {
        e.preventDefault()
        lastItem.focus()
      } else if (active && !dialogRef.current?.contains(active)) {
        // Focus drifted out (e.g. browser chrome round-trip) - pull it back.
        e.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
      // Return focus to whatever opened the dialog (WCAG 2.4.3).
      restoreFocusRef.current?.focus?.()
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
      <div
        className={cn(
          'absolute inset-0 bg-[rgba(40,25,20,0.4)] backdrop-blur-[1px]',
          overlayClassName,
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          // Default max-w-md only when callers don't override width - `cn` does not
          // tailwind-merge, so a hard-coded max-w-md would beat dialogClassName.
          // Cap height so long content scrolls inside the body instead of clipping.
          'relative z-10 flex w-full max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-modal shadow-modal animate-scale-in focus:outline-none motion-reduce:animate-none',
          dialogClassName ?? 'max-w-md',
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-between border-b bg-modal px-6 py-4',
            theme.border,
            headerClassName,
          )}
        >
          <h2 id={titleId} className={titleClassName ?? cn('text-lg font-semibold', theme.text)}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className={cn(
              'shrink-0 rounded-lg p-1 transition-colors',
              theme.textSubtle, theme.hoverSurface, theme.hoverText, theme.focusRing,
            )}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true" focusable="false">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-modal px-6 py-4',
            contentClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
