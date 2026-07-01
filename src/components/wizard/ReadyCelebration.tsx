import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const CONFETTI_COLORS = [
  'var(--color-success)',
  'var(--color-primary)',
  'var(--color-warning)',
  'var(--color-accent)',
  'var(--color-secondary)',
]

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    function onChange(e: MediaQueryListEvent) {
      setReduced(e.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

export function useStepEntryCelebration(isActive: boolean, celebrateEnabled: boolean) {
  const reducedMotion = usePrefersReducedMotion()
  const wasActiveRef = useRef(false)
  const [animationKey, setAnimationKey] = useState(0)
  const [celebrate, setCelebrate] = useState(false)

  useLayoutEffect(() => {
    if (!isActive) {
      wasActiveRef.current = false
      setCelebrate(false)
      return
    }

    if (wasActiveRef.current) return
    wasActiveRef.current = true
    setAnimationKey((k) => k + 1)
  }, [isActive])

  useLayoutEffect(() => {
    if (!isActive || !celebrateEnabled || reducedMotion) return

    setCelebrate(true)
    const timer = window.setTimeout(() => setCelebrate(false), 2800)
    return () => window.clearTimeout(timer)
  }, [isActive, celebrateEnabled, reducedMotion, animationKey])

  return { celebrate, animationKey }
}

interface ConfettiBurstProps {
  active: boolean
  burstKey: number
}

function ConfettiBurst({ active, burstKey }: ConfettiBurstProps) {
  const reducedMotion = usePrefersReducedMotion()
  const particles = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 420,
        y: -120 - Math.random() * 280,
        rotation: Math.random() * 720 - 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 5 + Math.random() * 7,
        isCircle: Math.random() > 0.45,
        delay: Math.random() * 0.15,
      })),
    [burstKey],
  )

  if (reducedMotion) return null

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute left-1/2 top-[38%]"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: p.isCircle ? '50%' : '2px',
              }}
              initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0 }}
              animate={{ x: p.x, y: p.y, rotate: p.rotation, opacity: 0, scale: 1 }}
              transition={{ duration: 1.4, ease: 'easeOut', delay: p.delay }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface ReadyCelebrationBannerProps {
  title: string
  description: string
  celebrate: boolean
  replayKey: number
}

export function ReadyCelebrationBanner({ title, description, celebrate, replayKey }: ReadyCelebrationBannerProps) {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated px-5 py-5 shadow-card"
      initial={reducedMotion ? false : { opacity: 0, scale: 0.88, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.1 }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--color-success)_18%,transparent)_0%,transparent_65%)]"
      />

      {!reducedMotion && celebrate && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-success/20 to-transparent"
          initial={{ x: '150%' }}
          animate={{ x: '-150%' }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
        />
      )}

      {!reducedMotion && celebrate && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-success/60"
          initial={{ opacity: 0.8, scale: 1 }}
          animate={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      )}

      <div className="relative flex flex-col items-center gap-3 text-center">
        <FestiveSuccessIcon celebrate={celebrate} replayKey={replayKey} />

        <div className="space-y-1">
          <motion.p
            className="text-base font-semibold text-success"
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.35 }}
          >
            {title}
          </motion.p>
          <motion.p
            className="text-sm text-muted max-w-sm mx-auto"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            {description}
          </motion.p>
        </div>
      </div>
    </motion.div>
  )
}

const ICON_BURST_COLORS = [
  'var(--color-success)',
  'var(--color-secondary)',
  'var(--color-warning)',
  'var(--color-primary)',
]

const ICON_ORBIT_FLASHES = [
  { color: 'var(--color-warning)', radius: 34, size: 4 },
  { color: 'var(--color-success)', radius: 34, size: 3 },
  { color: 'var(--color-secondary)', radius: 34, size: 3.5 },
  { color: 'var(--color-primary)', radius: 34, size: 3 },
  { color: 'var(--color-warning)', radius: 26, size: 2.5 },
  { color: 'var(--color-success)', radius: 26, size: 2.5 },
] as const

function FestiveSuccessIcon({ celebrate, replayKey }: { celebrate: boolean; replayKey: number }) {
  const reducedMotion = usePrefersReducedMotion()
  const burstParticles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        angle: (i / 10) * Math.PI * 2 + Math.random() * 0.4,
        distance: 28 + Math.random() * 18,
        size: 3 + Math.random() * 3,
        color: ICON_BURST_COLORS[i % ICON_BURST_COLORS.length],
        delay: Math.random() * 0.08,
      })),
    [replayKey],
  )

  if (reducedMotion) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 ring-2 ring-success/30">
        <CheckCircle2 size={28} className="text-success" strokeWidth={2.25} />
      </div>
    )
  }

  return (
    <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`ripple-${replayKey}-${i}`}
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full border-2"
          style={{
            width: '3rem',
            height: '3rem',
            borderColor:
              i === 0
                ? 'color-mix(in srgb, var(--color-secondary) 45%, transparent)'
                : 'color-mix(in srgb, var(--color-success) 40%, transparent)',
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 2.3 + i * 0.2], opacity: [0.55, 0] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            delay: i * 0.75,
            ease: 'easeOut',
          }}
        />
      ))}

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
      >
        {ICON_ORBIT_FLASHES.map((flash, i) => (
          <div
            key={`orbit-a-${i}`}
            className="absolute inset-0"
            style={{ transform: `rotate(${(360 / ICON_ORBIT_FLASHES.length) * i}deg)` }}
          >
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: flash.size,
                height: flash.size,
                transform: `translate(-50%, -50%) translateY(-${flash.radius}px)`,
                backgroundColor: flash.color,
                boxShadow: `0 0 6px color-mix(in srgb, ${flash.color} 55%, transparent)`,
              }}
            />
          </div>
        ))}
      </motion.div>

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        animate={{ rotate: -360 }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'linear' }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={`orbit-b-${i}`}
            className="absolute inset-0"
            style={{ transform: `rotate(${i * 90 + 45}deg)` }}
          >
            <div
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success/70"
              style={{
                transform: 'translate(-50%, -50%) translateY(-22px)',
                boxShadow: '0 0 5px color-mix(in srgb, var(--color-success) 50%, transparent)',
              }}
            />
          </div>
        ))}
      </motion.div>

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute h-14 w-14 rounded-full border-2 border-secondary/35"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, rotate: 360 }}
        transition={{
          scale: { duration: 0.9, delay: 0.08, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.9, delay: 0.08 },
          rotate: { duration: 11, repeat: Infinity, ease: 'linear', delay: 0.08 },
        }}
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute h-[3.25rem] w-[3.25rem] rounded-full border-2 border-success/45"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, rotate: -360 }}
        transition={{
          scale: { duration: 0.95, delay: 0.14, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.95, delay: 0.14 },
          rotate: { duration: 7.5, repeat: Infinity, ease: 'linear', delay: 0.14 },
        }}
      />

      {celebrate &&
        burstParticles.map((p) => (
          <motion.div
            key={p.id}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
            }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{
              x: Math.cos(p.angle) * p.distance,
              y: Math.sin(p.angle) * p.distance,
              scale: 1,
              opacity: 0,
            }}
            transition={{ duration: 0.75, delay: 1.05 + p.delay, ease: 'easeOut' }}
          />
        ))}

      <motion.div
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-success/15 ring-2 ring-success/30"
        style={{
          boxShadow: '0 0 24px color-mix(in srgb, var(--color-success) 30%, transparent)',
        }}
        initial={{ scale: 0.2 }}
        animate={{ scale: 1, rotate: 360 }}
        transition={{
          scale: { duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] },
          rotate: { duration: 7, repeat: Infinity, ease: 'linear', delay: 0.12 },
        }}
      >
        <motion.div
          animate={
            celebrate
              ? { scale: [1, 1.18, 0.96, 1.05, 1] }
              : { scale: [1, 1.06, 1] }
          }
          transition={
            celebrate
              ? { duration: 1.05, delay: 1.05, ease: [0.22, 1, 0.36, 1] }
              : { duration: 2.2, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }
          }
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-success" aria-hidden="true">
            <motion.circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.85, delay: 0.55, ease: 'easeInOut' }}
            />
            <motion.path
              d="M7.5 12.2 10.8 15.5 16.5 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.95, delay: 1.15, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  )
}

const SUMMARY_CARD_VARIANTS = {
  participants: {
    card: 'bg-[color-mix(in_srgb,var(--color-secondary)_22%,var(--color-surface))]',
    cardHighlight: 'bg-[color-mix(in_srgb,var(--color-secondary)_32%,var(--color-surface))]',
  },
  activities: {
    card: 'bg-[color-mix(in_srgb,var(--color-primary)_20%,var(--color-surface))]',
    cardHighlight: 'bg-[color-mix(in_srgb,var(--color-primary)_30%,var(--color-surface))]',
  },
  groups: {
    card: 'bg-[color-mix(in_srgb,var(--color-tertiary)_22%,var(--color-surface))]',
    cardHighlight: 'bg-[color-mix(in_srgb,var(--color-tertiary)_32%,var(--color-surface))]',
  },
} as const

export type SummaryCardVariant = keyof typeof SUMMARY_CARD_VARIANTS

export function getSummaryCardVariantStyles(variant: SummaryCardVariant) {
  return SUMMARY_CARD_VARIANTS[variant]
}

interface AnimatedSummaryCardProps {
  children: React.ReactNode
  index: number
  variant: SummaryCardVariant
  highlight?: boolean
}

export function AnimatedSummaryCard({ children, index, variant, highlight }: AnimatedSummaryCardProps) {
  const reducedMotion = usePrefersReducedMotion()
  const styles = SUMMARY_CARD_VARIANTS[variant]

  return (
    <div className="overflow-visible py-1.5 -my-1.5">
      <motion.div
        className={cn(
          'rounded-xl px-3 py-2 flex items-center justify-center',
          styles.card,
          highlight && styles.cardHighlight,
        )}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.85, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          type: 'spring',
          stiffness: 320,
          damping: 24,
          delay: 0.08 + index * 0.08,
        }}
        whileHover={reducedMotion ? undefined : { scale: 1.04, y: -2 }}
      >
        {children}
      </motion.div>
    </div>
  )
}

interface AnimatedPrintFooterProps {
  children: React.ReactNode
  celebrate: boolean
}

export function AnimatedPrintFooter({ children, celebrate }: AnimatedPrintFooterProps) {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      className="border-t border-border/70 px-4 py-3"
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.5 }}
    >
      <motion.div
        animate={
          reducedMotion || !celebrate
            ? undefined
            : {
                boxShadow: [
                  '0 0 0 0 color-mix(in srgb, var(--color-primary) 0%, transparent)',
                  '0 0 0 6px color-mix(in srgb, var(--color-primary) 18%, transparent)',
                  '0 0 0 0 color-mix(in srgb, var(--color-primary) 0%, transparent)',
                ],
              }
        }
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="rounded-xl"
      >
        {children}
      </motion.div>
      <motion.p
        className="text-center text-xs text-muted mt-2"
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        אפשר תמיד לחזור ולהדפיס שוב בהמשך.
      </motion.p>
    </motion.div>
  )
}

interface ReadyCelebrationOverlayProps {
  celebrate: boolean
  burstKey: number
}

export function ReadyCelebrationOverlay({ celebrate, burstKey }: ReadyCelebrationOverlayProps) {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <>
      <ConfettiBurst active={celebrate} burstKey={burstKey} />
      <AnimatePresence>
        {celebrate && !reducedMotion && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-30 bg-success/12"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
          />
        )}
      </AnimatePresence>
    </>
  )
}