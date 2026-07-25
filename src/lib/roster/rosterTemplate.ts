/** The sample roster file the user downloads, fills in and uploads back. */

import { csvBlob, downloadBlob, xlsxBlob } from '@/lib/spreadsheet'
import { GROUP_COLUMN_HEADER, NAME_COLUMN_HEADER } from './rosterPlan'

export const TEMPLATE_FILENAME = 'רשימת-משתתפים.xlsx'
export const TEMPLATE_CSV_FILENAME = 'רשימת-משתתפים.csv'

/** Example rows - the modal tells the user to replace them with their own. */
const SAMPLE_ROWS: string[][] = [
  ['ישראל ישראלי', 'קבוצה א'],
  ['דנה כהן', 'קבוצה א'],
  ['יוסי לוי', 'קבוצה ב'],
  ['מיכל אברהם', 'קבוצה ב'],
]

export function rosterTemplateRows(includeGroupColumn = true): string[][] {
  const header = includeGroupColumn ? [NAME_COLUMN_HEADER, GROUP_COLUMN_HEADER] : [NAME_COLUMN_HEADER]
  return [header, ...SAMPLE_ROWS.map((row) => (includeGroupColumn ? row : [row[0]]))]
}

export function downloadRosterTemplate(includeGroupColumn = true): void {
  const blob = xlsxBlob(rosterTemplateRows(includeGroupColumn), {
    sheetName: 'משתתפים',
    rightToLeft: true,
    columnWidths: includeGroupColumn ? [28, 20] : [28],
  })
  downloadBlob(blob, TEMPLATE_FILENAME)
}

/** Same table as a CSV, for spreadsheet apps that refuse the .xlsx. */
export function downloadRosterTemplateCsv(includeGroupColumn = true): void {
  downloadBlob(csvBlob(rosterTemplateRows(includeGroupColumn)), TEMPLATE_CSV_FILENAME)
}
