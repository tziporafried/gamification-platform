/**
 * Turns an uploaded spreadsheet into a reviewable import plan.
 *
 * The roster file is one row per participant: their name, and optionally the
 * group they belong to. That single shape serves both wizard steps - the
 * participants step creates the groups named in the file, and the groups step
 * creates the participants listed alongside them.
 *
 * A game with the `sms_notifications` flag adds a third column, the phone
 * number, normalised on the way in (src/lib/phone.ts). Without the flag the
 * column is not read at all, so a file that happens to carry one imports
 * exactly as it always did.
 */

import { parsePhone } from '@/lib/phone'

export const NAME_COLUMN_HEADER = 'שם המשתתף'
export const GROUP_COLUMN_HEADER = 'קבוצה'
export const PHONE_COLUMN_HEADER = 'טלפון'

/** Header spellings accepted on upload, so a translated or renamed file still maps. */
const NAME_HEADERS = ['שם המשתתף', 'שם משתתף', 'שם', 'שם מלא', 'משתתף', 'name', 'full name', 'participant', 'participant name']
const GROUP_HEADERS = ['קבוצה', 'שם הקבוצה', 'קבוצות', 'צוות', 'כיתה', 'group', 'group name', 'team', 'class']
const PHONE_HEADERS = ['טלפון', 'מספר טלפון', 'טלפון נייד', 'נייד', 'סלולרי', 'phone', 'phone number', 'mobile', 'mobile number', 'cell', 'cellphone']

/** Refuse absurd files rather than freezing the tab or the import RPC. */
export const MAX_IMPORT_ROWS = 2000
const MAX_NAME_LENGTH = 80

export interface RosterEntry {
  name: string
  /** Group name from the file; empty means "no group stated". */
  group: string
  /**
   * Phone in E.164, or empty when the file had none, it could not be read, or
   * the game does not collect phones at all.
   */
  phone: string
}

export interface RosterPlan {
  /** Participants to create, in file order. */
  entries: RosterEntry[]
  /** Group names in the file that do not exist in the event yet. */
  newGroups: string[]
  /** Group names in the file that already exist in the event. */
  existingGroups: string[]
  /** Rows naming a group but no participant - the group is still created. */
  groupOnlyRows: number
  /** Rows dropped because the same name appeared earlier in the file. */
  duplicateRows: number
  /** Rows dropped because a participant with that name already exists. */
  alreadyInEventRows: number
  /** Rows dropped because the name was too long to be a real name. */
  invalidRows: number
  /**
   * Participants who will be created without a usable phone number, when the
   * game collects them. They are imported anyway - a name is still the roster,
   * and losing people over a mistyped cell is the worse failure - but the
   * preview says how many, because those are the ones no SMS will reach.
   */
  missingPhoneRows: number
  /** Data rows read from the file, excluding blank rows and the header. */
  totalRows: number
  /** True when the file had a recognised header row. */
  hasHeader: boolean
  /** Non-fatal problem to show above the preview. */
  error: RosterPlanError | null
}

export type RosterPlanError = 'EMPTY_FILE' | 'NO_NAMES' | 'TOO_MANY_ROWS'

function normalize(value: string): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

/** Case/whitespace-insensitive key for matching names against each other. */
export function nameKey(value: string): string {
  return normalize(value).toLowerCase()
}

function headerIndex(row: string[], headers: string[]): number {
  return row.findIndex((cell) => headers.includes(nameKey(cell)))
}

interface ColumnLayout {
  nameColumn: number
  groupColumn: number
  /** -1 when the game does not collect phones. */
  phoneColumn: number
  hasHeader: boolean
}

/**
 * Locates the columns. A recognised header row maps them by label; a column the
 * header does not name falls to the first position nobody else claimed, which
 * for the template is where it already sits. Beyond the file's last column it
 * simply reads as empty, so a two-column file is not made to invent a third.
 */
function resolveColumns(grid: string[][], collectPhones: boolean): ColumnLayout {
  const first = grid[0] ?? []
  const namedName = headerIndex(first, NAME_HEADERS)
  const namedGroup = headerIndex(first, GROUP_HEADERS)
  const namedPhone = collectPhones ? headerIndex(first, PHONE_HEADERS) : -1

  if (namedName >= 0 || namedGroup >= 0 || namedPhone >= 0) {
    const taken = new Set([namedName, namedGroup, namedPhone].filter((index) => index >= 0))
    const nextFree = () => {
      let index = 0
      while (taken.has(index)) index++
      taken.add(index)
      return index
    }
    return {
      nameColumn: namedName >= 0 ? namedName : nextFree(),
      groupColumn: namedGroup >= 0 ? namedGroup : nextFree(),
      phoneColumn: collectPhones ? (namedPhone >= 0 ? namedPhone : nextFree()) : -1,
      hasHeader: true,
    }
  }

  if (!collectPhones) return { nameColumn: 0, groupColumn: 1, phoneColumn: -1, hasHeader: false }

  // No header, and one of the two columns after the name holds phone numbers.
  // Worth reading them rather than trusting the template order: a phone column
  // mistaken for the group column would create a group per participant.
  const phoneColumn = looksLikePhones(grid, 2) ? 2 : looksLikePhones(grid, 1) ? 1 : 2
  return { nameColumn: 0, groupColumn: phoneColumn === 1 ? 2 : 1, phoneColumn, hasHeader: false }
}

/** A column is phone numbers when the cells that have anything in them parse as one. */
function looksLikePhones(grid: string[][], column: number): boolean {
  const filled = grid.map((row) => normalize(row[column] ?? '')).filter((cell) => cell !== '')
  if (filled.length === 0) return false
  return filled.every((cell) => parsePhone(cell).e164 !== null)
}

export interface ExistingRoster {
  participantNames: string[]
  groupNames: string[]
}

export interface RosterPlanOptions {
  /** The game has the `sms_notifications` flag, so the file carries phones. */
  collectPhones?: boolean
}

/** Reads a parsed spreadsheet grid into a plan the user can confirm. */
export function planRosterImport(
  grid: string[][],
  existing: ExistingRoster,
  options: RosterPlanOptions = {},
): RosterPlan {
  const collectPhones = options.collectPhones === true
  const empty: RosterPlan = {
    entries: [],
    newGroups: [],
    existingGroups: [],
    groupOnlyRows: 0,
    duplicateRows: 0,
    alreadyInEventRows: 0,
    invalidRows: 0,
    missingPhoneRows: 0,
    totalRows: 0,
    hasHeader: false,
    error: null,
  }

  const { nameColumn, groupColumn, phoneColumn, hasHeader } = resolveColumns(grid, collectPhones)
  const dataRows = (hasHeader ? grid.slice(1) : grid)
    .map((row) => ({
      name: normalize(row[nameColumn] ?? ''),
      group: normalize(row[groupColumn] ?? ''),
      // An unreadable number is dropped rather than stored as typed: half a
      // number in the column reads as done, and is found out at send time.
      phone: phoneColumn < 0 ? '' : parsePhone(row[phoneColumn] ?? '').e164 ?? '',
    }))
    .filter((row) => row.name !== '' || row.group !== '')

  if (dataRows.length === 0) return { ...empty, hasHeader, error: 'EMPTY_FILE' }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return { ...empty, hasHeader, totalRows: dataRows.length, error: 'TOO_MANY_ROWS' }
  }

  const existingParticipants = new Set(existing.participantNames.map(nameKey))
  const existingGroupsByKey = new Map(existing.groupNames.map((name) => [nameKey(name), name]))

  const entries: RosterEntry[] = []
  const seenNames = new Set<string>()
  const seenGroupKeys = new Set<string>()
  const newGroups: string[] = []
  const existingGroups: string[] = []

  let groupOnlyRows = 0
  let duplicateRows = 0
  let alreadyInEventRows = 0
  let invalidRows = 0
  let missingPhoneRows = 0

  for (const row of dataRows) {
    if (row.group !== '') {
      const key = nameKey(row.group)
      if (!seenGroupKeys.has(key)) {
        seenGroupKeys.add(key)
        const match = existingGroupsByKey.get(key)
        if (match) existingGroups.push(match)
        else newGroups.push(row.group)
      }
    }

    if (row.name === '') {
      groupOnlyRows++
      continue
    }
    if (row.name.length > MAX_NAME_LENGTH) {
      invalidRows++
      continue
    }

    const key = nameKey(row.name)
    if (seenNames.has(key)) {
      duplicateRows++
      continue
    }
    if (existingParticipants.has(key)) {
      seenNames.add(key)
      alreadyInEventRows++
      continue
    }

    seenNames.add(key)
    // Group names are re-emitted as stored, so a spelling variant in the file
    // maps onto the existing group instead of creating a near-duplicate.
    const groupMatch = row.group === '' ? '' : existingGroupsByKey.get(nameKey(row.group)) ?? row.group
    if (collectPhones && row.phone === '') missingPhoneRows++
    entries.push({ name: row.name, group: groupMatch, phone: row.phone })
  }

  return {
    entries,
    newGroups,
    existingGroups,
    groupOnlyRows,
    duplicateRows,
    alreadyInEventRows,
    invalidRows,
    missingPhoneRows,
    totalRows: dataRows.length,
    hasHeader,
    error: entries.length === 0 && newGroups.length === 0 ? 'NO_NAMES' : null,
  }
}

/** Rows skipped for any reason - shown as one number in the preview. */
export function skippedRowCount(plan: RosterPlan): number {
  return plan.duplicateRows + plan.alreadyInEventRows + plan.invalidRows
}

export function planHasWork(plan: RosterPlan): boolean {
  return plan.entries.length > 0 || plan.newGroups.length > 0
}
