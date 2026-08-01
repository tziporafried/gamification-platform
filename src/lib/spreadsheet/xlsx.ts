/**
 * Minimal .xlsx (SpreadsheetML) reader and writer.
 *
 * Only the sliver this app needs: sheets of text cells. Values are written as
 * inline strings, and reading resolves shared strings so files saved by Excel,
 * Google Sheets or LibreOffice all come back as plain text.
 *
 * Writing takes a list of sheets; the roster template happens to pass one and
 * the management export passes five. Reading still returns the first sheet
 * only - the import asks a file for a roster, not for a workbook.
 */

import { createZip, readZip, type ZipEntry } from './zip'

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

export interface XlsxSheetOptions {
  sheetName?: string
  /** Renders the sheet right-to-left when opened, for Hebrew content. */
  rightToLeft?: boolean
  /** Column widths in characters, left to right. */
  columnWidths?: number[]
}

/** One tab of a workbook: its grid, plus how it should look when opened. */
export interface XlsxSheet extends XlsxSheetOptions {
  rows: string[][]
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Control characters are illegal in XML 1.0 and make Excel reject the file.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function unescapeXml(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (match, entity: string) => {
    if (entity[0] !== '#') return XML_ENTITIES[entity] ?? match
    const code = entity[1] === 'x' || entity[1] === 'X'
      ? parseInt(entity.slice(2), 16)
      : parseInt(entity.slice(1), 10)
    return Number.isFinite(code) ? String.fromCodePoint(code) : match
  })
}

/** 0 -> A, 25 -> Z, 26 -> AA */
export function columnName(index: number): string {
  let name = ''
  let n = index
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name
    n = Math.floor(n / 26) - 1
  }
  return name
}

/** "AB12" -> 27 (0-based column index) */
export function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0] ?? ''
  let index = 0
  for (const char of letters.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64)
  }
  return index - 1
}

function sheetXml(rows: string[][], options: XlsxSheetOptions): string {
  const cols = options.columnWidths?.length
    ? `<cols>${options.columnWidths
        .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
        .join('')}</cols>`
    : ''

  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          const text = value ?? ''
          if (text === '') return ''
          const ref = `${columnName(colIndex)}${rowIndex + 1}`
          const style = rowIndex === 0 ? ' s="1"' : ''
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`
        })
        .join('')
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join('')

  return `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"${options.rightToLeft ? ' rightToLeft="1"' : ''}/></sheetViews>${cols}<sheetData>${body}</sheetData></worksheet>`
}

/** Bold header row - style index 1 referenced by `s="1"` above. */
const STYLES_XML = `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`

/**
 * A tab name Excel will actually open.
 *
 * `: \ / ? * [ ]` are illegal in a sheet name and 31 characters is the limit -
 * both of which Excel enforces by refusing the whole file rather than by
 * trimming, so a Hebrew name someone typed is cleaned here instead.
 */
function safeSheetName(name: string | undefined, index: number): string {
  const cleaned = (name ?? '').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31)
  return cleaned || `Sheet${index + 1}`
}

/** Builds a workbook with one tab per sheet, in the order given. */
export function buildXlsxWorkbook(sheets: readonly XlsxSheet[]): Uint8Array {
  const encoder = new TextEncoder()
  // An empty workbook is not a valid file - Excel needs at least one tab.
  const tabs = sheets.length > 0 ? sheets : [{ rows: [] as string[][] }]

  // Names must be unique as well as legal: two tabs called the same thing is
  // the other way a workbook fails to open.
  const used = new Set<string>()
  const names = tabs.map((sheet, i) => {
    const base = safeSheetName(sheet.sheetName, i)
    let name = base
    let suffix = 2
    while (used.has(name)) name = `${base.slice(0, 28)} ${suffix++}`
    used.add(name)
    return name
  })

  const part = (i: number) => `worksheets/sheet${i + 1}.xml`
  // The styles part shares the workbook's relationship namespace, so it takes
  // the id after the last sheet rather than a fixed rId2.
  const stylesRelId = `rId${tabs.length + 1}`

  const files: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      data: encoder.encode(
        `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${tabs
          .map(
            (_, i) =>
              `<Override PartName="/xl/${part(i)}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      data: encoder.encode(
        `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: encoder.encode(
        `${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
          .map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('')}</sheets></workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encoder.encode(
        `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tabs
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${part(i)}"/>`,
          )
          .join(
            '',
          )}<Relationship Id="${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    { name: 'xl/styles.xml', data: encoder.encode(STYLES_XML) },
    ...tabs.map((sheet, i) => ({
      name: `xl/${part(i)}`,
      data: encoder.encode(sheetXml(sheet.rows, sheet)),
    })),
  ]

  return createZip(files)
}

/** Builds a single-sheet workbook from a grid of text values. */
export function buildXlsx(rows: string[][], options: XlsxSheetOptions = {}): Uint8Array {
  return buildXlsxWorkbook([{ ...options, rows }])
}

function textOf(xml: string): string {
  const parts = xml.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)
  if (!parts) return ''
  return parts.map((part) => unescapeXml(part.replace(/^<t(?:\s[^>]*)?>/, '').replace(/<\/t>$/, ''))).join('')
}

function parseSharedStrings(xml: string): string[] {
  const items = xml.match(/<si>[\s\S]*?<\/si>|<si\/>/g) ?? []
  return items.map(textOf)
}

function parseSheet(xml: string, sharedStrings: string[]): string[][] {
  // Self-closing first - otherwise `<row r="1"/>` would swallow the next row.
  const rowMatches = xml.match(/<row[^>]*\/>|<row[^>]*>[\s\S]*?<\/row>/g) ?? []

  return rowMatches.map((rowXml) => {
    const cells: string[] = []
    const cellPattern = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let match: RegExpExecArray | null

    while ((match = cellPattern.exec(rowXml)) !== null) {
      const attrs = match[1]
      const content = match[2] ?? ''
      const ref = /\br="([A-Z]+\d+)"/i.exec(attrs)?.[1]
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? 'n'
      const index = ref ? columnIndex(ref) : cells.length

      let value = ''
      if (type === 'inlineStr') {
        value = textOf(content)
      } else if (type === 's') {
        const raw = /<v[^>]*>([\s\S]*?)<\/v>/.exec(content)?.[1] ?? ''
        value = sharedStrings[Number(raw)] ?? ''
      } else {
        const raw = /<v[^>]*>([\s\S]*?)<\/v>/.exec(content)?.[1] ?? ''
        value = type === 'b' ? (raw === '1' ? 'TRUE' : 'FALSE') : unescapeXml(raw)
      }

      // Sparse sheets skip empty cells - pad so column positions stay aligned.
      while (cells.length < index) cells.push('')
      cells[index] = value
    }

    return cells
  })
}

/** Reads the first worksheet of a workbook into a grid of text values. */
export async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  const files = await readZip(bytes)
  const decoder = new TextDecoder()
  const read = (name: string) => {
    const data = files.get(name)
    return data ? decoder.decode(data) : ''
  }

  // Resolve the first sheet through the workbook relationships; the part is not
  // required to be named sheet1.xml.
  let sheetPath = ''
  const relationshipId = /<sheet\b[^>]*r:id="([^"]+)"/.exec(read('xl/workbook.xml'))?.[1]
  if (relationshipId) {
    const rels = read('xl/_rels/workbook.xml.rels')
    const pattern = new RegExp(`<Relationship\\b[^>]*Id="${relationshipId}"[^>]*>`, 'i')
    const target = /Target="([^"]+)"/.exec(pattern.exec(rels)?.[0] ?? '')?.[1]
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
  }
  if (!files.has(sheetPath)) {
    sheetPath = [...files.keys()].find((name) => /^xl\/worksheets\/[^/]+\.xml$/.test(name)) ?? ''
  }
  if (!sheetPath) throw new Error('NO_WORKSHEET')

  return parseSheet(read(sheetPath), parseSharedStrings(read('xl/sharedStrings.xml')))
}
