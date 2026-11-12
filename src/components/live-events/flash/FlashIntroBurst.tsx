import { useEffect, useRef } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { playFlashTada, playFlashWordPop, playFlashZap } from './flashSfx'

/** How long the takeover holds before the live stage takes over. */
export const FLASH_INTRO_MS = 2_800

interface FlashIntroBurstProps {
  title: string
  onDone: () => void
}

/**
 * The 2-3 second takeover that announces the challenge to the room.
 *
 * Choreography, after the project's two animation references:
 *   - "⚡ אתגר בזק!" - animate.style `bounceIn` for the entrance (scale from
 *     0.3, overshoot to 1.1, settle) chained into a `tada` wiggle (shrink, then
 *     alternating ±3° tilts at 1.1 scale) so the burst lands with a jolt.
 *   - The challenge title - Jitter-style staggered slide-up, word by word, with
 *     an elastic spring. Blur-free on purpose: transforms and opacity only, so
 *     it stays smooth on a projector laptop.
 */
export function FlashIntroBurst({ title, onDone }: FlashIntroBurstProps) {
  const reduceMotion = useReducedMotion()
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const words = title.split(/\s+/).filter(Boolean)
  const wordCount = words.length

  useEffect(() => {
    const t = window.setTimeout(() => onDoneRef.current(), reduceMotion ? 1_200 : FLASH_INTRO_MS)
    return () => window.clearTimeout(t)
  }, [reduceMotion])

  // One sound per beat, on the same clock as the animation below: the zap with
  // the bounceIn, the stab as the tada wiggle starts (0.45 of 1.2s), and a pop
  // as each word of the title slides in.
  useEffect(() => {
    playFlashZap()
    const timers = [window.setTimeout(playFlashTada, 540)]
    for (let i = 0; i < wordCount; i++) {
      timers.push(window.setTimeout(() => playFlashWordPop(i), 1_050 + i * 90))
    }
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [wordCount])

  const word: Variants = {
    hidden: { opacity: 0, y: 48 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 1.05 + i * 0.09, type: 'spring', stiffness: 260, damping: 15 },
    }),
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 overflow-hidden px-6 text-center">
      {/* A single flash of light behind the burst - opacity only. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,214,138,0.75),transparent_60%)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.35] }}
        transition={{ duration: 1.1, times: [0, 0.25, 1] }}
      />

      <motion.p
        className="relative font-black text-foreground"
        style={{ fontSize: 'clamp(3.5rem, 11vw, 9rem)', lineHeight: 1, textShadow: '0 0 48px rgba(255,147,102,0.45)' }}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.3 }}
        animate={
          reduceMotion
            ? { opacity: 1 }
            : {
                opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1],
                // bounceIn (0 → 0.45s) then tada (0.45s → 1.2s)
                scale: [0.3, 1.1, 0.95, 1, 0.92, 1.1, 1.1, 1.1, 1],
                rotate: [0, 0, 0, 0, -3, 3, -3, 3, 0],
              }
        }
        transition={{ duration: 1.2, times: [0, 0.18, 0.28, 0.37, 0.45, 0.58, 0.7, 0.82, 1], ease: 'easeOut' }}
      >
        ⚡ אתגר בזק!
      </motion.p>

      <h2
        className="relative flex max-w-5xl flex-wrap justify-center gap-x-[0.3em] font-black text-primary-text"
        style={{ fontSize: 'clamp(2rem, 5.5vw, 4.5rem)', lineHeight: 1.15 }}
      >
        {words.map((w, i) => (
          <motion.span
            key={`${w}-${i}`}
            custom={i}
            variants={word}
            initial={reduceMotion ? 'show' : 'hidden'}
            animate="show"
            className="inline-block"
          >
            {w}
          </motion.span>
        ))}
      </h2>
    </div>
  )
}
