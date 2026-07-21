import { motion, type Variants } from 'framer-motion'
import { Dices, Flag } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { RAFFLE_SPRINGS } from './raffleTiming'

interface RaffleOrganizerControlsProps {
  onDrawAgain?: () => void
  onFinish?: () => void
}

/** Top-left organizer controls — clear of the ceremony stage. */
export function RaffleOrganizerControls({ onDrawAgain, onFinish }: RaffleOrganizerControlsProps) {
  return (
    <motion.div
      className="pointer-events-auto absolute left-3 top-3 z-[70] flex flex-col items-start gap-2 sm:left-5 sm:top-5"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...RAFFLE_SPRINGS.reveal, delay: 0.2 }}
    >
      {onDrawAgain && (
        <Button
          type="button"
          size="md"
          variant="primary"
          onClick={onDrawAgain}
          className={cn(
            'w-44 justify-center gap-2 rounded-xl px-4 text-sm font-black shadow-[0_10px_28px_rgba(46,34,30,0.16)]',
            'active:scale-[0.97]',
          )}
        >
          <Dices size={18} strokeWidth={2.25} aria-hidden="true" />
          הגרל שוב
        </Button>
      )}
      {onFinish && (
        <Button
          type="button"
          size="md"
          variant="outline"
          onClick={onFinish}
          className={cn(
            'w-44 justify-center gap-2 rounded-xl border-2 border-white/80 bg-white/95 px-4 text-sm font-black text-foreground',
            'shadow-[0_10px_28px_rgba(46,34,30,0.16)] backdrop-blur-md hover:bg-white active:scale-[0.97]',
          )}
        >
          <Flag size={18} strokeWidth={2.25} className="text-secondary-text" aria-hidden="true" />
          סיום הגרלה
        </Button>
      )}
    </motion.div>
  )
}

interface RaffleWinnerRevealProps {
  winnerName: string
  prizeName: string
  prizeIcon: string
}

/** Jitter-style blurred slide-up for the whole winner line, then a perpetual gentle pulse — animated as one unit. */
const winnerLineVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.85, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.55, delay: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  },
  idle: {
    opacity: 1,
    y: 0,
    scale: [1, 1.05, 1],
    filter: 'blur(0px)',
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
}

/**
 * Floating congrats banner — sits above the hero ticket (highest z).
 * "מזל טוב!!" lands with a tada-style overshoot (animate.style), the
 * winner line follows with a Jitter-esque blurred slide-up.
 */
export function RaffleWinnerReveal({ winnerName, prizeName }: RaffleWinnerRevealProps) {
  const [settled, setSettled] = useState(false)
  const [lineSettled, setLineSettled] = useState(false)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-[60] flex justify-center px-4 sm:top-6">
      <div className="max-w-2xl text-center">
        <motion.p
          className="text-5xl font-black text-warning [text-shadow:0_6px_24px_color-mix(in_srgb,var(--color-warning)_45%,transparent)] sm:text-7xl md:text-8xl"
          initial={{ opacity: 0, scale: 0.2, rotate: -12 }}
          animate={
            settled
              ? {
                  opacity: 1,
                  scale: [1, 1.1, 1],
                  rotate: [0, -3, 3, 0],
                }
              : {
                  opacity: 1,
                  scale: [0.2, 1.24, 0.92, 1.1, 0.97, 1.03, 1],
                  rotate: [-12, 8, -6, 4, -2, 0],
                }
          }
          transition={
            settled
              ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 1, ease: [0.215, 0.61, 0.355, 1] }
          }
          onAnimationComplete={() => setSettled(true)}
        >
          מזל טוב!!
        </motion.p>
        <motion.p
          className="mt-3 flex flex-wrap items-baseline justify-center gap-x-2 font-black text-foreground"
          variants={winnerLineVariants}
          initial="hidden"
          animate={lineSettled ? 'idle' : 'visible'}
          onAnimationComplete={(definition) => {
            if (definition === 'visible') setLineSettled(true)
          }}
        >
          <span className="text-4xl sm:text-5xl md:text-6xl">{winnerName}</span>
          <span className="text-2xl sm:text-3xl md:text-4xl">זכה ב{prizeName}!</span>
        </motion.p>
      </div>
    </div>
  )
}

interface RaffleTrialUpgradeBannerProps {
  onUpgradeClick: () => void
}

/**
 * Trial-plan nudge — pops up ~1s after the (masked) reveal settles, same card
 * language as the control-center "מצב התנסות" activation banner.
 */
export function RaffleTrialUpgradeBanner({ onUpgradeClick }: RaffleTrialUpgradeBannerProps) {
  return (
    <motion.div
      className="pointer-events-auto absolute inset-x-0 bottom-6 z-[80] flex justify-center px-4 sm:bottom-8"
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...RAFFLE_SPRINGS.reveal, delay: 1 }}
    >
      <div
        className={cn(
          'w-full max-w-xl overflow-hidden rounded-xl border border-primary/20 text-right',
          'bg-[color-mix(in_srgb,var(--color-primary)_7%,var(--color-surface-elevated))]',
          'shadow-[0_18px_44px_rgba(46,34,30,0.22)] backdrop-blur-md',
        )}
      >
        <div className="flex flex-col gap-4 border-s-4 border-primary p-4 sm:flex-row sm:items-center sm:gap-5 sm:ps-5">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-bold text-primary-text">✨ מצב התנסות</p>
            <p className="text-base font-bold leading-snug text-foreground">מי זכה? 🎉</p>
            <p className="text-sm leading-relaxed text-foreground/85">
              הפעילו את המשחק כדי לחשוף את שם הזוכה האמיתי ולהעניק לו את הפרס.
            </p>
          </div>
          <Button
            type="button"
            variant="gradient"
            size="md"
            className="w-full shrink-0 font-semibold tracking-wide sm:w-auto sm:min-w-[11rem]"
            onClick={onUpgradeClick}
          >
            הפעלת המשחק
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

export { RaffleWinnerReveal as WinnerReveal }
