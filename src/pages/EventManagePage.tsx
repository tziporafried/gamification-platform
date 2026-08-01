import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { AdvancedManageScreen } from '@/components/manage/AdvancedManageScreen'
import { EventFeaturesProvider, useFeatureFlagState } from '@/contexts/EventFeaturesContext'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { ADVANCED_MANAGEMENT_FLAG } from '@/lib/manage/advancedManagementFlag'
import type { Event } from '@/types'

/**
 * The advanced management screen's route: load the game, then let the flag
 * decide whether this page exists for it.
 *
 * A game without `advanced_management` is sent back to its control center
 * rather than shown a locked screen. Nothing links here without the flag, so
 * the only way to arrive is a pasted or bookmarked URL - and the right answer
 * to that is the screen the game does have, not a door it cannot open.
 */

function GatedManageScreen({ event }: { event: Event }) {
  const { on, loading } = useFeatureFlagState(ADVANCED_MANAGEMENT_FLAG)

  // Redirecting before the catalogue has arrived would bounce a game that does
  // have the flag, every time it was opened cold.
  if (loading) return <FullPageLoader />
  if (!on) return <Navigate to={`/events/${event.id}/control`} replace />

  return <AdvancedManageScreen event={event} />
}

export function EventManagePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)

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
    }
    fetchEvent()
  }, [id, navigate])

  if (!event) return <FullPageLoader />

  return (
    <EventFeaturesProvider eventId={event.id} plan={event.plan}>
      <GatedManageScreen event={event} />
    </EventFeaturesProvider>
  )
}
