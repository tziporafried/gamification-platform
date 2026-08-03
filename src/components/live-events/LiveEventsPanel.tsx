import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackLiveEventSelect } from '@/lib/analytics'
import {
  LIVE_EVENT_CATALOG,
  isLiveEventLaunchable,
  liveEventDestination,
  type LiveEventCatalogItem,
} from './types'
import { LiveEventLibraryCard } from './LiveEventLibraryCard'

interface LiveEventsPanelProps {
  eventId: string
}

/**
 * Legacy live-events page UI - modal is the primary launcher from control center.
 */
export function LiveEventsPanel({ eventId }: LiveEventsPanelProps) {
  const navigate = useNavigate()
  // Every launchable item, not the lottery by name: this page used to hard-code
  // the one thing that had shipped, so the second one to ship would have
  // vanished from it entirely - neither launchable here nor listed as upcoming.
  const launchable = LIVE_EVENT_CATALOG.filter((item) => isLiveEventLaunchable(item))
  const featured = launchable[0] ?? null
  const alsoLaunchable = launchable.slice(1)
  const upcoming = LIVE_EVENT_CATALOG.filter((item) => !isLiveEventLaunchable(item))

  function launch(item: LiveEventCatalogItem) {
    const destination = liveEventDestination(item.id, eventId)
    if (!destination) return
    trackLiveEventSelect({
      eventId,
      catalogId: item.id,
      launchable: true,
    })
    navigate(destination)
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <header className="mb-8 flex flex-col items-center text-center sm:mb-9">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-secondary/25 bg-secondary/10 text-secondary-text shadow-sm">
          <Zap size={24} strokeWidth={2.25} aria-hidden="true" />
        </div>
        <h1
          className={cn(
            'mb-1.5 bg-[length:250%_100%] bg-clip-text text-2xl font-black text-transparent sm:text-3xl',
            'animate-[shimmer_8s_ease-in-out_infinite] motion-reduce:animate-none',
            '[background-image:linear-gradient(110deg,var(--color-foreground)_0%,var(--color-foreground)_38%,color-mix(in_srgb,var(--color-primary)_85%,white)_50%,var(--color-foreground)_62%,var(--color-foreground)_100%)]',
          )}
        >
          הפעלות בזמן אמת
        </h1>
        <p className="max-w-lg text-sm font-medium leading-relaxed text-muted sm:text-base">
          השיקו רגע מיוחד לקהל - הפעלות חדשות בדרך.
        </p>
      </header>

      {featured && (
        <div className="mx-auto mb-5 w-full max-w-xl sm:mb-6">
          <LiveEventLibraryCard item={featured} featured onLaunch={() => launch(featured)} />
        </div>
      )}

      {alsoLaunchable.length > 0 && (
        <div className="mb-6 grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2">
          {alsoLaunchable.map((item) => (
            <LiveEventLibraryCard key={item.id} item={item} onLaunch={() => launch(item)} />
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="mb-3 text-center">
            <p className="text-xs font-bold tracking-wide text-muted">בקרוב</p>
          </div>
          <div className="grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2">
            {upcoming.map((item) => (
              <LiveEventLibraryCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
