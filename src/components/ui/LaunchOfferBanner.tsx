import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Countdown } from '@/components/ui/Countdown'
import { usePlansModal } from '@/contexts/PlansModalContext'
import { LAUNCH_PRICE_EXPIRES_AT, isLaunchOfferActive } from '@/lib/planPrices'
import { cn } from '@/lib/utils'

interface LaunchOfferBannerProps {
  /**
   * 'bar' - full-bleed strip that sticks under the global header, header-like.
   * 'inline' - contained card that flows with the surrounding content.
   */
  variant?: 'bar' | 'inline'
  /** Bars stick under the global header; turn off inside a modal or a panel. */
  sticky?: boolean
  /** Hide the CTA where it makes no sense - e.g. inside the plans modal. */
  showAction?: boolean
  /** Passed to the plans modal so the request is tied to this event. */
  eventId?: string | null
  /** Analytics entry point for the plans modal. */
  source?: string
  /** Overrides the default "open the plans modal" behaviour. */
  onViewPlans?: () => void
  /** Fires when the offer runs out - hosts showing prices should re-resolve. */
  onExpire?: () => void
  className?: string
}

/**
 * Reminder that the launch price is running out, with a way to act on it.
 * Self-contained: it knows when the offer is over and fades itself away, so a
 * host only has to decide where it sits.
 */
export function LaunchOfferBanner({
  variant = 'inline',
  sticky,
  showAction = true,
  eventId = null,
  source = 'launch_offer_banner',
  onViewPlans,
  onExpire,
  className,
}: LaunchOfferBannerProps) {
  const { openPlans } = usePlansModal()
  const [offerActive, setOfferActive] = useState(() => isLaunchOfferActive())
  const isBar = variant === 'bar'
  const isSticky = sticky ?? isBar

  const handleExpire = useCallback(() => {
    setOfferActive(false)
    onExpire?.()
  }, [onExpire])

  // The plans modal is rendered globally, so opening it leaves the page (and
  // anything typed into it) mounted and untouched behind the overlay.
  const handleClick = useCallback(() => {
    if (onViewPlans) {
      onViewPlans()
      return
    }
    openPlans({ eventId, source, focusPlan: 'full' })
  }, [onViewPlans, openPlans, eventId, source])

  return (
    <AnimatePresence initial={false}>
      {offerActive && (
        <motion.div
          key="launch-offer-banner"
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={cn(
            isBar
              ? // Opaque fill (not a tint) so page content scrolling underneath
                // never shows through the strip.
                'w-full border-b border-primary/35 px-4 py-3.5 sm:px-6' +
                ' bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-surface))]'
              : 'rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-2.5',
            // Sits directly under the sticky header (h-14) and stays there.
            isSticky && 'sticky top-14 z-30',
            className,
          )}
        >
          <div
            className={cn(
              'mx-auto flex w-full flex-wrap items-center justify-center gap-x-8 gap-y-2',
              isBar ? 'max-w-4xl' : 'max-w-[900px]',
            )}
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-x-3 leading-snug">
                <span className="text-sm font-medium text-muted">
                  <span aria-hidden="true">🔥</span> מחיר ההשקה מסתיים בעוד
                </span>
                <Countdown
                  target={LAUNCH_PRICE_EXPIRES_AT}
                  onExpire={handleExpire}
                  format="words"
                  className="text-lg font-semibold text-primary-text"
                />
              </p>
            </div>
            {showAction && (
              <button
                type="button"
                onClick={handleClick}
                className={cn(
                  'shrink-0 rounded text-sm font-medium text-primary-text',
                  'hover:underline focus-visible:outline-none focus-visible:ring-2',
                  'focus-visible:ring-primary focus-visible:ring-offset-2',
                )}
              >
                ← שריינו עכשיו
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
