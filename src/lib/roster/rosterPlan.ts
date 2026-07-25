/**
 * Turns an uploaded spreadsheet into a reviewable import plan.
 *
 * The roster file is one row per participant: their name, and optionally the
 * group they belong to. That single shape serves both wizard steps - the
 * participants step creates the groups named in the file, and the groups step
 * creates the participants listed alongside them.
 */

export const NAME_COLUMN_HEADER = 'שם המשתתף'
export const GROUP_COLUMN_HEADER = 'קבוצה'

/** Header spellings accepted on upload, so a translated or renamed file still maps. */
const NAME_HEADERS = ['שם המשתתף', 'שם משתתף', 'שם', 'שם מלא', 'משתתף', 'name', 'full name', 'participant', 'participant name']
const GROUP_HEADERS = ['קבוצה', 'שם הקבוצה', 'קבוצות', 'צוות', 'כיתה', 'group', 'group name', 'team', 'class']

/** Refuse absurd files rather than freezing the tab or the import RPC. */
export const MAX_IMPORT_ROWS = 2000
const MAX_NAME_LENGTH = 80

export interface RosterEntry {
  name: string
  /** Group name from the file; empty means "no group stated". */
  group: string
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
  hasHeader: boolean
}

/**
 * Locates the name and group columns. A recognised header row maps them by
 * label; otherwise the first two columns are assumed, matching the template.
 */
function resolveColumns(grid: string[][]): ColumnLayout {
  const first = grid[0] ?? []
  const nameColumn = headerIndex(first, NAME_HEADERS)
  const groupColumn = headerIndex(first, GROUP_HEADERS)

  if (nameColumn >= 0 || groupColumn >= 0) {
    return {
      nameColumn: nameColumn >= 0 ? nameColumn : groupColumn === 0 ? 1 : 0,
      groupColumn: groupColumn >= 0 ? groupColumn : nameColumn === 0 ? 1 : 0,
      hasHeader: true,
    }
  }

  return { nameColumn: 0, groupColumn: 1, hasHeader: false }
}

export interface ExistingRoster {
  participantNames: string[]
  groupNames: string[]
}

/** Reads a parsed spreadsheet grid into a plan the user can confirm. */
export function planRosterImport(grid: string[][], existing: ExistingRoster): RosterPlan {
  const empty: RosterPlan = {
    entries: [],
    newGroups: [],
    existingGroups: [],
    groupOnlyRows: 0,
    duplicateRows: 0,
    alreadyInEventRows: 0,
    invalidRows: 0,
    totalRows: 0,
    hasHeader: false,
    error: null,
  }

  const { nameColumn, groupColumn, hasHeader } = resolveColumns(grid)
  const dataRows = (hasHeader ? grid.slice(1) : grid)
    .map((row) => ({
      name: normalize(row[nameColumn] ?? ''),
      group: normalize(row[groupColumn] ?? ''),
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
    entries.push({ name: row.name, group: groupMatch })
  }

  return {
    entries,
    newGroups,
    existingGroups,
    groupOnlyRows,
    duplicateRows,
    alreadyInEventRows,
    invalidRows,
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
