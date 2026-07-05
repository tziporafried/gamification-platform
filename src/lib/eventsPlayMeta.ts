import { supabase } from '@/lib/supabase'
import type { EventCounts } from '@/types'

const EMPTY_COUNTS: EventCounts = {
  participants: 0,
  groups: 0,
  tasks: 0,
  transactions: 0,
  rewards: 0,
}

export interface EventPlayMeta {
  counts: EventCounts
  totalScans: number
}

export async function fetchEventsPlayMeta(eventIds: string[]): Promise<Record<string, EventPlayMeta>> {
  if (eventIds.length === 0) return {}

  const meta: Record<string, EventPlayMeta> = Object.fromEntries(
    eventIds.map((id) => [id, { counts: { ...EMPTY_COUNTS }, totalScans: 0 }]),
  )

  const [participantsRes, groupsRes, tasksRes, rewardsRes, scansRes] = await Promise.all([
    supabase.from('participants').select('event_id').in('event_id', eventIds),
    supabase.from('groups').select('event_id').in('event_id', eventIds),
    supabase.from('actions').select('event_id').in('event_id', eventIds),
    supabase.from('rewards').select('event_id').in('event_id', eventIds),
    supabase.from('point_transactions').select('event_id').in('event_id', eventIds),
  ])

  for (const row of participantsRes.data ?? []) {
    meta[row.event_id].counts.participants += 1
  }
  for (const row of groupsRes.data ?? []) {
    meta[row.event_id].counts.groups += 1
  }
  for (const row of tasksRes.data ?? []) {
    meta[row.event_id].counts.tasks += 1
  }
  for (const row of rewardsRes.data ?? []) {
    meta[row.event_id].counts.rewards += 1
  }
  for (const row of scansRes.data ?? []) {
    meta[row.event_id].counts.transactions += 1
    meta[row.event_id].totalScans += 1
  }

  return meta
}
