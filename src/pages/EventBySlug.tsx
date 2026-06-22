import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useEventCounts } from '@/hooks/useEventCounts'
import { ControlCenter } from '@/components/wizard/ControlCenter'
import type { Event } from '@/types'

type PageState = 'loading' | 'not_found' | 'no_permission' | 'ready'

export function EventBySlugControl() {
  const { slug } = useParams<{ slug: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [state, setState] = useState<PageState>('loading')
  const { counts } = useEventCounts(event?.id)

  useEffect(() => {
    async function resolve() {
      if (!slug) { setState('not_found'); return }

      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single()

      if (data) {
        setEvent(data)
        setState('ready')
        return
      }

      const { data: exists } = await supabase.rpc('check_event_slug_exists', { p_slug: slug })
      setState(exists ? 'no_permission' : 'not_found')
    }
    resolve()
  }, [slug])

  if (state === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-game-dark">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  if (state === 'not_found') {
    return (
      <div className="flex h-screen items-center justify-center bg-game-dark px-4" dir="rtl">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-white">האירוע לא נמצא</h1>
          <p className="text-gray-400 text-sm">הקישור שגוי או שהאירוע נמחק</p>
        </div>
      </div>
    )
  }

  if (state === 'no_permission') {
    return (
      <div className="flex h-screen items-center justify-center bg-game-dark px-4" dir="rtl">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-white">אין לך הרשאה</h1>
          <p className="text-gray-400 text-sm">אין לך גישה לאירוע הזה. פנה לבעל האירוע כדי לקבל הזמנה.</p>
        </div>
      </div>
    )
  }

  return <ControlCenter event={event!} counts={counts} onEventUpdated={setEvent} />
}
