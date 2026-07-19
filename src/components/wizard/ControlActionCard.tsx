import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * The big gradient action cards on the control center, and the floating icon
 * that sits on top of them.
 *
 * Shared with the offline player's hub (src/offline/screens/OfflineHub.tsx) so
 * the exported game opens on the same design the user set the game up in — a
 * hand-copied second version drifted away from this one once already.
 */

interface ControlActionCardProps {
  onClick: () => void
  gradient?: string
  title: string
  description: string
  cta: string
  icon: ReactNode
  decoration?: ReactNode
  dimmed?: boolean
}

export function ControlActionCard({
  onClick,
  gradient,
  title,
  description,
  cta,
  icon,
  decoration,
  dimmed = false,
}: ControlActionCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group w-full text-right"
      initial={false}
      whileHover={{
        scale: dimmed ? 1.02 : 1.03,
        y: dimmed ? -2 : -4,
        transition: { duration: 0.1, ease: 'easeOut' },
      }}
      whileTap={{ scale: 0.98, transition: { duration: 0.08 } }}
    >
      <div
        className={cn(
          'relative overflow-visible rounded-3xl transition-[box-shadow,border-color,transform] duration-100 ease-out',
          dimmed
            ? 'border border-dashed border-neutral-300 bg-neutral-200 shadow-card group-hover:border-neutral-400 group-hover:bg-neutral-100'
            : 'shadow-card group-hover:shadow-card-hover',
        )}
      >
        {!dimmed && gradient && (
          <div className={cn('absolute inset-0 overflow-hidden rounded-3xl', gradient)} />
        )}
        {!dimmed && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
            {decoration}
          </div>
        )}

        <div className="relative flex min-h-[300px] flex-col p-7">
          <div className="relative flex flex-1 flex-col items-center overflow-visible pt-2 text-center">
            <div className="flex h-[5.5rem] shrink-0 items-center justify-center overflow-visible">
              {icon}
            </div>

            {/* Fixed title band so sibling cards share one title baseline. */}
            <div className="mt-5 flex w-full flex-1 flex-col">
              <h3
                className={cn(
                  'min-h-[3.5rem] text-xl font-black leading-snug',
                  dimmed ? 'text-neutral-700' : 'text-white',
                )}
              >
                {title}
              </h3>
              <p
                className={cn(
                  'mt-1.5 min-h-[2.75rem] flex-1 text-sm leading-relaxed',
                  dimmed ? 'text-neutral-500' : 'text-white/80',
                )}
              >
                {description}
              </p>
            </div>

            <div className="mt-5 w-full shrink-0 pt-1">
              <div
                className={cn(
                  'rounded-xl px-5 py-2.5 text-sm font-bold transition-colors duration-100',
                  dimmed
                    ? 'border border-neutral-300 bg-neutral-100 text-neutral-600 group-hover:bg-white'
                    : 'border border-white/25 bg-white/15 text-white group-hover:bg-white/25',
                )}
              >
                {cta}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  )
}

interface FloatingActionIconProps {
  children: ReactNode
  duration?: number
  phase?: number
  pulsePhase?: number
  rotate?: boolean
  pulse?: boolean
}

export function FloatingActionIcon({
  children,
  duration = 4.5,
  phase = 0.5,
  pulsePhase = 0.5,
  rotate = false,
  pulse = false,
}: FloatingActionIconProps) {
  return (
    <motion.div
      className="relative z-10"
      animate={{
        y: [0, -16, -8, -18, -4, 0],
        x: [0, 5, -4, 3, -2, 0],
        rotate: rotate ? [0, 0, 12, 12, -8, 0] : [0, -2, 1, -3, 2, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: -duration * phase,
      }}
    >
      <motion.div
        className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/25 bg-white/15 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-sm"
        animate={
          pulse
            ? {
                boxShadow: [
                  '0 10px 28px rgba(0,0,0,0.18), 0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                  '0 14px 32px rgba(0,0,0,0.22), 0 0 0 10px color-mix(in srgb, white 16%, transparent)',
                  '0 10px 28px rgba(0,0,0,0.18), 0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                ],
              }
            : undefined
        }
        transition={pulse ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: -2.5 * pulsePhase } : undefined}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
