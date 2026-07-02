import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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

const CONFETTI_BURST_INTERVAL_MS = 2800

interface ConfettiBurstProps {
  active: boolean
  burstKey: number
  loop?: boolean
}

function ConfettiBurst({ active, burstKey, loop = false }: ConfettiBurstProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    if (!active || !loop || reducedMotion) {
      setCycle(0)
      return
    }

    const interval = window.setInterval(() => {
      setCycle((c) => c + 1)
    }, CONFETTI_BURST_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [active, loop, reducedMotion])

  const effectiveBurstKey = burstKey + cycle
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
    [effectiveBurstKey],
  )

  if (reducedMotion) return null

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={effectiveBurstKey}
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
  collapsed?: boolean
  footerNote?: string
  children?: ReactNode
}

export function ReadyCelebrationBanner({
  title,
  description,
  celebrate,
  replayKey,
  collapsed = false,
  footerNote,
  children,
}: ReadyCelebrationBannerProps) {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      layout
      className={cn(
        'relative overflow-visible rounded-2xl border border-border bg-surface-elevated shadow-card',
        collapsed ? 'px-4 py-3' : 'px-5 py-5',
      )}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.88, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22, delay: collapsed ? 0 : 0.1 }}
    >
      {!reducedMotion && celebrate && !collapsed && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-success/60"
          initial={{ opacity: 0.8, scale: 1 }}
          animate={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      )}

      <div className={cn('relative flex flex-col items-center text-center', collapsed ? 'gap-2' : 'gap-3')}>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="festive-icon"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="overflow-visible py-1"
            >
              <FestiveSuccessIcon key={replayKey} celebrate={celebrate} replayKey={replayKey} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn('w-full', !collapsed && 'space-y-1')}>
          <motion.p
            layout
            className={cn(
              'font-semibold text-success',
              collapsed ? 'text-sm' : 'text-base',
            )}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: collapsed ? 0 : 0.25, duration: 0.35 }}
          >
            {title}
          </motion.p>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.p
                key="description"
                className="text-sm text-muted"
                initial={reducedMotion ? false : { opacity: 0, y: 6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                {description}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {children && (
          <motion.div
            layout
            className={cn(
              'w-full',
              collapsed ? 'pt-0' : 'border-t border-border/50 pt-4',
            )}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: collapsed ? 0 : 0.45, duration: 0.4 }}
          >
            {children}
            {footerNote && !collapsed && (
              <p className="mt-3 text-sm text-muted">{footerNote}</p>
            )}
          </motion.div>
        )}
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

function FestiveSuccessIcon({
  celebrate,
  replayKey,
  compact = false,
}: {
  celebrate: boolean
  replayKey: number
  compact?: boolean
}) {
  const reducedMotion = usePrefersReducedMotion()
  const burstParticles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        angle: (i / 10) * Math.PI * 2 + Math.random() * 0.4,
        distance: compact ? 20 + Math.random() * 12 : 28 + Math.random() * 18,
        size: 3 + Math.random() * 3,
        color: ICON_BURST_COLORS[i % ICON_BURST_COLORS.length],
        delay: Math.random() * 0.08,
      })),
    [replayKey, compact],
  )

  const outerSize = compact ? 'h-[3.25rem] w-[3.25rem]' : 'h-[4.5rem] w-[4.5rem]'
  const innerSize = compact ? 'h-9 w-9' : 'h-12 w-12'
  const svgSize = compact ? 'h-5 w-5' : 'h-7 w-7'
  const rippleSize = compact ? '2.25rem' : '3rem'

  if (reducedMotion) {
    return (
      <div className={cn('flex items-center justify-center rounded-full bg-success/15 ring-2 ring-success/30', innerSize)}>
        <CheckCircle2 size={compact ? 20 : 28} className="text-success" strokeWidth={2.25} />
      </div>
    )
  }

  return (
    <div className={cn('relative flex items-center justify-center overflow-visible', outerSize)}>
      {[0, 1, 2].map((i) => (
        <div key={`ripple-wrap-${replayKey}-${i}`} className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <motion.div
            className="rounded-full border-2"
            style={{
              width: rippleSize,
              height: rippleSize,
              borderColor:
                i === 0
                  ? 'color-mix(in srgb, var(--color-secondary) 45%, transparent)'
                  : 'color-mix(in srgb, var(--color-success) 40%, transparent)',
            }}
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: [0.75, compact ? 2 + i * 0.15 : 2.5 + i * 0.2], opacity: [0.65, 0] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              delay: i * 0.5,
              ease: 'easeOut',
            }}
          />
        </div>
      ))}

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
      >
        {ICON_ORBIT_FLASHES.map((flash, i) => (
          <div
            key={`orbit-${i}`}
            className="absolute inset-0"
            style={{ transform: `rotate(${(360 / ICON_ORBIT_FLASHES.length) * i}deg)` }}
          >
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: flash.size,
                height: flash.size,
                transform: `translate(-50%, -50%) translateY(-${compact ? flash.radius - 10 : flash.radius}px)`,
                backgroundColor: flash.color,
                boxShadow: `0 0 8px color-mix(in srgb, ${flash.color} 60%, transparent)`,
              }}
              animate={{ scale: [0.85, 1.4, 0.85], opacity: [0.55, 1, 0.55] }}
              transition={{
                duration: 1.2 + i * 0.08,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.1,
              }}
            />
          </div>
        ))}
      </motion.div>

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        animate={{ rotate: -360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={`orbit-inner-${i}`}
            className="absolute inset-0"
            style={{ transform: `rotate(${i * 90 + 45}deg)` }}
          >
            <motion.div
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success/80"
              style={{
                transform: `translate(-50%, -50%) translateY(-${compact ? 30 : 36}px)`,
                boxShadow: '0 0 6px color-mix(in srgb, var(--color-success) 55%, transparent)',
              }}
              animate={{ scale: [0.6, 1.2, 0.6], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
            />
          </div>
        ))}
      </motion.div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <motion.div
          className={cn('rounded-full border-2 border-secondary/40', compact ? 'h-10 w-10' : 'h-14 w-14')}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 1.06, 1], opacity: [0.45, 0.9, 0.45], rotate: 360 }}
          transition={{
            scale: { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.08 },
            opacity: { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.08 },
            rotate: { duration: 8, repeat: Infinity, ease: 'linear', delay: 0.08 },
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <motion.div
          className={cn('rounded-full border-2 border-success/50', compact ? 'h-9 w-9' : 'h-[3.25rem] w-[3.25rem]')}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.4, 1, 0.4], rotate: -360 }}
          transition={{
            scale: { duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.14 },
            opacity: { duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.14 },
            rotate: { duration: 5.5, repeat: Infinity, ease: 'linear', delay: 0.14 },
          }}
        />
      </div>

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
        className={cn(
          'relative z-10 flex items-center justify-center rounded-full bg-success/15 ring-2 ring-success/30',
          innerSize,
        )}
        initial={{ scale: 0.2 }}
        animate={{
          scale: [1, 1.05, 1],
          boxShadow: [
            '0 0 18px color-mix(in srgb, var(--color-success) 25%, transparent)',
            '0 0 36px color-mix(in srgb, var(--color-success) 55%, transparent)',
            '0 0 18px color-mix(in srgb, var(--color-success) 25%, transparent)',
          ],
        }}
        transition={{
          scale: { duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] },
          boxShadow: { duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
        }}
      >
        <motion.div
          animate={
            celebrate
              ? { scale: [1, 1.18, 0.96, 1.05, 1] }
              : { scale: [1, 1.1, 1] }
          }
          transition={
            celebrate
              ? { duration: 1.05, delay: 1.05, ease: [0.22, 1, 0.36, 1] }
              : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <svg
            key={`check-${replayKey}`}
            viewBox="0 0 24 24"
            className={cn('text-success', svgSize)}
            aria-hidden="true"
          >
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

const SUMMARY_CARD_TINTS = {
  participants: {
    card: 'gradient-reward-rich',
    cardHighlight: 'gradient-reward-rich brightness-[1.04]',
    text: 'text-white',
  },
  secondary: {
    card: 'gradient-action-card',
    cardHighlight: 'gradient-action-card brightness-[1.04]',
    text: 'text-white',
  },
  tertiary: {
    card: 'bg-tertiary',
    cardHighlight: 'bg-tertiary brightness-[1.04]',
    text: 'text-white',
  },
  primary: {
    card: 'gradient-reward-legendary',
    cardHighlight: 'gradient-reward-legendary brightness-[1.04]',
    text: 'text-white',
  },
} as const

const SUMMARY_CARD_VARIANTS = {
  participants: SUMMARY_CARD_TINTS.participants,
  activities: SUMMARY_CARD_TINTS.secondary,
  groups: SUMMARY_CARD_TINTS.tertiary,
  groupsTogether: SUMMARY_CARD_TINTS.secondary,
  cards: SUMMARY_CARD_TINTS.primary,
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
    <div className="overflow-visible py-1 -my-1">
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
      className="border-t border-border px-4 pt-3 pb-2"
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
    </motion.div>
  )
}

interface ReadyCelebrationOverlayProps {
  celebrate: boolean
  burstKey: number
  confettiLoop?: boolean
}

export function ReadyCelebrationOverlay({ celebrate, burstKey, confettiLoop = false }: ReadyCelebrationOverlayProps) {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <>
      <ConfettiBurst active={confettiLoop || celebrate} burstKey={burstKey} loop={confettiLoop} />
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