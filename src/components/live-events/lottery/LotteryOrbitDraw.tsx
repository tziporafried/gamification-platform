import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { EligibleParticipant } from '../types'
import { shuffleInPlace } from './lotteryUtils'

interface LotteryOrbitDrawProps {
  participants: EligibleParticipant[]
  durationMs?: number
  onComplete: () => void
}

interface OrbitCard {
  id: string
  name: string
  angle: number
  radius: number
  size: number
  delay: number
}

const DRAW_MS = 5_200

function buildOrbit(participants: EligibleParticipant[]): OrbitCard[] {
  const pool = shuffleInPlace(
    [...participants].slice(0, Math.min(participants.length, 18)),
  )
  return pool.map((p, i) => ({
    id: p.id,
    name: p.name,
    angle: (i / pool.length) * Math.PI * 2,
    radius: 118 + (i % 3) * 28,
    size: 0.85 + (i % 4) * 0.12,
    delay: (i % 6) * 0.08,
  }))
}

/**
 * Elegant draw: glowing name cards orbit with depth - fair-choice feel, not casino.
 */
export function LotteryOrbitDraw({
  participants,
  durationMs = DRAW_MS,
  onComplete,
}: LotteryOrbitDrawProps) {
  const reduceMotion = useReducedMotion()
  const cards = useMemo(() => buildOrbit(participants), [participants])
  const [spotlight, setSpotlight] = useState(0)
  const [phase, setPhase] = useState<'spin' | 'focus'>('spin')

  useEffect(() => {
    const focusAt = Math.max(2_400, durationMs - 1_400)
    const focusTimer = window.setTimeout(() => setPhase('focus'), focusAt)
    const doneTimer = window.setTimeout(onComplete, durationMs)
    return () => {
      window.clearTimeout(focusTimer)
      window.clearTimeout(doneTimer)
    }
  }, [durationMs, onComplete])

  useEffect(() => {
    if (phase !== 'spin' || cards.length === 0) return
    const id = window.setInterval(() => {
      setSpotlight((s) => (s + 1) % cards.length)
    }, 220)
    return () => window.clearInterval(id)
  }, [phase, cards.length])

  const active = cards[spotlight]

  return (
    <div className="relative flex h-full min-h-[20rem] w-full flex-col items-center justify-center overflow-hidden">
      <motion.div
        className="pointer-events-none absolute h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(252,96,36,0.28),transparent_70%)]"
        animate={
          reduceMotion
            ? undefined
            : { scale: [0.9, 1.12, 0.9], opacity: [0.45, 0.75, 0.45] }
        }
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      />

      <div className="relative h-[22rem] w-full max-w-xl sm:h-[26rem]">
        {cards.map((card, i) => {
          const highlighted = phase === 'spin' && i === spotlight
          const x = Math.cos(card.angle) * card.radius
          const y = Math.sin(card.angle) * card.radius * 0.72

          return (
            <motion.div
              key={card.id}
              className={cn(
                'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                'rounded-2xl border px-3 py-2 font-bold shadow-md backdrop-blur-md',
                highlighted
                  ? 'z-20 border-[#FC6024]/55 bg-white text-foreground shadow-[0_12px_28px_rgba(252,96,36,0.28)]'
                  : 'z-10 border-white/50 bg-white/70 text-foreground/80',
              )}
              style={{ fontSize: `${card.size}rem` }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={
                phase === 'focus'
                  ? {
                      opacity: highlighted ? 0 : 0.15,
                      scale: 0.85,
                      x,
                      y,
                    }
                  : reduceMotion
                    ? { opacity: highlighted ? 1 : 0.55, x, y, scale: highlighted ? 1.08 : 1 }
                    : {
                        opacity: highlighted ? 1 : 0.5,
                        scale: highlighted ? 1.1 : 1,
                        x: [
                          x,
                          Math.cos(card.angle + 0.9) * card.radius,
                          Math.cos(card.angle + 1.8) * card.radius,
                          x,
                        ],
                        y: [
                          y,
                          Math.sin(card.angle + 0.9) * card.radius * 0.72,
                          Math.sin(card.angle + 1.8) * card.radius * 0.72,
                          y,
                        ],
                      }
              }
              transition={
                phase === 'focus'
                  ? { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
                  : {
                      duration: 4.8 + card.delay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: card.delay,
                    }
              }
            >
              {card.name}
            </motion.div>
          )
        })}

        <motion.div
          className={cn(
            'absolute left-1/2 top-1/2 z-30 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2',
            'items-center justify-center rounded-full',
            'border border-white/40 bg-gradient-to-br from-[#FC6024] to-[#D83000]',
            'shadow-[0_16px_40px_rgba(252,96,36,0.35)]',
          )}
          animate={
            reduceMotion
              ? undefined
              : {
                  scale: [1, 1.06, 1],
                  boxShadow: [
                    '0 16px 40px rgba(252,96,36,0.3)',
                    '0 20px 52px rgba(252,96,36,0.45)',
                    '0 16px 40px rgba(252,96,36,0.3)',
                  ],
                }
          }
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="text-3xl" aria-hidden="true">
            🎁
          </span>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={phase}
          className="mt-2 text-lg font-bold text-foreground/80 sm:text-xl"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {phase === 'spin'
            ? active
              ? `… ${active.name}`
              : 'בוחרים זוכה…'
            : 'רגע של אמת…'}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
