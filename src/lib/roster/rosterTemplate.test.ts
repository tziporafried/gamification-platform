import assert from 'node:assert/strict'
import test from 'node:test'
import { rosterTemplateRows } from './rosterTemplate.ts'
import {
  FIRST_NAME_COLUMN_HEADER,
  GROUP_COLUMN_HEADER,
  LAST_NAME_COLUMN_HEADER,
  PHONE_COLUMN_HEADER,
  planRosterImport,
} from './rosterPlan.ts'

/**
 * The sample file is the one artefact of this feature that leaves the app, so
 * it is also where a leak would be hardest to notice: a game that was never
 * sold SMS must download a file with no
 * column, no header and no example number hinting at a feature it does not have.
 */

test('the default template is first name, family name, group', () => {
  assert.deepEqual(rosterTemplateRows(), [
    [FIRST_NAME_COLUMN_HEADER, LAST_NAME_COLUMN_HEADER, GROUP_COLUMN_HEADER],
    ['ישראל', 'ישראלי', 'קבוצה א'],
    ['דנה', 'כהן', 'קבוצה א'],
    ['יוסי', 'לוי', 'קבוצה ב'],
    ['מיכל', 'אברהם', 'קבוצה א, קבוצה ב'],
  ])
})

test('the sample rows name only the two groups, however they are divided', () => {
  const plan = planRosterImport(rosterTemplateRows(), { participantNames: [], groupNames: [] })

  assert.deepEqual(plan.newGroups, ['קבוצה א', 'קבוצה ב'])
  assert.deepEqual(plan.entries[plan.entries.length - 1].groups, ['קבוצה א', 'קבוצה ב'])
})

test('nothing in the default template so much as says "phone"', () => {
  const flattened = rosterTemplateRows().flat().join(' ')

  assert.equal(flattened.includes(PHONE_COLUMN_HEADER), false)
  assert.match(flattened, /^[^\d]*$/, 'no example phone number leaked into the cells')
})

test('the groups-only template is unchanged too', () => {
  const rows = rosterTemplateRows({ includeGroupColumn: false })

  assert.deepEqual(rows[0], [FIRST_NAME_COLUMN_HEADER, LAST_NAME_COLUMN_HEADER])
  assert.equal(rows.length, 5)
})

test('the flag adds the phone column, and only then', () => {
  const rows = rosterTemplateRows({ includePhoneColumn: true })

  assert.deepEqual(rows[0], [FIRST_NAME_COLUMN_HEADER, LAST_NAME_COLUMN_HEADER, GROUP_COLUMN_HEADER, PHONE_COLUMN_HEADER])
  assert.deepEqual(rows[1], ['ישראל', 'ישראלי', 'קבוצה א', '050-1234567'])
})

test('a phone column with no groups keeps its own place', () => {
  const rows = rosterTemplateRows({ includeGroupColumn: false, includePhoneColumn: true })

  assert.deepEqual(rows[0], [FIRST_NAME_COLUMN_HEADER, LAST_NAME_COLUMN_HEADER, PHONE_COLUMN_HEADER])
  assert.deepEqual(rows[1], ['ישראל', 'ישראלי', '050-1234567'])
})
