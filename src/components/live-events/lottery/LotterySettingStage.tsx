import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface LotterySettingStageProps {
  eyebrow: string
  children: ReactNode
  step: number
  totalSteps: number
}

/** Ceremonial full-stage card for audience-facing lottery settings. */
export function LotterySettingStage({
  eyebrow,
  children,
  step,
  totalSteps,
}: LotterySettingStageProps) {
  return (
    <motion.div
      className="relative w-full max-w-3xl px-4"
      initial={{ opacity: 0, scale: 0.92, y: 28 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.04, y: -16 }}
      transition={{ type: 'spring', stiffness: 160, damping: 18 }}
    >
      <div className="overflow-hidden rounded-[2rem] border-2 border-warning/40 bg-[linear-gradient(155deg,#FFFDF7_0%,#FFF1D2_48%,#FFE7D3_100%)] shadow-[0_24px_60px_rgba(46,34,30,0.16)]">
        <div
          aria-hidden
          className="h-1.5 bg-gradient-to-l from-[#FF9366] via-[#FFD68A] to-[#5FB3AA]"
        />

        <div className="relative px-6 py-10 text-center sm:px-12 sm:py-14">
          <motion.div
            className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-warning/20 blur-3xl"
            animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.08, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="pointer-events-none absolute -bottom-12 -right-8 h-44 w-44 rounded-full bg-primary/15 blur-3xl"
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          />

          <p className="relative text-sm font-bold tracking-wide text-primary-text sm:text-base">
            {eyebrow}
          </p>

          <div className="relative mt-5 sm:mt-6">{children}</div>

          <div className="relative mt-10 flex items-center justify-center gap-2">
            {Array.from({ length: totalSteps }, (_, i) => (
              <span
                key={i}
                className={
                  i + 1 === step
                    ? 'h-2.5 w-8 rounded-full bg-primary'
                    : i + 1 < step
                      ? 'h-2.5 w-2.5 rounded-full bg-primary/55'
                      : 'h-2.5 w-2.5 rounded-full bg-border'
                }
                aria-hidden
              />
            ))}
          </div>
          <p className="relative mt-3 text-xs font-semibold text-muted">
            רגע {step} מתוך {totalSteps}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
