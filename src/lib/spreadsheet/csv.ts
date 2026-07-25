/**
 * Delimited-text (CSV / TSV) reading and writing.
 *
 * Excel writes CSV with the locale's list separator - a Hebrew Windows install
 * uses ';' - so the delimiter is detected rather than assumed.
 */

/** Excel only reads a CSV as UTF-8 when it starts with a byte order mark. */
export const CSV_BOM = '\uFEFF'

const DELIMITERS = [',', ';', '\t'] as const

/** Picks the delimiter that yields the most columns on the first non-empty line. */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? ''
  let best = ','
  let bestCount = 0

  for (const delimiter of DELIMITERS) {
    // Count only separators outside quotes, so "Cohen, Dan" doesn't win.
    let count = 0
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') inQuotes = !inQuotes
      else if (char === delimiter && !inQuotes) count++
    }
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }

  return best
}

/** Parses delimited text into a grid of raw cell strings (RFC 4180 quoting). */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const body = text.startsWith(CSV_BOM) ? text.slice(1) : text
  const sep = delimiter ?? detectDelimiter(body)

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < body.length; i++) {
    const char = body[i]

    if (inQuotes) {
      if (char === '"') {
        if (body[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === sep) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && body[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  // A trailing newline leaves nothing pending; anything else is a final row.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

/** Serialises a grid to CSV, quoting only the cells that need it. */
export function toCsv(rows: string[][], delimiter = ','): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell ?? ''
          return /["\r\n]|^\s|\s$/.test(value) || value.includes(delimiter)
            ? `"${value.replace(/"/g, '""')}"`
            : value
        })
        .join(delimiter),
    )
    .join('\r\n')
}
