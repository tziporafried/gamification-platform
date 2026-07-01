import { useNavigate } from 'react-router-dom'

interface EventHeaderBreadcrumbProps {
  eventName: string
  suffix?: string
}

export function EventHeaderBreadcrumb({ eventName, suffix }: EventHeaderBreadcrumbProps) {
  const navigate = useNavigate()
  const backPath = suffix === 'עריכת תבנית' ? '/admin' : '/events'
  const backLabel = suffix === 'עריכת תבנית' ? 'ניהול מערכת' : 'האירועים שלי'

  return (
    <div className="flex items-center gap-2 min-w-0">
      <button
        onClick={() => navigate(backPath, suffix === 'עריכת תבנית' ? { state: { tab: 'templates' } } : undefined)}
        className="shrink-0 text-xs font-medium text-muted transition-colors hover:text-foreground"
      >
        <span>{backLabel}</span>
      </button>
      <span className="shrink-0 text-muted/60">/</span>
      <span className="truncate max-w-[200px] text-sm font-bold text-primary">
        {eventName || 'אירוע חדש'}
      </span>
      {suffix && (
        <>
          <span className="shrink-0 text-muted/60">/</span>
          <span className="truncate text-xs font-medium text-muted">{suffix}</span>
        </>
      )}
    </div>
  )
}
