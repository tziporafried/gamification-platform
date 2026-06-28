import { differenceInMinutes, isPast, isFuture } from 'date-fns'
import type { Action } from '@/types'

export type MissionStatus = 'upcoming' | 'active' | 'ending' | 'available' | 'ended'

const MISSION_STATUS_ORDER: Record<MissionStatus, number> = {
  active: 0, ending: 1, upcoming: 2, available: 3, ended: 99,
}

export function computeRanks<T extends { total_points: number }>(entries: T[]): (T & { rank: number })[] {
  let r = 1
  return entries.map((e, i) => {
    if (i > 0 && e.total_points < entries[i - 1].total_points) r = i + 1
    return { ...e, rank: r }
  })
}

export function getMissionStatus(action: Action): MissionStatus {
  if (!action.time_enabled || !action.start_at) return 'available'
  const now = new Date()
  const start = new Date(action.start_at)
  const end = action.end_at ? new Date(action.end_at) : null
  if (isFuture(start)) return 'upcoming'
  if (end && isPast(end)) return 'ended'
  if (end && differenceInMinutes(end, now) <= 20) return 'ending'
  return 'active'
}

export function getMinutesLeft(action: Action): number | null {
  const now = new Date()
  if (action.end_at) {
    const m = differenceInMinutes(new Date(action.end_at), now)
    return m >= 0 ? m : null
  }
  if (action.start_at && isFuture(new Date(action.start_at)))
    return differenceInMinutes(new Date(action.start_at), now)
  return null
}

export function getSecondsLeft(action: Action, now: Date): number | null {
  if (action.end_at) {
    const diff = Math.floor((new Date(action.end_at).getTime() - now.getTime()) / 1000)
    return diff >= 0 ? diff : null
  }
  if (action.start_at && new Date(action.start_at) > now) {
    return Math.floor((new Date(action.start_at).getTime() - now.getTime()) / 1000)
  }
  return null
}

export function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function sortMissionsByUrgency(actions: Action[]): Action[] {
  return [...actions]
    .filter(a => getMissionStatus(a) !== 'ended')
    .sort((a, b) => MISSION_STATUS_ORDER[getMissionStatus(a)] - MISSION_STATUS_ORDER[getMissionStatus(b)])
}
