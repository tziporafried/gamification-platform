import { ChevronLeft } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import { usePlansModal } from '@/contexts/PlansModalContext'
import {
  trackActivationOptionsClicked,
  trackCtaClick,
} from '@/lib/analytics'

export type TrialActivationBadgeSource =
  | 'events_page_trial_badge'
  | 'wizard_trial_badge'

interface TrialActivationBadgeProps {
  eventId: string
  source: TrialActivationBadgeSource
  className?: string
}

/** Compact trial → activation CTA used on My Events and wizard header. */
export function TrialActivationBadge({
  eventId,
  source,
  className,
}: TrialActivationBadgeProps) {
  const { openPlans } = usePlansModal()

  function handleClick(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation()
    e.preventDefault()
    trackActivationOptionsClicked(eventId, source)
    trackCtaClick({
      cta_name: 'view_activation_options',
      cta_location: source,
      destination: 'plans_modal',
    })
    openPlans({ eventId, source })
  }

  return (
    <Tooltip
      portal
      rich
      side="bottom"
      content={
        <span className="block space-y-1.5">
          <span className="block text-[13px] font-bold leading-snug text-foreground">
            מוכנים להפעיל את המשחק באירוע?
          </span>
          <span className="block text-xs leading-relaxed text-muted">
            בחרו את אפשרות ההפעלה שמתאימה לכם והמשיכו להפעלת המשחק.
          </span>
        </span>
      }
    >
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick(e)
          }
        }}
        className={cn(
          'inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
          'cursor-pointer transition-colors duration-[180ms] ease-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1',
          'hover:brightness-[0.97]',
          className,
        )}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-elevated))',
          color: 'color-mix(in srgb, var(--color-primary) 78%, var(--color-muted))',
          border: '1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)',
        }}
        aria-label="הפעלת המשחק - בחרו אופן הפעלה"
      >
        <span>הפעלת המשחק</span>
        <ChevronLeft size={12} strokeWidth={2.5} className="opacity-70" aria-hidden />
      </button>
    </Tooltip>
  )
}
