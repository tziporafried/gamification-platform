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

interface PlayMetaRow {
  event_id: string
  participants: number
  groups: number
  tasks: number
  rewards: number
  transactions: number
}

/** The tables behind the count columns, in EventCounts order. */
const COUNTED: { table: string; key: keyof EventCounts }[] = [
  { table: 'participants', key: 'participants' },
  { table: 'groups', key: 'groups' },
  { table: 'actions', key: 'tasks' },
  { table: 'rewards', key: 'rewards' },
  { table: 'point_transactions', key: 'transactions' },
]

/** PostgREST's "no such function in the schema cache" - i.e. 086 is not applied. */
const FUNCTION_MISSING = 'PGRST202'

/**
 * Participants, groups, tasks, rewards and scans per event, for the events
 * tables that list several games side by side.
 *
 * One round trip that returns one row per event, counted by the database
 * (migration 086). Counting them here instead - one select per table, one row
 * per participant and per scan - runs into PostgREST's 1000-row response cap,
 * and because the cap is per request rather than per event it silently reports
 * 0 for whichever events fall past it. fallbackCounts below still does exactly
 * that, paginated so the total is right, and only where 086 is not applied yet:
 * it moves every participant and every scan of every listed event over the
 * wire, which is far too expensive to reach for on an ordinary failure.
 */
export async function fetchEventsPlayMeta(eventIds: string[]): Promise<Record<string, EventPlayMeta>> {
  if (eventIds.length === 0) return {}

  const meta: Record<string, EventPlayMeta> = Object.fromEntries(
    eventIds.map((id) => [id, { counts: { ...EMPTY_COUNTS }, totalScans: 0 }]),
  )

  const { data, error } = await supabase.rpc('get_events_play_meta', { p_event_ids: eventIds })

  if (error) {
    return error.code === FUNCTION_MISSING ? fallbackCounts(eventIds, meta) : meta
  }

  for (const row of (data ?? []) as PlayMetaRow[]) {
    const entry = meta[row.event_id]
    if (!entry) continue
    entry.counts = {
      participants: Number(row.participants) || 0,
      groups: Number(row.groups) || 0,
      tasks: Number(row.tasks) || 0,
      rewards: Number(row.rewards) || 0,
      transactions: Number(row.transactions) || 0,
    }
    entry.totalScans = entry.counts.transactions
  }

  return meta
}

/** Used until migration 086 is applied: count the rows client side, in pages. */
async function fallbackCounts(
  eventIds: string[],
  meta: Record<string, EventPlayMeta>,
): Promise<Record<string, EventPlayMeta>> {
  const perTable = await Promise.all(
    COUNTED.map(({ table }) => countEventIds(table, eventIds)),
  )

  COUNTED.forEach(({ key }, i) => {
    for (const [eventId, count] of perTable[i]) {
      if (meta[eventId]) meta[eventId].counts[key] = count
    }
  })

  for (const entry of Object.values(meta)) {
    entry.totalScans = entry.counts.transactions
  }

  return meta
}

/**
 * How many rows each of `eventIds` has in `table`, paging until the table is
 * exhausted rather than stopping at whatever one response happens to hold.
 * Ordered by `id` so a row lands in exactly one page.
 */
async function countEventIds(table: string, eventIds: string[]): Promise<Map<string, number>> {
  const PAGE = 1000
  const counts = new Map<string, number>()
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('event_id')
      .in('event_id', eventIds)
      .order('id')
      .range(from, from + PAGE - 1)

    if (error) break

    const rows = (data ?? []) as { event_id: string }[]
    if (rows.length === 0) break

    for (const row of rows) {
      counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1)
    }

    // Advance by what actually came back, so a server-side cap below PAGE
    // shrinks the pages instead of cutting the count short.
    from += rows.length
  }

  return counts
}
