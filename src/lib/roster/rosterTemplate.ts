/** The sample roster file the user downloads, fills in and uploads back. */

import { csvBlob, downloadBlob, xlsxBlob } from '@/lib/spreadsheet'
import { GROUP_COLUMN_HEADER, NAME_COLUMN_HEADER, PHONE_COLUMN_HEADER } from './rosterPlan'

export const TEMPLATE_FILENAME = 'רשימת-משתתפים.xlsx'
export const TEMPLATE_CSV_FILENAME = 'רשימת-משתתפים.csv'

export interface RosterTemplateOptions {
  includeGroupColumn?: boolean
  /** The game has `sms_notifications`, so the file asks for a phone too. */
  includePhoneColumn?: boolean
}

/**
 * Example rows - the modal tells the user to replace them with their own. The
 * phones are written the way a person writes one, not in E.164: the import
 * normalises, and a template full of `+972…` would teach the wrong lesson.
 */
const SAMPLE_ROWS: string[][] = [
  ['ישראל ישראלי', 'קבוצה א', '050-1234567'],
  ['דנה כהן', 'קבוצה א', '052-7654321'],
  ['יוסי לוי', 'קבוצה ב', '054-9876543'],
  ['מיכל אברהם', 'קבוצה ב', '053-1122334'],
]

const NAME = 0
const GROUP = 1
const PHONE = 2

function columns({ includeGroupColumn = true, includePhoneColumn = false }: RosterTemplateOptions): number[] {
  const picked = [NAME]
  if (includeGroupColumn) picked.push(GROUP)
  if (includePhoneColumn) picked.push(PHONE)
  return picked
}

export function rosterTemplateRows(options: RosterTemplateOptions = {}): string[][] {
  const headers = [NAME_COLUMN_HEADER, GROUP_COLUMN_HEADER, PHONE_COLUMN_HEADER]
  const picked = columns(options)
  return [
    picked.map((index) => headers[index]),
    ...SAMPLE_ROWS.map((row) => picked.map((index) => row[index])),
  ]
}

export function downloadRosterTemplate(options: RosterTemplateOptions = {}): void {
  const widths = [28, 20, 18]
  const blob = xlsxBlob(rosterTemplateRows(options), {
    sheetName: 'משתתפים',
    rightToLeft: true,
    columnWidths: columns(options).map((index) => widths[index]),
  })
  downloadBlob(blob, TEMPLATE_FILENAME)
}

/** Same table as a CSV, for spreadsheet apps that refuse the .xlsx. */
export function downloadRosterTemplateCsv(options: RosterTemplateOptions = {}): void {
  downloadBlob(csvBlob(rosterTemplateRows(options)), TEMPLATE_CSV_FILENAME)
}
