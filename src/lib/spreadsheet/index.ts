/** Reading and writing the spreadsheet files used by the roster import. */

import { CSV_BOM, parseDelimited, toCsv } from './csv'
import { buildXlsx, readXlsx, type XlsxSheetOptions } from './xlsx'

export { CSV_BOM, parseDelimited, toCsv } from './csv'
export { buildXlsx, readXlsx } from './xlsx'

/** `accept` attribute for the upload input. */
export const SPREADSHEET_ACCEPT = '.xlsx,.csv,.txt,.tsv'

/** Guard against a huge file locking up the tab - a roster is a few KB. */
export const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024

export type SpreadsheetErrorCode =
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'UNREADABLE_FILE'
  | 'LEGACY_XLS'

export class SpreadsheetError extends Error {
  code: SpreadsheetErrorCode
  constructor(code: SpreadsheetErrorCode) {
    super(code)
    this.name = 'SpreadsheetError'
    this.code = code
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Reads a user-supplied .xlsx / .csv / .tsv file into a grid of text values. */
export async function readSpreadsheetFile(file: File): Promise<string[][]> {
  if (file.size > MAX_SPREADSHEET_BYTES) throw new SpreadsheetError('FILE_TOO_LARGE')

  const extension = extensionOf(file.name)

  // Excel 97-2003 is a completely different (OLE2) container - no way to read it.
  if (extension === 'xls') throw new SpreadsheetError('LEGACY_XLS')

  if (extension === 'xlsx' || extension === 'xlsm') {
    try {
      return await readXlsx(new Uint8Array(await file.arrayBuffer()))
    } catch {
      throw new SpreadsheetError('UNREADABLE_FILE')
    }
  }

  if (extension === 'csv' || extension === 'txt' || extension === 'tsv' || extension === '') {
    try {
      return parseDelimited(await file.text())
    } catch {
      throw new SpreadsheetError('UNREADABLE_FILE')
    }
  }

  throw new SpreadsheetError('UNSUPPORTED_FORMAT')
}

/** Builds a downloadable .xlsx blob. */
export function xlsxBlob(rows: string[][], options?: XlsxSheetOptions): Blob {
  return new Blob([buildXlsx(rows, options) as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Builds a downloadable CSV blob, BOM-prefixed so Excel reads it as UTF-8. */
export function csvBlob(rows: string[][]): Blob {
  return new Blob([CSV_BOM + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
}

/** Triggers a browser download for a generated file. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke on the next tick - Safari cancels the download if it happens sooner.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
