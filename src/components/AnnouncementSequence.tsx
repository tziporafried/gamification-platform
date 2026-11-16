import { useEffect, useState, type ComponentType } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BrandLogo } from '@/components/icons/BrandLogo'
import { FlashAnnouncementModal, flashAnnouncementSeen, markFlashAnnouncementSeen } from '@/components/FlashAnnouncementModal'
import { LotteryAnnouncementModal, lotteryAnnouncementSeen, markLotteryAnnouncementSeen } from '@/components/LotteryAnnouncementModal'
import { SecretAnnouncementModal, secretAnnouncementSeen, markSecretAnnouncementSeen } from '@/components/SecretAnnouncementModal'
import { TriviaAnnouncementModal, triviaAnnouncementSeen, markTriviaAnnouncementSeen } from '@/components/TriviaAnnouncementModal'

/**
 * The "חדש ב-Gamify" announcements: one queue of dialogs and one bubble.
 *
 *   On load      every announcement not yet closed opens, newest first, each X
 *                handing over to the next. Once all of them have been closed,
 *                nothing opens by itself any more.
 *   X            marks only the announcement it was pressed on as seen.
 *   The bubble   sits in the corner whenever no dialog is open, and turns over
 *                to the next announcement's name every ten seconds.
 *   Reopening    a click on the bubble runs all of them again - the ones not
 *                yet closed first, then the rest - so nothing is out of reach.
 *
 * Each announcement keeps its own "seen" flag in localStorage, so somebody who
 * closed the lottery last summer still gets the newer ones on their own.
 */
type AnnouncementId = 'secret' | 'flash' | 'trivia' | 'lottery'

interface AnnouncementEntry {
  id: AnnouncementId
  /** What the bubble says while it is this announcement's turn. */
  icon: string
  label: string
  seen: () => boolean
  markSeen: () => void
  Dialog: ComponentType<{ open: boolean; onClose: () => void }>
}

/** Newest first. */
const ANNOUNCEMENTS: AnnouncementEntry[] = [
  { id: 'secret', icon: '🤫', label: 'משימה סודית', seen: secretAnnouncementSeen, markSeen: markSecretAnnouncementSeen, Dialog: SecretAnnouncementModal },
  { id: 'flash', icon: '⚡', label: 'אתגר בזק', seen: flashAnnouncementSeen, markSeen: markFlashAnnouncementSeen, Dialog: FlashAnnouncementModal },
  { id: 'trivia', icon: '❓', label: 'שאלות טריוויה', seen: triviaAnnouncementSeen, markSeen: markTriviaAnnouncementSeen, Dialog: TriviaAnnouncementModal },
  { id: 'lottery', icon: '🎁', label: 'הגרלה', seen: lotteryAnnouncementSeen, markSeen: markLotteryAnnouncementSeen, Dialog: LotteryAnnouncementModal },
]

/** Landing, the seasonal homepages and the events list - never a live screen. */
const ALLOWED_ROUTES = new Set(['/', '/events'])

// A beat between two dialogs, so the next does not snap in as one leaves.
const GAP_MS = 700
const BUBBLE_ROTATE_MS = 10_000

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

/** Not yet closed first, then the rest - each group newest first. */
function reopenOrder(): AnnouncementId[] {
  const unseen = ANNOUNCEMENTS.filter((a) => !a.seen()).map((a) => a.id)
  const seen = ANNOUNCEMENTS.filter((a) => a.seen()).map((a) => a.id)
  return [...unseen, ...seen]
}

export function AnnouncementSequence() {
  const { pathname } = useLocation()
  const reducedMotion = useReducedMotion()
  // null until mount reads localStorage, so the first paint never flashes a
  // dialog that is about to turn out to be seen.
  const [queue, setQueue] = useState<AnnouncementId[] | null>(null)
  // The dialog on screen, or null between two of them and while collapsed.
  const [current, setCurrent] = useState<AnnouncementId | null>(null)
  const [bubbleIdx, setBubbleIdx] = useState(0)

  useEffect(() => {
    const unseen = ANNOUNCEMENTS.filter((a) => !a.seen()).map((a) => a.id)
    setQueue(unseen)
    setCurrent(unseen[0] ?? null)
  }, [])

  const collapsed = queue !== null && queue.length === 0

  // The bubble only turns over while it is the thing on screen.
  useEffect(() => {
    if (!collapsed) return
    const timer = window.setInterval(
      () => setBubbleIdx((i) => (i + 1) % ANNOUNCEMENTS.length),
      BUBBLE_ROTATE_MS,
    )
    return () => window.clearInterval(timer)
  }, [collapsed])

  // The next dialog in the queue, a beat after the last one left.
  useEffect(() => {
    if (current !== null || !queue || queue.length === 0) return
    const timer = window.setTimeout(() => setCurrent(queue[0]), GAP_MS)
    return () => window.clearTimeout(timer)
  }, [current, queue])

  function close(id: AnnouncementId) {
    ANNOUNCEMENTS.find((a) => a.id === id)?.markSeen()
    setCurrent(null)
    setQueue((q) => (q ?? []).filter((x) => x !== id))
  }

  function reopen() {
    const order = reopenOrder()
    setQueue(order)
    setCurrent(order[0])
  }

  // /home/<id> are the seasonal homepages - same audience as `/`.
  if (!ALLOWED_ROUTES.has(pathname) && !pathname.startsWith('/home/')) return null
  if (queue === null) return null

  const shown = ANNOUNCEMENTS[bubbleIdx]

  return (
    <>
      {ANNOUNCEMENTS.map(({ id, Dialog }) => (
        // Mounted only while it is this one's turn: each dialog's own
        // illustration loop then runs only while it can be seen.
        current === id && <Dialog key={id} open onClose={() => close(id)} />
      ))}

      {collapsed && (
        <motion.div
          // Below the dialog's z-[200]; the contact button sits bottom-left.
          className="fixed bottom-5 right-4 z-[190] sm:bottom-6 sm:right-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        >
          <motion.button
            type="button"
            layout={!reducedMotion}
            onClick={reopen}
            aria-label={`חדש ב-Gamify - ${shown.label}. פתיחת כל החידושים`}
            className="flex items-center gap-2 overflow-hidden rounded-full px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_6px_20px_-4px_rgba(216,48,0,0.55)] transition-shadow duration-200 hover:shadow-[0_8px_24px_-4px_rgba(216,48,0,0.65)] sm:gap-2.5 sm:px-4 sm:py-3"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' }}
            transition={{ layout: { duration: 0.35, ease: EASE_OUT } }}
          >
            <motion.span layout="position" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(46,34,30,0.22)]">
              <BrandLogo alt="" className="h-[1.05rem] w-[1.05rem] object-contain" />
            </motion.span>
            <motion.span layout="position" className="whitespace-nowrap">חדש ב-Gamify</motion.span>
            <motion.span layout="position" aria-hidden className="h-4 w-px shrink-0 bg-white/40" />
            {/* The feature's name turns over like a split-flap - the old one
                lifts away as the new one rises in (animate.style's
                fadeOutUp / fadeInUp, Jitter-style offset). */}
            <span className="relative flex h-5 items-center overflow-hidden" aria-hidden>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={shown.id}
                  className="flex items-center gap-1 whitespace-nowrap"
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                >
                  <span className="text-[15px] leading-none">{shown.icon}</span>
                  {shown.label}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.button>
        </motion.div>
      )}
    </>
  )
}
