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
  /**
   * Drop the header bar for full-bleed illustrated dialogs. The title is kept
   * for assistive tech and the close button floats over the content, so the
   * dialog reads as a designed panel rather than a system alert.
   */
  chromeless?: boolean
  /**
   * 'corner' pins the dialog to the bottom-right instead of centring it, for
   * announcements that should not take over the screen.
   */
  placement?: 'center' | 'corner'
}

/**
 * Open dialogs, oldest first. A dialog opened from inside another one (the
 * manage popup's delete confirmation, say) portals to the body as a sibling, so
 * the outer dialog's key handler would otherwise fight it - trapping Tab back
 * into itself and closing both on Escape. Only the last entry reacts to keys.
 */
const openDialogs: symbol[] = []

/** How many centred dialogs are holding the page's scroll lock. */
let scrollLocks = 0

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
  chromeless = false,
  placement = 'center',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  // The element that had focus when the dialog opened, so it can be restored.
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  // This dialog's identity in the open-dialog stack (see `openDialogs`).
  const tokenRef = useRef<symbol>()
  if (!tokenRef.current) tokenRef.current = Symbol('modal')

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

    const token = tokenRef.current!
    openDialogs.push(token)
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
      // A dialog on top of this one owns the keyboard until it closes.
      if (openDialogs[openDialogs.length - 1] !== token) return

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
    // A corner dialog deliberately leaves the page usable behind it, so it must
    // not freeze scrolling the way a centred, screen-covering one does.
    const locksScroll = placement === 'center'
    if (locksScroll) scrollLocks += 1
    if (scrollLocks > 0) document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey)
      const at = openDialogs.lastIndexOf(token)
      if (at !== -1) openDialogs.splice(at, 1)
      // Closing an inner dialog must not hand scrolling back to the page while
      // the dialog that opened it is still covering it.
      if (locksScroll) scrollLocks -= 1
      if (scrollLocks <= 0) document.body.style.overflow = ''
      // Return focus to whatever opened the dialog (WCAG 2.4.3).
      restoreFocusRef.current?.focus?.()
    }
  }, [isOpen, placement])

  if (!isOpen) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[200]',
        placement === 'center' && 'flex items-center justify-center p-3 sm:p-4',
      )}
    >
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
          'z-10 flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-modal shadow-modal animate-scale-in focus:outline-none motion-reduce:animate-none',
          placement === 'corner'
            // `right`/`bottom` are physical, so they are not flipped by the
            // app's dir="rtl" - this stays in the bottom-right corner.
            ? 'absolute bottom-3 right-3 w-[calc(100vw-1.5rem)] sm:bottom-5 sm:right-5'
            : 'relative w-full',
          dialogClassName ?? 'max-w-md',
        )}
      >
        {chromeless ? (
          <>
            <h2 id={titleId} className="sr-only">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className={cn(
                'absolute left-3 top-3 z-20 rounded-full bg-white/85 p-1.5 text-[#6b5a52] shadow-sm transition-colors hover:bg-white hover:text-[#2e221e]',
                theme.focusRing,
              )}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true" focusable="false">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
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
        )}
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
