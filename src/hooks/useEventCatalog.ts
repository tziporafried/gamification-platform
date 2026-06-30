import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface CatalogParticipant {
  id: string
  name: string
  externalId: string
}

export interface CatalogAction {
  id: string
  name: string
  code: string
  points: number
}

export function useEventCatalog(eventId: string) {
  const [participants, setParticipants] = useState<CatalogParticipant[]>([])
  const [actions, setActions] = useState<CatalogAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const [pRes, aRes] = await Promise.all([
        supabase.from('participants').select('id, name, external_id').eq('event_id', eventId).order('name'),
        supabase.from('actions').select('id, name, code, points').eq('event_id', eventId).eq('is_active', true).order('name'),
      ])
      if (cancelled) return
      setParticipants((pRes.data ?? []).map((p) => ({ id: p.id, name: p.name, externalId: p.external_id })))
      setActions((aRes.data ?? []).map((a) => ({ id: a.id, name: a.name, code: a.code, points: a.points })))
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [eventId])

  return { participants, actions, loading }
}
