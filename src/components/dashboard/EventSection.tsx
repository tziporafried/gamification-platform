import { useState } from 'react'
import { EventForm } from './EventForm'
import { EventDetails } from './EventDetails'
import type { Event } from '@/types'

interface EventSectionProps {
  event: Event
  onEventUpdated: (event: Event) => void
}

export function EventSection({ event, onEventUpdated }: EventSectionProps) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <EventForm
        event={event}
        onSaved={(e) => { onEventUpdated(e); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return <EventDetails event={event} onEdit={() => setEditing(true)} />
}
