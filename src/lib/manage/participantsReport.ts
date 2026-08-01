/**
 * The participants table behind the advanced management screen: one row per
 * participant with everything the game knows about them, and the rules for
 * searching, filtering, sorting and exporting it.
 *
 * Everything here is pure and takes its rows as an argument - the reading is
 * done by useEventParticipantsReport. The screen and the export share these
 * functions on purpose: a file that disagrees with the table it was downloaded
 * from is a bug report waiting to happen.
 */

import {
  formatTimeOfDay,
  getIsraelHour,
  getIsraelLocalDateString,
  getIsraelMinute,
} from '@/lib/israelTime'

/** One participant, with their whole history flattened onto them. */
export interface ParticipantRow {
  id: string
  /** The display name, as the rest of the app shows it. */
  name: string
  /** '' on a database where migration 083 has not run. */
  firstName: string
  lastName: string
  groups: string[]
  phone: string
  points: number
  scans: number
  /** ISO timestamp of the most recent scan, or null for someone who never played. */
  lastScanAt: string | null
  rewards: string[]
  /** Prizes this participant's name came out of the hat for. */
  lotteryWins: string[]
  /** Trivia questions answered, and how many of those were right. Both 0 in a
   *  game with no questions, which is what hides the column entirely. */
  triviaAttempts: number
  triviaCorrect: number
  createdAt: string
  /** Place by points, ties sharing a place. 0 for a participant with no points. */
  rank: number
}

export type ParticipantColumnId =
  | 'rank'
  | 'name'
  | 'groups'
  | 'phone'
  | 'points'
  | 'scans'
  | 'lastScan'
  | 'rewards'
  | 'lotteryWins'
  | 'triviaCorrect'
  | 'createdAt'

export type SortDirection = 'asc' | 'desc'

export interface ParticipantSort {
  column: ParticipantColumnId
  direction: SortDirection
}

export interface ParticipantColumn {
  id: ParticipantColumnId
  label: string
  /** The cell, as text. What the table renders and what a CSV writes. */
  text: (row: ParticipantRow) => string
  /**
   * The cell in an exported file, when that wants to say more than the screen.
   * A screen can write "14:32" because the reader knows it is today; a file
   * opened next month cannot.
   */
  exportText?: (row: ParticipantRow) => string
  /** Sort key. Numbers sort numerically, strings by Hebrew collation. */
  value: (row: ParticipantRow) => string | number
  align?: 'start' | 'end'
  /** Rendered bold - the two numbers the screen exists to show. */
  emphasis?: boolean
  /** Column width in an exported sheet, in characters. */
  width: number
  /** Which way the first click on the header sorts. */
  firstClick: SortDirection
  /**
   * Columns that stay even when every cell is empty, because their emptiness
   * is itself the answer: a game where nobody has scored still has a points
   * column reading zero.
   */
  always?: boolean
}

/** "12.7 · 14:32", or just the time for something that happened today. */
export function formatMoment(iso: string | null, todayKey: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const time = formatTimeOfDay(getIsraelHour(date), getIsraelMinute(date))
  const dayKey = getIsraelLocalDateString(date)
  if (dayKey === todayKey) return time
  const [, month, day] = dayKey.split('-')
  return `${Number(day)}.${Number(month)} · ${time}`
}

/** "12.07.2026 14:32" - a timestamp that still reads right out of context. */
export function formatFullMoment(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const [year, month, day] = getIsraelLocalDateString(date).split('-')
  return `${day}.${month}.${year} ${formatTimeOfDay(getIsraelHour(date), getIsraelMinute(date))}`
}

/** "12.07.2026" - for a date where the time adds nothing. */
export function formatDay(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const [year, month, day] = getIsraelLocalDateString(date).split('-')
  return `${day}.${month}.${year}`
}

const number = (n: number) => n.toLocaleString('he-IL')

/**
 * Every column the table can show, in the order it shows them.
 *
 * `todayKey` is passed in rather than read from the clock so a table rendered
 * either side of midnight does not disagree with itself.
 */
export function participantColumns(todayKey: string): ParticipantColumn[] {
  return [
    {
      id: 'rank',
      label: 'מקום',
      text: (r) => (r.rank > 0 ? String(r.rank) : ''),
      // Unplaced is empty, not a very large number - so it sinks to the bottom
      // whichever way the column is pointed, like every other blank cell.
      value: (r) => (r.rank > 0 ? r.rank : ''),
      align: 'end',
      width: 8,
      firstClick: 'asc',
      always: true,
    },
    {
      id: 'name',
      label: 'שם',
      text: (r) => r.name,
      value: (r) => r.name,
      emphasis: true,
      width: 24,
      firstClick: 'asc',
      always: true,
    },
    {
      id: 'groups',
      label: 'קבוצה',
      text: (r) => r.groups.join(' · '),
      value: (r) => r.groups.join(' '),
      width: 18,
      firstClick: 'asc',
    },
    {
      id: 'phone',
      label: 'טלפון',
      text: (r) => r.phone,
      value: (r) => r.phone,
      width: 16,
      firstClick: 'asc',
    },
    {
      id: 'points',
      label: 'נקודות',
      text: (r) => number(r.points),
      value: (r) => r.points,
      align: 'end',
      emphasis: true,
      width: 12,
      firstClick: 'desc',
      always: true,
    },
    {
      id: 'scans',
      label: 'סריקות',
      text: (r) => number(r.scans),
      value: (r) => r.scans,
      align: 'end',
      width: 10,
      firstClick: 'desc',
      always: true,
    },
    {
      id: 'lastScan',
      label: 'סריקה אחרונה',
      text: (r) => formatMoment(r.lastScanAt, todayKey),
      exportText: (r) => formatFullMoment(r.lastScanAt),
      // Never played sorts last however the column is pointed - "no scan" is
      // not an early time, it is the absence of one.
      value: (r) => r.lastScanAt ?? '',
      align: 'end',
      width: 18,
      firstClick: 'desc',
    },
    {
      id: 'rewards',
      label: 'פרסים',
      text: (r) => r.rewards.join(' · '),
      value: (r) => r.rewards.length,
      width: 26,
      firstClick: 'desc',
    },
    {
      id: 'lotteryWins',
      label: 'זכיות בהגרלה',
      text: (r) => r.lotteryWins.join(' · '),
      value: (r) => r.lotteryWins.length,
      width: 22,
      firstClick: 'desc',
    },
    {
      id: 'triviaCorrect',
      label: 'תשובות נכונות',
      // Empty rather than "0/0" for somebody who answered nothing, so a game
      // without questions drops the column instead of printing a wall of
      // zeroes - see visibleColumns below.
      text: (r) => (r.triviaAttempts > 0 ? `${number(r.triviaCorrect)}/${number(r.triviaAttempts)}` : ''),
      value: (r) => r.triviaCorrect,
      align: 'end',
      width: 14,
      firstClick: 'desc',
    },
    {
      id: 'createdAt',
      label: 'נוסף בתאריך',
      text: (r) => formatDay(r.createdAt),
      value: (r) => r.createdAt,
      align: 'end',
      width: 14,
      firstClick: 'desc',
    },
  ]
}

/**
 * The columns worth showing for these participants.
 *
 * A game that never collected phone numbers should not be handed a column of
 * dashes to scroll past, and neither should its export. This is also why
 * nothing here asks about other feature flags: whether the game was sold SMS
 * is a worse question than whether a single phone number exists.
 */
export function visibleColumns(
  columns: readonly ParticipantColumn[],
  rows: readonly ParticipantRow[],
): ParticipantColumn[] {
  return columns.filter((column) => column.always || rows.some((row) => column.text(row) !== ''))
}

export type ParticipantStatus = 'all' | 'played' | 'not_played' | 'rewarded' | 'lottery_won'

export const STATUS_LABELS: Record<ParticipantStatus, string> = {
  all: 'כל המשתתפים',
  played: 'שיחקו',
  not_played: 'לא שיחקו',
  rewarded: 'זכו בפרס',
  lottery_won: 'זכו בהגרלה',
}

/** The value the group filter takes for "everyone without a group". */
export const NO_GROUP = ' none'

export interface ParticipantFilters {
  query: string
  /** A group name, NO_GROUP, or '' for every group. */
  group: string
  status: ParticipantStatus
}

export const EMPTY_FILTERS: ParticipantFilters = { query: '', group: '', status: 'all' }

export function hasActiveFilters(filters: ParticipantFilters): boolean {
  return filters.query.trim() !== '' || filters.group !== '' || filters.status !== 'all'
}

function matchesQuery(row: ParticipantRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    row.name.toLowerCase().includes(q) ||
    row.phone.toLowerCase().includes(q) ||
    row.groups.some((group) => group.toLowerCase().includes(q))
  )
}

function matchesStatus(row: ParticipantRow, status: ParticipantStatus): boolean {
  switch (status) {
    case 'played':
      return row.scans > 0
    case 'not_played':
      return row.scans === 0
    case 'rewarded':
      return row.rewards.length > 0
    case 'lottery_won':
      return row.lotteryWins.length > 0
    default:
      return true
  }
}

function matchesGroup(row: ParticipantRow, group: string): boolean {
  if (!group) return true
  if (group === NO_GROUP) return row.groups.length === 0
  return row.groups.includes(group)
}

export function filterParticipants(
  rows: readonly ParticipantRow[],
  filters: ParticipantFilters,
): ParticipantRow[] {
  return rows.filter(
    (row) =>
      matchesQuery(row, filters.query) &&
      matchesGroup(row, filters.group) &&
      matchesStatus(row, filters.status),
  )
}

/**
 * Sorts by one column, name breaking every tie.
 *
 * An empty cell always sinks to the bottom, whichever way the column points:
 * flipping "last scan" to ascending should bring the earliest scan up, not the
 * hundred people who never scanned at all.
 */
export function sortParticipants(
  rows: readonly ParticipantRow[],
  sort: ParticipantSort,
  columns: readonly ParticipantColumn[],
): ParticipantRow[] {
  const column = columns.find((c) => c.id === sort.column)
  if (!column) return [...rows]
  const flip = sort.direction === 'asc' ? 1 : -1

  return [...rows].sort((a, b) => {
    const left = column.value(a)
    const right = column.value(b)

    const leftEmpty = left === '' || left === 0
    const rightEmpty = right === '' || right === 0
    if (leftEmpty !== rightEmpty) return leftEmpty ? 1 : -1

    if (typeof left === 'number' && typeof right === 'number') {
      if (left !== right) return (left - right) * flip
    } else {
      const compared = String(left).localeCompare(String(right), 'he')
      if (compared !== 0) return compared * flip
    }
    return a.name.localeCompare(b.name, 'he')
  })
}

export interface ParticipantTotals {
  participants: number
  played: number
  scans: number
  points: number
}

export function totalsOf(rows: readonly ParticipantRow[]): ParticipantTotals {
  const totals: ParticipantTotals = { participants: rows.length, played: 0, scans: 0, points: 0 }
  for (const row of rows) {
    if (row.scans > 0) totals.played += 1
    totals.scans += row.scans
    totals.points += row.points
  }
  return totals
}

/** Every group name in the game, for the filter, in Hebrew order. */
export function groupNames(rows: readonly ParticipantRow[]): string[] {
  const names = new Set<string>()
  for (const row of rows) for (const group of row.groups) names.add(group)
  return [...names].sort((a, b) => a.localeCompare(b, 'he'))
}

/**
 * Places by points, ties sharing one - two people on 340 are both second, and
 * the next is fourth. Somebody who has not scored has no place at all rather
 * than sharing last with everyone else who has not started.
 */
export function withRanks(rows: readonly Omit<ParticipantRow, 'rank'>[]): ParticipantRow[] {
  const byPoints = [...rows].sort((a, b) => b.points - a.points)
  const ranks = new Map<string, number>()
  let place = 0
  let previous: number | null = null

  byPoints.forEach((row, index) => {
    if (row.points <= 0) return
    if (row.points !== previous) {
      place = index + 1
      previous = row.points
    }
    ranks.set(row.id, place)
  })

  return rows.map((row) => ({ ...row, rank: ranks.get(row.id) ?? 0 }))
}

/** The table as a grid of text: header row, then one row per participant. */
export function participantsGrid(
  rows: readonly ParticipantRow[],
  columns: readonly ParticipantColumn[],
  forExport = false,
): string[][] {
  return [
    columns.map((column) => column.label),
    ...rows.map((row) =>
      columns.map((column) => (forExport && column.exportText ? column.exportText(row) : column.text(row))),
    ),
  ]
}
