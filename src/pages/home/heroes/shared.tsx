import type { ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Building blocks the hero sections share. Use them to keep a seasonal hero
 * feeling like the rest of the page - or ignore them and do something else.
 */

export const HERO_EASE_OUT = [0.22, 1, 0.36, 1] as const

/** Each child of the hero fades up in turn. */
export const heroFadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
}

/** Put on the hero <motion.section> so its children animate one after another. */
export const heroStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
}

/** The outer section's spacing and width - same as the family vacation hero. */
export const HERO_SECTION_CLASS = 'mx-auto mb-10 max-w-2xl text-center sm:mb-12'

/** The highlighted brand word - orange, with the shimmer when motion is allowed. */
export function Brand({ children, className }: { children: ReactNode; className?: string }) {
  const reducedMotion = useReducedMotion()
  return (
    <span className={cn('text-primary-text', !reducedMotion && 'landing-brand-shimmer', className)}>{children}</span>
  )
}
