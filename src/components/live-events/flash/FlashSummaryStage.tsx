import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ConfettiOverlay } from '../lottery/ConfettiOverlay'
import type { FlashChallenge } from './flashChallengeStore'
import { playFlashFanfare, playFlashTimesUp } from './flashSfx'

/** How long "⏱️ הזמן נגמר!" holds before the summary. */
export const FLASH_TIMES_UP_MS = 2_200

/**
 * The beat between the clock and the summary - animate.style `rubberBand`
 * (stretch wide, squash, settle) so the end lands as an event, not a cut.
 */
export function FlashTimesUp({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion()
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    playFlashTimesUp()
    const t = window.setTimeout(() => onDoneRef.current(), FLASH_TIMES_UP_MS)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="flex h-full w-full items-center justify-center">
      <motion.p
        className="font-black text-foreground"
        style={{ fontSize: 'clamp(3rem, 10vw, 8rem)', textShadow: '0 0 40px rgba(229,72,77,0.3)' }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={
          reduceMotion
            ? { opacity: 1, scale: 1 }
            : { opacity: 1, scaleX: [0.6, 1.25, 0.75, 1.15, 0.95, 1.05, 1], scaleY: [0.6, 0.75, 1.25, 0.85, 1.05, 0.95, 1] }
        }
        transition={{ duration: 0.9, ease: 'easeOut' }}
      >
        ⏱️ הזמן נגמר!
      </motion.p>
    </div>
  )
}

interface FlashSummaryStageProps {
  challenge: FlashChallenge
  /** Back to plain scanning - the X, a click outside, or Escape. */
  onClose: () => void
  /** Play the fanfare - true when arriving from the clock, not from a reload. */
  celebrate?: boolean
}

const MEDALS = ['🥇', '🥈', '🥉']

/**
 * The popup after the clock: the challenge is over, and who made it - each
 * with the points *this challenge* gave them, never their running total.
 * Nothing to decide here, so nothing but an X: the next challenge is launched
 * from the live-events popup like the first one.
 */
export function FlashSummaryStage({ challenge, onClose, celebrate = false }: FlashSummaryStageProps) {
  const reduceMotion = useReducedMotion()
  const { completions } = challenge
  const hasCompleters = completions.length > 0
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!celebrate || !hasCompleters) return
    const t = window.setTimeout(playFlashFanfare, 250)
    return () => window.clearTimeout(t)
  }, [celebrate, hasCompleters])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <motion.div
      className="relative flex max-h-full w-[min(480px,100%)] rounded-[32px] p-1"
      style={{
        background: 'linear-gradient(135deg,#FF9366,#F2B33C 40%,#FFCB9A 70%,#8FCFA0)',
        boxShadow: '0 28px 70px rgba(171,53,0,0.34)',
      }}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      dir="rtl"
    >
      <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-[28px] bg-[linear-gradient(160deg,#FFFFFF,#FFF6F0)] p-6">
        {/* Behind the list, not over it - the names are what is being read. */}
        {hasCompleters && (
          <div className="pointer-events-none absolute inset-0 z-0">
            <ConfettiOverlay active count={28} />
          </div>
        )}

        <div className="relative z-10 flex shrink-0 items-start gap-3">
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-black text-[#B4552A]">⏱️ האתגר הסתיים</p>
            <h2 className="mt-1 text-2xl font-black leading-tight text-[#2E221E]">{challenge.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="absolute left-0 top-0 flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-[#FFE1CC] bg-[#FFF1E7] text-[19px] text-[#B4552A]"
          >
            ×
          </button>
        </div>

        {hasCompleters ? (
          <>
            <p className="relative z-10 shrink-0 text-center text-sm font-extrabold text-[#7D706A]">
              {completions.length === 1 ? 'משתתף אחד השלים את האתגר' : `${completions.length} משתתפים השלימו את האתגר`}
            </p>
            <ol className="relative z-10 flex min-h-0 flex-col gap-2 overflow-y-auto">
              {completions.map((c, i) => (
                <motion.li
                  key={c.participantId}
                  className={cn(
                    'flex shrink-0 items-center gap-3 rounded-2xl bg-white px-4 py-2.5 font-black shadow-[0_4px_12px_rgba(120,50,10,0.1)]',
                    i < 3 && 'ring-2 ring-[#FFD68A]',
                  )}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + Math.min(i, 8) * 0.07, type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <span className="w-8 shrink-0 text-center text-xl tabular-nums text-[#B5623C]">
                    {i < 3 ? MEDALS[i] : `${i + 1}.`}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-start text-lg text-[#2E221E]">{c.name}</span>
                  <span className="shrink-0 rounded-full bg-[#FFF4E0] px-3 py-1 text-base tabular-nums text-[#C8941A]">
                    +{c.points} נק׳
                  </span>
                </motion.li>
              ))}
            </ol>
          </>
        ) : (
          <p className="relative z-10 py-8 text-center text-xl font-black text-[#7D706A]">הפעם אף אחד לא הספיק 🙈</p>
        )}
      </div>
    </motion.div>
  )
}
