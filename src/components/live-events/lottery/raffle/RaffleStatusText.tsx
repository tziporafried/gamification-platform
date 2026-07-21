import { AnimatePresence, motion, type TargetAndTransition, type Transition } from 'framer-motion'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { RafflePhase } from './raffleTiming'

/**
 * Animate.css-inspired entrances — all finite so AnimatePresence can swap captions.
 */
const PRESETS: Record<
  string,
  { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition }
> = {
  bounceIn: {
    initial: { opacity: 0, scale: 0.3, y: -24 },
    animate: { opacity: 1, scale: [0.3, 1.12, 0.92, 1.05, 1], y: 0 },
    transition: { duration: 0.75, ease: [0.215, 0.61, 0.355, 1] },
  },
  tada: {
    initial: { opacity: 0, scale: 0.85 },
    animate: {
      opacity: 1,
      scale: [1, 0.9, 0.9, 1.12, 1.12, 1.12, 1.12, 1.12, 1.12, 1],
      rotate: [0, -3, -3, 3, -3, 3, -3, 3, -3, 0],
    },
    transition: { duration: 0.95, ease: 'easeInOut' },
  },
  rubberBand: {
    initial: { opacity: 0, scaleX: 0.55 },
    animate: {
      opacity: 1,
      scaleX: [1, 1.25, 0.75, 1.15, 0.95, 1.05, 1],
      scaleY: [1, 0.75, 1.25, 0.85, 1.05, 0.95, 1],
    },
    transition: { duration: 0.85 },
  },
  heartBeat: {
    initial: { opacity: 0, scale: 0.65 },
    animate: { opacity: 1, scale: [1, 1.2, 1, 1.16, 1] },
    transition: { duration: 1.05, ease: 'easeInOut' },
  },
  flipInX: {
    initial: { opacity: 0, rotateX: 90 },
    animate: { opacity: 1, rotateX: 0 },
    transition: { type: 'spring', stiffness: 160, damping: 14 },
  },
  zoomIn: {
    initial: { opacity: 0, scale: 0.2 },
    animate: { opacity: 1, scale: 1 },
    transition: { type: 'spring', stiffness: 200, damping: 14 },
  },
  swing: {
    initial: { opacity: 0, rotate: -12 },
    animate: { opacity: 1, rotate: [0, 12, -8, 6, -3, 0] },
    transition: { duration: 0.9, ease: 'easeInOut' },
  },
  /** Soft entrance + gentle breathe (finite — no infinite opacity lock). */
  pulse: {
    initial: { opacity: 0, scale: 0.88, y: -10 },
    animate: { opacity: 1, scale: [0.88, 1.06, 1], y: 0 },
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
}

const PHASE_PRESET: Partial<Record<RafflePhase, keyof typeof PRESETS>> = {
  ready: 'pulse',
  ticketRain: 'bounceIn',
  collecting: 'rubberBand',
  closeBox: 'tada',
  shake: 'swing',
  stop: 'heartBeat',
  winner: 'zoomIn',
}

interface RaffleStatusTextProps {
  phase: RafflePhase
  text: string
  className?: string
}

/**
 * Large stage captions with Animate.css-style entrances (Framer Motion).
 */
export function RaffleStatusText({ phase, text, className }: RaffleStatusTextProps) {
  if (!text) return null
  if (typeof document === 'undefined') return null
  const presetKey = PHASE_PRESET[phase] ?? 'bounceIn'
  const preset = PRESETS[presetKey]!

  // Portaled to body (like TicketFlight) so its z-index is compared directly
  // against the ticket-flight layer instead of being capped by a local
  // stacking context — otherwise no z-index here could ever beat it.
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-5 z-[90] flex justify-center px-4 sm:top-7"
      aria-hidden="true"
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={phase}
          className={cn(
            'max-w-3xl text-center font-black tracking-tight text-primary',
            'text-2xl sm:text-3xl md:text-4xl lg:text-5xl',
            'drop-shadow-[0_4px_18px_rgba(216,48,0,0.35)]',
            className,
          )}
          style={{ perspective: 800 }}
          initial={preset.initial}
          animate={preset.animate}
          exit={{ opacity: 0, scale: 0.88, y: -16, transition: { duration: 0.22 } }}
          transition={preset.transition}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>,
    document.body,
  )
}
