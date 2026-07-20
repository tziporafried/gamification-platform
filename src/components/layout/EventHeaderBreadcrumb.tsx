import { useNavigate } from 'react-router-dom'
import { TrialActivationBadge } from '@/components/event/TrialActivationBadge'

interface EventHeaderBreadcrumbProps {
  eventName: string
  suffix?: string
  /** When set, the event name links back to the control board. */
  eventId?: string
  /** When set (trial wizard), shows the same activation pill as My Events after the name. */
  trialEventId?: string
}

export function EventHeaderBreadcrumb({
  eventName,
  suffix,
  eventId,
  trialEventId,
}: EventHeaderBreadcrumbProps) {
  const navigate = useNavigate()
  const backPath = suffix === 'עריכת תבנית' ? '/admin/templates' : '/events'
  const backLabel = suffix === 'עריכת תבנית' ? 'ניהול מערכת' : 'האירועים שלי'
  const controlPath = eventId ? `/events/${eventId}/control` : null
  const nameLabel = eventName || 'אירוע חדש'

  return (
    <div className="flex items-center gap-2 min-w-0 leading-none">
      <button
        type="button"
        onClick={() => navigate(backPath)}
        className="shrink-0 text-xs font-medium leading-none text-muted transition-colors hover:text-foreground"
      >
        <span>{backLabel}</span>
      </button>
      <span className="shrink-0 text-muted/60 leading-none">/</span>
      {controlPath ? (
        <button
          type="button"
          onClick={() => navigate(controlPath)}
          className="truncate max-w-[200px] text-sm font-bold leading-none text-primary-text transition-colors hover:opacity-80"
          aria-label={`חזרה ללוח הבקרה - ${nameLabel}`}
        >
          {nameLabel}
        </button>
      ) : (
        <span className="truncate max-w-[200px] text-sm font-bold leading-none text-primary-text">
          {nameLabel}
        </span>
      )}
      {trialEventId && (
        <TrialActivationBadge eventId={trialEventId} source="wizard_trial_badge" />
      )}
      {suffix && (
        <>
          <span className="shrink-0 text-muted/60 leading-none">/</span>
          <span className="truncate text-xs font-medium leading-none text-muted">{suffix}</span>
        </>
      )}
    </div>
  )
}
