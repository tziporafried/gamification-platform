import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { Event } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  editing: 'בעריכה',
  active: 'פעיל',
  archived: 'בארכיון',
}

interface EventDetailsProps {
  event: Event
  onEdit: () => void
}

export function EventDetails({ event, onEdit }: EventDetailsProps) {
  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 gradient-brand" />
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {event.logo_url ? (
              <img
                src={event.logo_url}
                alt={event.name}
                className="h-16 w-16 rounded-xl object-cover border border-game-border"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl gradient-brand text-2xl font-bold text-white">
                {event.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-white">{event.name}</h2>
              <p className="text-sm text-gray-500">/{event.slug}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit}>
            עריכת אירוע
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">סטטוס</p>
            <span className="mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-brand-600/20 text-brand-300">
              {STATUS_LABELS[event.status] ?? event.status}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">נוצר</p>
            <p className="mt-1 text-sm text-gray-300">
              {new Date(event.created_at).toLocaleDateString('he-IL')}
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
