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
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

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
  collapsed?: boolean
  footerNote?: string
  children?: ReactNode
}

export function ReadyCelebrationBanner({
  title,
  description,
  celebrate,
  collapsed = false,
  footerNote,
  children,
}: ReadyCelebrationBannerProps) {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      className={cn(
        'relative overflow-visible rounded-2xl border border-border bg-surface-elevated shadow-card',
        collapsed ? 'px-4 py-3' : 'px-5 py-5',
      )}
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
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
            <div key="festive-icon" className="overflow-visible py-1 festive-success-enter">
              <FestiveSuccessIcon />
            </div>
          )}
        </AnimatePresence>

        <div className={cn('w-full', !collapsed && 'space-y-1')}>
          <motion.p
            className={cn(
              'font-semibold text-success-text',
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

function FestiveSuccessIcon() {
  return (
    <div className="festive-success-icon" aria-hidden="true">
      <div className="festive-success-burst" />
      <div className="festive-success-burst festive-success-burst-delayed" />
      <div className="festive-success-glow" />
      <div className="festive-success-ring festive-success-ring-outer">
        <div className="festive-success-ring-hole" />
      </div>
      <div className="festive-success-ring festive-success-ring-inner">
        <div className="festive-success-ring-hole" />
      </div>
      <CheckCircle2 size={32} className="festive-success-check text-success-text" strokeWidth={2.5} />
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
  success: {
    card: 'gradient-reward-starter',
    cardHighlight: 'gradient-reward-starter brightness-[1.04]',
    text: 'text-white',
  },
} as const

const SUMMARY_CARD_VARIANTS = {
  participants: SUMMARY_CARD_TINTS.participants,
  activities: SUMMARY_CARD_TINTS.secondary,
  groups: SUMMARY_CARD_TINTS.tertiary,
  groupsTogether: SUMMARY_CARD_TINTS.secondary,
  scans: SUMMARY_CARD_TINTS.tertiary,
  cards: SUMMARY_CARD_TINTS.primary,
  points: SUMMARY_CARD_TINTS.primary,
  /**
   * Prizes defined in the wizard - `rewardsEarned` is the live count. Its own
   * tint: it stands next to participants, activities, groups and cards in the
   * wizard's ending, and no two tiles there may share a colour.
   */
  rewards: SUMMARY_CARD_TINTS.success,
  rewardsEarned: SUMMARY_CARD_TINTS.participants,
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
    <div className="h-full overflow-visible py-1 -my-1">
      <motion.div
        className={cn(
          // h-full so a tile whose label wraps does not leave its neighbours
          // shorter - the row decides the height, not the text.
          'h-full rounded-xl px-3 py-2 flex items-center justify-center text-center',
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