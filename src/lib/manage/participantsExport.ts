/**
 * Getting the management screen out of the app as a file.
 *
 * Two shapes, and the difference between them is the whole design:
 *
 *   the table   exactly what is on screen - the same columns, the same rows
 *               after the search and the filters, in the same order. A manager
 *               who filtered to one group and pressed export expects that
 *               group; anything else is a bug, not a feature.
 *
 *   the workbook  everything, on a tab each: participants, every scan, every
 *               award, every lottery, and a summary. Deliberately not what is
 *               on screen - it is the game's whole record, and it says so by
 *               being a different item in the menu.
 *
 * The workbook reads its own data when asked rather than being kept warm by
 * the screen. Most visits never export, and the scan log is the biggest thing
 * this game owns.
 */

import { csvBlob, downloadBlob, xlsxWorkbookBlob, type XlsxSheet } from '@/lib/spreadsheet'
import { supabase } from '@/lib/supabase'
import { isMissingTable } from '@/lib/supabaseErrors'
import { fetchAllRows } from '@/lib/supabasePaging'
import { ELIGIBILITY_LABELS } from '@/components/live-events/lottery/lotteryMode'
import type { LotteryEligibilityMode } from '@/components/live-events/types'
import {
  formatFullMoment,
  participantsGrid,
  totalsOf,
  type ParticipantColumn,
  type ParticipantRow,
} from './participantsReport'

/** Everything a file name should not contain, on any of the three platforms. */
function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'משחק'
}

function todayStamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function fileName(eventName: string, what: string, extension: string): string {
  return `${safeFileName(eventName)}-${what}-${todayStamp()}.${extension}`
}

const SHEET_DEFAULTS = { rightToLeft: true }

/** The table as it stands, as a one-tab workbook. */
export function downloadParticipantsXlsx(
  eventName: string,
  rows: readonly ParticipantRow[],
  columns: readonly ParticipantColumn[],
): void {
  downloadBlob(
    xlsxWorkbookBlob([
      {
        ...SHEET_DEFAULTS,
        sheetName: 'משתתפים',
        columnWidths: columns.map((column) => column.width),
        rows: participantsGrid(rows, columns, true),
      },
    ]),
    fileName(eventName, 'משתתפים', 'xlsx'),
  )
}

/** The same table as a CSV, for the spreadsheet apps that refuse an .xlsx. */
export function downloadParticipantsCsv(
  eventName: string,
  rows: readonly ParticipantRow[],
  columns: readonly ParticipantColumn[],
): void {
  downloadBlob(csvBlob(participantsGrid(rows, columns, true)), fileName(eventName, 'משתתפים', 'csv'))
}

// ---------------------------------------------------------------------------
// The full workbook
// ---------------------------------------------------------------------------

interface ScanExportRow {
  points: number | null
  created_at: string
  /** Set only on an operator-awarded bonus (092), which has no task. */
  bonus_reason?: string | null
  participant: { name: string } | null
  action: { name: string } | null
}

interface AwardExportRow {
  score_at_award: number | null
  awarded_at: string
  participant: { name: string } | null
  reward: { name: string } | null
}

interface LotteryExportRow {
  prize_name: string
  winner_name: string
  eligibility_mode: string
  min_points: number | null
  pool_label: string | null
  entrant_count: number | null
  draw_index: number | null
  drawn_at: string
}

function scansSheet(rows: readonly ScanExportRow[]): XlsxSheet {
  return {
    ...SHEET_DEFAULTS,
    sheetName: 'סריקות',
    columnWidths: [24, 28, 12, 20],
    rows: [
      ['משתתף', 'משימה', 'נקודות', 'מתי'],
      ...rows.map((row) => [
        row.participant?.name ?? 'משתתף שנמחק',
        // A bonus has no task by design; its reason is what earned the points.
        row.bonus_reason
          ? `בונוס · ${row.bonus_reason}`
          : row.action?.name ?? 'משימה שנמחקה',
        String(row.points ?? 0),
        formatFullMoment(row.created_at),
      ]),
    ],
  }
}

function awardsSheet(rows: readonly AwardExportRow[]): XlsxSheet {
  return {
    ...SHEET_DEFAULTS,
    sheetName: 'פרסים',
    columnWidths: [24, 28, 14, 20],
    rows: [
      ['משתתף', 'פרס', 'ניקוד בזכייה', 'מתי'],
      ...rows.map((row) => [
        row.participant?.name ?? 'משתתף שנמחק',
        row.reward?.name ?? 'פרס שנמחק',
        String(row.score_at_award ?? 0),
        formatFullMoment(row.awarded_at),
      ]),
    ],
  }
}

/** How the pool was chosen, in the words the organizer picked it with. */
function poolDescription(row: LotteryExportRow): string {
  const label = ELIGIBILITY_LABELS[row.eligibility_mode as LotteryEligibilityMode] ?? row.eligibility_mode
  if (row.eligibility_mode === 'min_points' && row.min_points != null) {
    return `${label} · ${row.min_points}+`
  }
  return row.pool_label ? `${label} · ${row.pool_label}` : label
}

function lotteriesSheet(rows: readonly LotteryExportRow[]): XlsxSheet {
  return {
    ...SHEET_DEFAULTS,
    sheetName: 'הגרלות',
    columnWidths: [24, 24, 24, 14, 20],
    rows: [
      ['פרס', 'זוכה', 'מי השתתף', 'גודל המאגר', 'מתי'],
      ...rows.map((row) => [
        // A redraw is its own row in the table and its own row here; saying so
        // is the difference between "two winners" and "one winner, redrawn".
        row.draw_index && row.draw_index > 0 ? `${row.prize_name} (הגרלה חוזרת)` : row.prize_name,
        row.winner_name,
        poolDescription(row),
        String(row.entrant_count ?? 0),
        formatFullMoment(row.drawn_at),
      ]),
    ],
  }
}

/**
 * The opening tab: the numbers somebody wants before they read anything, and
 * the same numbers broken down by group.
 *
 * Kept to what the other tabs already contain rather than growing into a
 * report of its own - anything here that is not derivable from them is a
 * number nobody can check.
 */
function summarySheet(eventName: string, rows: readonly ParticipantRow[]): XlsxSheet {
  const totals = totalsOf(rows)
  const groups = new Map<string, { participants: number; played: number; points: number }>()
  for (const row of rows) {
    // Somebody in two groups counts in both; somebody in none counts once, on
    // a line that says so.
    const names = row.groups.length > 0 ? row.groups : ['ללא קבוצה']
    for (const name of names) {
      const entry = groups.get(name) ?? { participants: 0, played: 0, points: 0 }
      entry.participants += 1
      if (row.scans > 0) entry.played += 1
      entry.points += row.points
      groups.set(name, entry)
    }
  }

  const grid: string[][] = [
    ['סיכום', eventName],
    ['הופק בתאריך', formatFullMoment(new Date().toISOString())],
    [],
    ['משתתפים', String(totals.participants)],
    ['שיחקו', String(totals.played)],
    ['סריקות', String(totals.scans)],
    ['נקודות', String(totals.points)],
    ['פרסים שחולקו', String(rows.reduce((sum, row) => sum + row.rewards.length, 0))],
    ['זכיות בהגרלה', String(rows.reduce((sum, row) => sum + row.lotteryWins.length, 0))],
  ]

  if (groups.size > 0) {
    grid.push([], ['קבוצה', 'משתתפים', 'שיחקו', 'נקודות'])
    for (const [name, entry] of [...groups].sort((a, b) => a[0].localeCompare(b[0], 'he'))) {
      grid.push([name, String(entry.participants), String(entry.played), String(entry.points)])
    }
  }

  return { ...SHEET_DEFAULTS, sheetName: 'סיכום', columnWidths: [26, 14, 12, 14], rows: grid }
}

/**
 * The participants tab of the workbook shows the name in halves as well as
 * whole - a file is where a mail merge or a class list gets made, and that is
 * the one place splitting the name earns its column. The screen keeps showing
 * one name, because that is what the rest of the app shows.
 */
function participantsSheet(
  rows: readonly ParticipantRow[],
  columns: readonly ParticipantColumn[],
): XlsxSheet {
  const split = rows.some((row) => row.lastName !== '')
  const grid = participantsGrid(rows, columns, true)
  if (!split) {
    return {
      ...SHEET_DEFAULTS,
      sheetName: 'משתתפים',
      columnWidths: columns.map((column) => column.width),
      rows: grid,
    }
  }

  const nameAt = columns.findIndex((column) => column.id === 'name')
  const insert = <T,>(row: T[], values: T[]) =>
    nameAt < 0 ? [...row, ...values] : [...row.slice(0, nameAt + 1), ...values, ...row.slice(nameAt + 1)]

  return {
    ...SHEET_DEFAULTS,
    sheetName: 'משתתפים',
    columnWidths: insert(columns.map((column) => column.width), [18, 18]),
    rows: [
      insert(grid[0], ['שם פרטי', 'שם משפחה']),
      ...rows.map((row, i) => insert(grid[i + 1], [row.firstName, row.lastName])),
    ],
  }
}

export type WorkbookResult = { ok: true } | { ok: false; error: string }

/**
 * The whole game as one workbook.
 *
 * `rows` are the participants the screen already holds - all of them, not the
 * filtered view - so the participants tab needs no second read.
 */
export async function downloadFullWorkbook(
  eventId: string,
  eventName: string,
  rows: readonly ParticipantRow[],
  columns: readonly ParticipantColumn[],
): Promise<WorkbookResult> {
  const [scans, awards, lotteries] = await Promise.all([
    fetchAllRows<ScanExportRow>((from, to) =>
      supabase
        .from('point_transactions')
        // `*` so bonus_reason (092) comes back where the database has it, and
        // its absence does not take the whole export down.
        .select('*, participant:participants(name), action:actions(name)')
        .eq('event_id', eventId)
        .order('created_at')
        .range(from, to),
    ),
    fetchAllRows<AwardExportRow>((from, to) =>
      supabase
        .from('participant_rewards')
        .select('score_at_award, awarded_at, participant:participants(name), reward:rewards(name)')
        .eq('event_id', eventId)
        .order('awarded_at')
        .range(from, to),
    ),
    fetchAllRows<LotteryExportRow>((from, to) =>
      supabase
        .from('lottery_draws')
        .select(
          'prize_name, winner_name, eligibility_mode, min_points, pool_label, entrant_count, draw_index, drawn_at',
        )
        .eq('event_id', eventId)
        .order('drawn_at')
        .range(from, to),
    ),
  ])

  const lotteryMissing = lotteries.error != null && isMissingTable(lotteries.error, 'lottery_draws')

  if (scans.error || awards.error || (lotteries.error && !lotteryMissing)) {
    return { ok: false, error: 'הכנת הקובץ נכשלה. נסו שוב.' }
  }

  const sheets: XlsxSheet[] = [
    summarySheet(eventName, rows),
    participantsSheet(rows, columns),
    scansSheet(scans.rows),
    awardsSheet(awards.rows),
  ]
  // A game that never ran a lottery gets no lottery tab, for the same reason an
  // empty column is not shown: an empty tab is a question, not an answer.
  if (lotteries.rows.length > 0) sheets.push(lotteriesSheet(lotteries.rows))

  downloadBlob(xlsxWorkbookBlob(sheets), fileName(eventName, 'נתונים', 'xlsx'))
  return { ok: true }
}
