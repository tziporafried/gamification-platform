import assert from 'node:assert/strict'
import test from 'node:test'
import { detectDelimiter, parseDelimited, toCsv } from './csv.ts'
import { buildXlsx, buildXlsxWorkbook, columnIndex, columnName, readXlsx } from './xlsx.ts'

test('parses a comma-separated roster', () => {
  const rows = parseDelimited('שם המשתתף,קבוצה\nדנה כהן,אדומים\nיוסי לוי,כחולים')
  assert.deepEqual(rows, [
    ['שם המשתתף', 'קבוצה'],
    ['דנה כהן', 'אדומים'],
    ['יוסי לוי', 'כחולים'],
  ])
})

test('detects the semicolon Excel writes on a Hebrew locale', () => {
  assert.equal(detectDelimiter('שם;קבוצה'), ';')
  assert.deepEqual(parseDelimited('שם;קבוצה\nדנה;אדומים'), [['שם', 'קבוצה'], ['דנה', 'אדומים']])
})

test('a comma inside quotes is part of the name, not a new column', () => {
  assert.deepEqual(parseDelimited('"Cohen, Dan",אדומים'), [['Cohen, Dan', 'אדומים']])
})

test('doubled quotes decode to one quote', () => {
  assert.deepEqual(parseDelimited('"say ""hi""",x'), [['say "hi"', 'x']])
})

test('CRLF line endings and a trailing newline do not add an empty row', () => {
  assert.deepEqual(parseDelimited('a,b\r\nc,d\r\n'), [['a', 'b'], ['c', 'd']])
})

test('a leading byte order mark is stripped from the first cell', () => {
  assert.deepEqual(parseDelimited('﻿שם,קבוצה'), [['שם', 'קבוצה']])
})

test('CSV output quotes only the cells that need it', () => {
  assert.equal(toCsv([['a', 'b,c'], ['d"e', 'f']]), 'a,"b,c"\r\n"d""e",f')
})

test('column references convert both ways', () => {
  assert.equal(columnName(0), 'A')
  assert.equal(columnName(26), 'AA')
  assert.equal(columnIndex('A1'), 0)
  assert.equal(columnIndex('AA12'), 26)
})

test('a generated workbook reads back with the same cells', async () => {
  const rows = [
    ['שם המשתתף', 'קבוצה'],
    ['דנה כהן', 'אדומים'],
    ['O\'Brien & Sons <test>', 'כחולים'],
  ]
  const workbook = buildXlsx(rows, { sheetName: 'משתתפים', rightToLeft: true, columnWidths: [28, 20] })

  assert.deepEqual(await readXlsx(workbook), rows)
})

test('empty cells keep later columns aligned', async () => {
  const rows = [['שם', 'קבוצה'], ['דנה', ''], ['', 'כחולים']]
  const readBack = await readXlsx(buildXlsx(rows))

  assert.equal(readBack[1][0], 'דנה')
  assert.equal(readBack[2][1], 'כחולים')
})

test('reads shared strings, the encoding Excel actually saves', async () => {
  // Hand-built workbook: Excel stores text in xl/sharedStrings.xml and points
  // cells at it by index, rather than the inline strings we write.
  const { createZip } = await import('./zip.ts')
  const encode = (xml: string) => new TextEncoder().encode(xml)
  const workbook = createZip([
    {
      name: 'xl/workbook.xml',
      data: encode('<workbook xmlns:r="r"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encode('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    },
    {
      name: 'xl/sharedStrings.xml',
      data: encode('<sst><si><t>דנה כהן</t></si><si><r><t>אדו</t></r><r><t>מים</t></r></si></sst>'),
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: encode('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row></sheetData></worksheet>'),
    },
  ])

  assert.deepEqual(await readXlsx(workbook), [['דנה כהן', 'אדומים']])
})

test('a workbook keeps every sheet it was given, and reads back on the first', async () => {
  const { readZip } = await import('./zip.ts')
  const workbook = buildXlsxWorkbook([
    { sheetName: 'סיכום', rows: [['משתתפים', '128']] },
    { sheetName: 'משתתפים', rows: [['שם'], ['דנה כהן']], rightToLeft: true },
    { sheetName: 'סריקות', rows: [['משתתף', 'משימה']] },
  ])

  const files = await readZip(workbook)
  assert.ok(files.has('xl/worksheets/sheet3.xml'))
  assert.ok(!files.has('xl/worksheets/sheet4.xml'))
  // The import only ever wants one sheet, and it should be the first.
  assert.deepEqual(await readXlsx(workbook), [['משתתפים', '128']])
})

test('sheet names Excel would refuse are cleaned rather than passed through', async () => {
  const { readZip } = await import('./zip.ts')
  const decoder = new TextDecoder()
  const workbook = buildXlsxWorkbook([
    { sheetName: 'a/b:c*d?e[f]g', rows: [['x']] },
    // Two tabs asking for the same name is the other way a workbook fails to open.
    { sheetName: 'דוח', rows: [['y']] },
    { sheetName: 'דוח', rows: [['z']] },
  ])

  const xml = decoder.decode((await readZip(workbook)).get('xl/workbook.xml')!)
  assert.ok(!/name="[^"]*[:\\/?*[\]]/.test(xml), 'no illegal character survived')
  const names = [...xml.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1])
  assert.equal(new Set(names).size, names.length, 'names are unique')
})
