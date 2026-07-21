import { useEffect, useId, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import {
  trackLiveEventSelect,
  trackLiveEventsModalClose,
} from '@/lib/analytics'
import {
  LIVE_EVENT_CATALOG,
  isLiveEventLaunchable,
  type LiveEventCatalogId,
  type LiveEventCatalogItem,
} from './types'

const TRANSITION_MS = 0.42
const EASE = [0.22, 1, 0.36, 1] as const
/** Hold teal through most of the expand, then dissolve slowly into glass. */
const BRIGHTEN_DELAY = 0.3
const BRIGHTEN_MS = 0.48
const CONTENT_DELAY = 0.48
const CONTENT_MS = 0.28

export type LiveEventsOriginRect = Pick<DOMRect, 'top' | 'left' | 'width' | 'height'>

interface LiveEventsSelectModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  /** Dashboard card bounds - modal expands from this rect. */
  originRect?: LiveEventsOriginRect | null
}

const CARD_GRADIENT: Record<LiveEventCatalogItem['accent'], string> = {
  legendary: 'gradient-reward-legendary',
  rich: 'gradient-reward-rich',
  medium: 'gradient-reward-medium',
  starter: 'gradient-reward-starter',
  accent: 'gradient-reward-accent',
  tertiary: 'gradient-reward-tertiary',
  danger: 'gradient-reward-danger',
  muted: 'gradient-reward-muted',
}

const CARD_SHADOW: Record<LiveEventCatalogItem['accent'], string> = {
  legendary:
    'shadow-[0_14px_32px_rgba(46,34,30,0.18),0_0_28px_rgba(216,48,0,0.28)]',
  rich:
    'shadow-[0_14px_32px_rgba(46,34,30,0.18),0_0_28px_rgba(255,184,0,0.32)]',
  medium:
    'shadow-[0_14px_32px_rgba(46,34,30,0.18),0_0_28px_rgba(0,144,144,0.28)]',
  starter:
    'shadow-[0_14px_32px_rgba(46,34,30,0.18),0_0_28px_rgba(69,207,107,0.32)]',
  accent:
    'shadow-[0_14px_32px_rgba(46,34,30,0.18),0_0_28px_rgba(252,96,36,0.32)]',
  tertiary:
    'shadow-[0_14px_32px_rgba(46,34,30,0.18),0_0_28px_rgba(252,144,0,0.32)]',
  danger:
    'shadow-[0_14px_32px_rgba(46,34,30,0.18),0_0_28px_rgba(255,77,77,0.32)]',
  muted:
    'shadow-[0_14px_32px_rgba(46,34,30,0.18),0_0_28px_rgba(125,112,106,0.28)]',
}

const CARD_SHADOW_HOVER: Record<LiveEventCatalogItem['accent'], string> = {
  legendary:
    'hover:shadow-[0_20px_44px_rgba(46,34,30,0.24),0_0_36px_rgba(216,48,0,0.38)]',
  rich:
    'hover:shadow-[0_20px_44px_rgba(46,34,30,0.24),0_0_36px_rgba(255,184,0,0.42)]',
  medium:
    'hover:shadow-[0_20px_44px_rgba(46,34,30,0.24),0_0_36px_rgba(0,144,144,0.38)]',
  starter:
    'hover:shadow-[0_20px_44px_rgba(46,34,30,0.24),0_0_36px_rgba(69,207,107,0.42)]',
  accent:
    'hover:shadow-[0_20px_44px_rgba(46,34,30,0.24),0_0_36px_rgba(252,96,36,0.42)]',
  tertiary:
    'hover:shadow-[0_20px_44px_rgba(46,34,30,0.24),0_0_36px_rgba(252,144,0,0.42)]',
  danger:
    'hover:shadow-[0_20px_44px_rgba(46,34,30,0.24),0_0_36px_rgba(255,77,77,0.42)]',
  muted:
    'hover:shadow-[0_20px_44px_rgba(46,34,30,0.24),0_0_36px_rgba(125,112,106,0.38)]',
}

const CARD_BLURB: Record<LiveEventCatalogId, string> = {
  lottery: 'בחרו פרס ומשתתפים - והשיקו הגרלה משלכם.',
  'bonus-points': 'העניקו נקודות בונוס לשחקנים או לקבוצות שבחרתם.',
  'flash-challenge': 'השיקו אתגר פתע באמצע המשחק.',
}

const UPCOMING_SLOT = 'w-full sm:w-[calc((100%-0.875rem)/2)]'
const AVAILABLE_SLOT = 'w-full sm:w-[calc((100%-0.875rem)/2*1.07)]'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function AvailableEventCard({
  item,
  blurb,
  onLaunch,
}: {
  item: LiveEventCatalogItem
  blurb: string
  onLaunch: () => void
}) {
  const Icon = item.icon

  return (
    <button
      type="button"
      onClick={onLaunch}
      className={cn(
        'group relative flex min-h-[13.75rem] w-full flex-col overflow-hidden rounded-2xl p-5 text-right',
        'ring-2 ring-white/45',
        CARD_SHADOW[item.accent],
        CARD_SHADOW_HOVER[item.accent],
        'brightness-[1.04] saturate-[1.08]',
        'transition-[transform,box-shadow,filter] duration-200 ease-out',
        'hover:scale-[1.03] hover:brightness-110',
        'active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      )}
    >
      <div className={cn('absolute inset-0', CARD_GRADIENT[item.accent])} aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_18%,rgba(255,255,255,0.34),transparent_52%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-200 ease-out group-hover:bg-white/14"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/30 blur-2xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-black/15 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-1 flex-col items-center justify-center text-center">
        <span className="mb-3.5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-white/40 bg-white/25 shadow-[0_12px_28px_rgba(0,0,0,0.22)] backdrop-blur-sm">
          <Icon size={34} strokeWidth={2.25} className="text-white drop-shadow-md" aria-hidden="true" />
        </span>
        <span className="text-xl font-black tracking-tight text-white drop-shadow-sm sm:text-[1.35rem]">
          {item.title}
        </span>
        <span className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug text-white/90">
          {blurb}
        </span>
      </div>
    </button>
  )
}

function UpcomingEventCard({
  item,
  blurb,
}: {
  item: LiveEventCatalogItem
  blurb: string
}) {
  const Icon = item.icon

  return (
    <div
      aria-disabled="true"
      className={cn(
        'pointer-events-none relative flex min-h-[12.5rem] w-full cursor-default flex-col overflow-hidden rounded-2xl p-5 text-right',
        'ring-1 ring-white/25',
        'opacity-[0.72] saturate-[0.78] brightness-[0.96]',
        'shadow-[0_8px_20px_rgba(46,34,30,0.1)]',
      )}
    >
      <div className={cn('absolute inset-0', CARD_GRADIENT[item.accent])} aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 bg-white/25"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,255,255,0.14),transparent_55%)]"
        aria-hidden="true"
      />

      <span
        className={cn(
          'absolute start-3 top-3 z-10 inline-flex items-center gap-1',
          'rounded-full border border-white/40 bg-black/15 px-2.5 py-1 backdrop-blur-sm',
          'text-[10px] font-bold leading-none text-white',
        )}
      >
        <Sparkles size={9} strokeWidth={2.25} className="shrink-0 opacity-90" aria-hidden="true" />
        בקרוב
      </span>

      <div className="relative flex flex-1 flex-col items-center justify-center text-center">
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-white/15 backdrop-blur-sm">
          <Icon size={28} strokeWidth={2.25} className="text-white drop-shadow-sm" aria-hidden="true" />
        </span>
        <span className="text-lg font-black text-white/95">{item.title}</span>
        <span className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug text-white/75">
          {blurb}
        </span>
      </div>
    </div>
  )
}

function originToCenterOffset(origin: LiveEventsOriginRect) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0
  const targetW = Math.min(640, Math.max(280, vw - 32))
  // Prefer width match so the shell starts as “the card” and clearly grows outward.
  const scale = Math.max(0.22, Math.min(origin.width / targetW, 0.58))
  return {
    x: origin.left + origin.width / 2 - vw / 2,
    y: origin.top + origin.height / 2 - vh / 2,
    scale,
  }
}

/**
 * Premium event launcher - expands from the dashboard card (FLIP zoom/fade).
 */
export function LiveEventsSelectModal({
  isOpen,
  onClose,
  eventId,
  originRect = null,
}: LiveEventsSelectModalProps) {
  const { available, upcoming } = useMemo(() => {
    const launchable = LIVE_EVENT_CATALOG.filter((item) => isLiveEventLaunchable(item))
    const soon = LIVE_EVENT_CATALOG.filter((item) => !isLiveEventLaunchable(item))
    return { available: launchable, upcoming: soon }
  }, [])
  const reduceMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  const originRef = useRef(originRect)

  useEffect(() => {
    onCloseRef.current = () => {
      trackLiveEventsModalClose(eventId)
      onClose()
    }
  })

  // Keep last origin for the close animation even if parent clears it.
  useEffect(() => {
    if (originRect) originRef.current = originRect
  }, [originRect])

  useEffect(() => {
    if (!isOpen) return

    restoreFocusRef.current = document.activeElement as HTMLElement | null

    function focusable(): HTMLElement[] {
      const root = dialogRef.current
      if (!root) return []
      return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
    }

    const first = focusable()[0]
    if (first) first.focus()
    else dialogRef.current?.focus()

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

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
        e.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
      restoreFocusRef.current?.focus?.()
    }
  }, [isOpen])

  function launch(id: LiveEventCatalogId) {
    if (id !== 'lottery') return
    trackLiveEventSelect({
      eventId,
      catalogId: id,
      launchable: true,
    })
    onCloseRef.current()
    window.open(`/events/${eventId}/lottery`, '_blank', 'noopener,noreferrer')
  }

  function handleClose() {
    onCloseRef.current()
  }

  const motionTransition = reduceMotion
    ? { duration: 0 }
    : { duration: TRANSITION_MS, ease: EASE }

  const brightenTransition = reduceMotion
    ? { duration: 0 }
    : { duration: BRIGHTEN_MS, delay: BRIGHTEN_DELAY, ease: [0.4, 0, 0.2, 1] as const }

  const contentTransition = reduceMotion
    ? { duration: 0 }
    : { duration: CONTENT_MS, delay: CONTENT_DELAY, ease: 'easeOut' as const }

  const from = originRef.current ? originToCenterOffset(originRef.current) : null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="live-events-modal"
          className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4"
          initial={false}
        >
          <motion.div
            className="absolute inset-0 bg-[rgba(40,25,20,0.45)] backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionTransition}
            onClick={handleClose}
            aria-hidden="true"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={
              reduceMotion || !from
                ? { opacity: 0, scale: 0.95 }
                : { opacity: 1, scale: from.scale, x: from.x, y: from.y }
            }
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={
              reduceMotion || !from
                ? { opacity: 0, scale: 0.95 }
                : { opacity: 1, scale: from.scale, x: from.x, y: from.y }
            }
            transition={motionTransition}
            className={cn(
              'relative z-10 flex w-full max-w-[640px] max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-3xl',
              'shadow-[0_22px_52px_rgba(46,34,30,0.28)]',
              'focus:outline-none',
            )}
            style={{ transformOrigin: 'center center' }}
          >
            {/* Same teal as the dashboard card - stays solid while expanding, then clears */}
            <motion.div
              className="pointer-events-none absolute inset-0 z-0 gradient-reward-medium"
              initial={{ opacity: 1 }}
              animate={{
                opacity: 0,
                transition: brightenTransition,
              }}
              exit={{
                opacity: 1,
                transition: reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.28, ease: 'easeIn' },
              }}
              aria-hidden="true"
            />
            {/* Soft orbs matching the dashboard card, fade with the teal */}
            <motion.div
              className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
              initial={{ opacity: 1 }}
              animate={{
                opacity: 0,
                transition: brightenTransition,
              }}
              exit={{
                opacity: 1,
                transition: reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.28, ease: 'easeIn' },
              }}
              aria-hidden="true"
            >
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
              <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
            </motion.div>

            {/* Neutral glass surface */}
            <motion.div
              className="pointer-events-none absolute inset-0 z-[1] border border-white/55 bg-white/80 backdrop-blur-xl"
              style={{ borderRadius: 'inherit' }}
              initial={{ opacity: reduceMotion ? 1 : 0 }}
              animate={{
                opacity: 1,
                transition: brightenTransition,
              }}
              exit={{
                opacity: 0,
                transition: reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.22, ease: 'easeIn' },
              }}
              aria-hidden="true"
            />

            <motion.div
              className="relative z-10 flex min-h-0 flex-1 flex-col"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{
                opacity: 1,
                transition: contentTransition,
              }}
              exit={{
                opacity: 0,
                transition: reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.12, ease: 'easeIn' },
              }}
            >
              <div className="flex shrink-0 items-center justify-between px-5 pb-0 pt-3.5">
                <h2 id={titleId} className="text-lg font-black tracking-tight text-foreground">
                  בחרו הפעלה
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="סגירה"
                  className={cn(
                    'shrink-0 rounded-lg p-1 transition-colors',
                    theme.textSubtle,
                    theme.hoverSurface,
                    theme.hoverText,
                    theme.focusRing,
                  )}
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-5 sm:px-5 sm:pb-5">
                <div className="flex flex-wrap justify-center gap-3.5">
                  {available.map((item) => (
                    <div key={item.id} className={AVAILABLE_SLOT}>
                      <AvailableEventCard
                        item={item}
                        blurb={CARD_BLURB[item.id]}
                        onLaunch={() => launch(item.id)}
                      />
                    </div>
                  ))}
                  {upcoming.map((item) => (
                    <div key={item.id} className={UPCOMING_SLOT}>
                      <UpcomingEventCard item={item} blurb={CARD_BLURB[item.id]} />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
