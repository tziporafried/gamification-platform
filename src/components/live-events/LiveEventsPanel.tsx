import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LIVE_EVENT_CATALOG } from './types'
import { LiveEventLibraryCard } from './LiveEventLibraryCard'

interface LiveEventsPanelProps {
  eventId: string
}

/**
 * Legacy live-events page UI - catalog teasers only (modal is the primary launcher).
 */
export function LiveEventsPanel({ eventId: _eventId }: LiveEventsPanelProps) {
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
          חוויות חיות לקהל - בקרוב אצלכם.
        </p>
      </header>

      <div className="mb-3 text-center">
        <p className="text-xs font-bold tracking-wide text-muted">בקרוב</p>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {LIVE_EVENT_CATALOG.map((item) => (
          <LiveEventLibraryCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
