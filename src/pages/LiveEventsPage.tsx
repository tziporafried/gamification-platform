import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { LiveEventsPanel } from '@/components/live-events/LiveEventsPanel'
import { useEventHeaderBreadcrumb } from '@/hooks/useEventHeaderBreadcrumb'
import type { Event } from '@/types'

export function LiveEventsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .neq('status', 'archived')
        .single()

      if (!data) {
        navigate('/events', { replace: true })
        return
      }
      setEvent(data)
      setLoading(false)
    }
    void fetchEvent()
  }, [id, navigate])

  useEventHeaderBreadcrumb(event?.name ?? '', 'הפעלות בזמן אמת', event?.plan, event?.id)

  if (loading || !event) return <FullPageLoader />

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col overflow-y-auto px-4 py-6 sm:py-8">
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center">
        <LiveEventsPanel eventId={event.id} />
      </main>
    </div>
  )
}
