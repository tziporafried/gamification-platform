import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { LOTTERY_PRE_DRAW_TIMING } from './lotteryTiming'

export interface RulesCardData {
  icon: string
  label: string
  value: string
}

interface LotteryRulesSequenceProps {
  cards: RulesCardData[]
  onCardReveal?: () => void
  onComplete: () => void
}

/** Timed to fit one intro play + 1s before the draw. */
const CARD_HOLD_MS = LOTTERY_PRE_DRAW_TIMING.card
const ENTER = { type: 'spring' as const, stiffness: 120, damping: 16 }

/**
 * One-by-one rule cards for the live stage - bold, readable, unhurried.
 */
export function LotteryRulesSequence({
  cards,
  onCardReveal,
  onComplete,
}: LotteryRulesSequenceProps) {
  const [index, setIndex] = useState(0)
  const onCardRevealRef = useRef(onCardReveal)
  const onCompleteRef = useRef(onComplete)
  onCardRevealRef.current = onCardReveal
  onCompleteRef.current = onComplete

  useEffect(() => {
    onCardRevealRef.current?.()

    const t = window.setTimeout(() => {
      if (index >= cards.length - 1) {
        onCompleteRef.current()
        return
      }
      setIndex((i) => i + 1)
    }, CARD_HOLD_MS)

    return () => window.clearTimeout(t)
  }, [index, cards.length])

  const current = cards[index]!

  return (
    <div className="relative flex w-full max-w-3xl flex-col items-center justify-center px-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={`card-${index}`}
          className={cn(
            'relative flex w-full max-w-lg flex-col items-center gap-5 rounded-[2rem] px-10 py-12 text-center',
            'border border-white/60 bg-white/75 shadow-[0_24px_56px_rgba(46,34,30,0.14)]',
            'backdrop-blur-xl',
          )}
          initial={{ opacity: 0, y: 48, filter: 'blur(12px)', scale: 0.9 }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
          exit={{ opacity: 0, y: -28, filter: 'blur(10px)', scale: 0.94 }}
          transition={ENTER}
        >
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_50%_30%,rgba(69,207,107,0.18),transparent_65%)]"
            animate={{ opacity: [0.45, 0.85, 0.45] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          />

          <motion.span
            className="relative text-6xl sm:text-7xl"
            aria-hidden="true"
            animate={{ y: [0, -8, 0], scale: [1, 1.06, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            {current.icon}
          </motion.span>

          <p className="relative text-base font-bold tracking-wide text-muted sm:text-lg">
            {current.label}
          </p>

          <motion.p
            className="relative text-4xl font-black leading-tight text-foreground sm:text-5xl md:text-6xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45 }}
          >
            {current.value}
          </motion.p>

          <p className="relative text-sm font-bold tabular-nums text-muted/80">
            {index + 1} / {cards.length}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

interface LotteryRulesSummaryProps {
  cards: RulesCardData[]
  onComplete: () => void
}

const SUMMARY_HOLD_MS = LOTTERY_PRE_DRAW_TIMING.summary

/**
 * Final rules recap before the draw - ends on "מתחילים".
 */
export function LotteryRulesSummary({ cards, onComplete }: LotteryRulesSummaryProps) {
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const t = window.setTimeout(() => onCompleteRef.current(), SUMMARY_HOLD_MS)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="relative flex w-full max-w-3xl flex-col items-center justify-center px-4">
      <motion.div
        className={cn(
          'flex w-full max-w-lg flex-col gap-3 rounded-[1.75rem] px-6 py-7',
          'border border-white/60 bg-white/80 shadow-[0_22px_52px_rgba(46,34,30,0.14)]',
          'backdrop-blur-xl',
        )}
        initial={{ opacity: 0, scale: 1.06, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 120, damping: 16 }}
      >
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            className="flex items-center gap-3 rounded-xl bg-white/70 px-4 py-3.5 text-right"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + i * 0.12, type: 'spring', stiffness: 160, damping: 18 }}
          >
            <span className="text-2xl sm:text-3xl" aria-hidden="true">
              {card.icon}
            </span>
            <span className="min-w-0 flex-1 truncate text-xl font-black text-foreground sm:text-2xl">
              {card.value}
            </span>
          </motion.div>
        ))}

        <motion.p
          className="mt-2 text-center text-3xl font-black text-secondary-text sm:text-4xl"
          style={{ textShadow: '0 0 28px rgba(69,207,107,0.35)' }}
          initial={{ opacity: 0, y: 14, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: [0.92, 1.04, 1] }}
          transition={{ delay: 0.45, type: 'spring', stiffness: 180, damping: 14 }}
        >
          מתחילים
        </motion.p>
      </motion.div>
    </div>
  )
}
