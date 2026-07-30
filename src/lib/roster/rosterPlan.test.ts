import assert from 'node:assert/strict'
import test from 'node:test'
import { planRosterImport, skippedRowCount } from './rosterPlan.ts'

const NONE = { participantNames: [], groupNames: [] }

/**
 * The entry a file without a שם משפחה column produces: the whole name lands in
 * the first name and the family name is empty, which is the same rule the typed
 * add field follows. Every expectation below written this way is a file from
 * before the split, asserting it still reads exactly as it used to.
 */
const whole = (name: string, group = '', phone = '') => ({
  firstName: name,
  lastName: '',
  name,
  groups: group === '' ? [] : [group],
  group,
  phone,
})

test('reads the template layout: header row, name then group', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'אדומים'], ['יוסי לוי', 'כחולים']],
    NONE,
  )

  assert.equal(plan.hasHeader, true)
  assert.deepEqual(plan.entries, [
    whole('דנה כהן', 'אדומים', ''),
    whole('יוסי לוי', 'כחולים', ''),
  ])
  assert.deepEqual(plan.newGroups, ['אדומים', 'כחולים'])
})

test('a file with no header row is still read as name, group', () => {
  const plan = planRosterImport([['דנה כהן', 'אדומים']], NONE)

  assert.equal(plan.hasHeader, false)
  assert.deepEqual(plan.entries, [whole('דנה כהן', 'אדומים', '')])
})

test('columns are located by header, so a group-first file still maps', () => {
  const plan = planRosterImport([['Group', 'Name'], ['אדומים', 'דנה כהן']], NONE)

  assert.deepEqual(plan.entries, [whole('דנה כהן', 'אדומים', '')])
})

test('a name-only file imports participants and no groups', () => {
  const plan = planRosterImport([['שם'], ['דנה כהן'], ['יוסי לוי']], NONE)

  assert.deepEqual(plan.entries, [
    whole('דנה כהן', '', ''),
    whole('יוסי לוי', '', ''),
  ])
  assert.deepEqual(plan.newGroups, [])
})

test('groups already in the event are matched, not created again', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', ' אדומים ']],
    { participantNames: [], groupNames: ['אדומים'] },
  )

  assert.deepEqual(plan.newGroups, [])
  assert.deepEqual(plan.existingGroups, ['אדומים'])
})

test('a spelling variant maps onto the stored group name', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'REDS']],
    { participantNames: [], groupNames: ['Reds'] },
  )

  assert.deepEqual(plan.entries, [whole('דנה כהן', 'Reds', '')])
  assert.deepEqual(plan.newGroups, [])
})

test('re-uploading the same file adds nobody twice', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'אדומים'], ['יוסי לוי', 'אדומים']],
    { participantNames: ['דנה כהן'], groupNames: ['אדומים'] },
  )

  assert.deepEqual(plan.entries, [whole('יוסי לוי', 'אדומים', '')])
  assert.equal(plan.alreadyInEventRows, 1)
  assert.equal(skippedRowCount(plan), 1)
})

test('a name repeated inside the file is kept once', () => {
  const plan = planRosterImport([['דנה כהן', 'א'], ['דנה  כהן', 'ב']], NONE)

  assert.equal(plan.entries.length, 1)
  assert.equal(plan.duplicateRows, 1)
})

test('a row naming only a group still creates that group', () => {
  const plan = planRosterImport([['שם המשתתף', 'קבוצה'], ['', 'ירוקים']], NONE)

  assert.deepEqual(plan.entries, [])
  assert.deepEqual(plan.newGroups, ['ירוקים'])
  assert.equal(plan.groupOnlyRows, 1)
  assert.equal(plan.error, null)
})

test('blank rows in the middle of the sheet are ignored', () => {
  const plan = planRosterImport([['דנה כהן', ''], ['', ''], ['  ', ' '], ['יוסי לוי', '']], NONE)

  assert.equal(plan.entries.length, 2)
  assert.equal(plan.totalRows, 2)
})

test('an empty sheet reports EMPTY_FILE rather than importing nothing', () => {
  assert.equal(planRosterImport([], NONE).error, 'EMPTY_FILE')
  assert.equal(planRosterImport([['שם המשתתף', 'קבוצה']], NONE).error, 'EMPTY_FILE')
})

test('a file whose names all exist already reports NO_NAMES', () => {
  const plan = planRosterImport([['דנה כהן', '']], { participantNames: ['דנה כהן'], groupNames: [] })

  assert.equal(plan.error, 'NO_NAMES')
})

test('an oversized file is rejected before any planning work', () => {
  const rows = Array.from({ length: 2001 }, (_, i) => [`משתתף ${i}`, ''])

  assert.equal(planRosterImport(rows, NONE).error, 'TOO_MANY_ROWS')
})

// ============================================================
// FIRST AND FAMILY NAME
// ============================================================

test('the two name columns are read into the two fields', () => {
  const plan = planRosterImport(
    [['שם פרטי', 'שם משפחה', 'קבוצה'], ['דנה', 'כהן', 'אדומים'], ['יוסי', 'לוי', 'כחולים']],
    NONE,
  )

  assert.deepEqual(plan.entries, [
    { firstName: 'דנה', lastName: 'כהן', name: 'דנה כהן', groups: ['אדומים'], group: 'אדומים', phone: '' },
    { firstName: 'יוסי', lastName: 'לוי', name: 'יוסי לוי', groups: ['כחולים'], group: 'כחולים', phone: '' },
  ])
  assert.deepEqual(plan.newGroups, ['אדומים', 'כחולים'])
})

test('the columns are found by their headers, in any order', () => {
  const plan = planRosterImport(
    [['Last Name', 'Group', 'First Name'], ['כהן', 'אדומים', 'דנה']],
    NONE,
  )

  assert.deepEqual(plan.entries, [
    { firstName: 'דנה', lastName: 'כהן', name: 'דנה כהן', groups: ['אדומים'], group: 'אדומים', phone: '' },
  ])
})

test('a family name is never filled in by position', () => {
  // Three columns, and the header names only two of them. The spare column is
  // the group - claiming it for the family name would make אדומים a surname.
  const plan = planRosterImport(
    [['שם פרטי', 'קבוצה'], ['דנה', 'אדומים']],
    NONE,
  )

  assert.deepEqual(plan.entries, [whole('דנה', 'אדומים')])
})

test('a row with only a family name is still a participant', () => {
  const plan = planRosterImport([['שם פרטי', 'שם משפחה'], ['', 'כהן']], NONE)

  assert.deepEqual(plan.entries, [
    { firstName: '', lastName: 'כהן', name: 'כהן', groups: [], group: '', phone: '' },
  ])
})

test('duplicates are judged on the whole name, not on either half', () => {
  const plan = planRosterImport(
    [['שם פרטי', 'שם משפחה'], ['דנה', 'כהן'], ['דנה', 'לוי'], ['דנה', 'כהן']],
    NONE,
  )

  // Two different people named דנה, and one of them listed twice.
  assert.equal(plan.entries.length, 2)
  assert.equal(plan.duplicateRows, 1)
})

test('a name already in the event is matched however the file divides it', () => {
  const plan = planRosterImport(
    [['שם פרטי', 'שם משפחה'], ['דנה', 'כהן']],
    { participantNames: ['דנה כהן'], groupNames: [] },
  )

  assert.equal(plan.alreadyInEventRows, 1)
  assert.deepEqual(plan.entries, [])
})

test('the length limit applies to the whole name, not to each half', () => {
  const long = 'א'.repeat(45)
  const plan = planRosterImport([['שם פרטי', 'שם משפחה'], [long, long]], NONE)

  assert.deepEqual(plan.entries, [])
  assert.equal(plan.invalidRows, 1)
})

// ============================================================
// SEVERAL GROUPS IN ONE CELL
// ============================================================

test('a comma in the group cell puts the participant in both groups', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'אדומים, כחולים']],
    NONE,
  )

  assert.deepEqual(plan.entries[0].groups, ['אדומים', 'כחולים'])
  assert.deepEqual(plan.newGroups, ['אדומים', 'כחולים'])
})

test('a semicolon and a pipe separate too, whatever the file was saved as', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'אדומים; כחולים'], ['יוסי לוי', 'ירוקים|צהובים']],
    NONE,
  )

  assert.deepEqual(plan.entries[0].groups, ['אדומים', 'כחולים'])
  assert.deepEqual(plan.entries[1].groups, ['ירוקים', 'צהובים'])
})

test('each group in the list is created once, however many rows name it', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'אדומים, כחולים'], ['יוסי לוי', 'כחולים, ירוקים']],
    NONE,
  )

  assert.deepEqual(plan.newGroups, ['אדומים', 'כחולים', 'ירוקים'])
})

test('a group already in the event is matched inside a list as well', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'REDS, כחולים']],
    { participantNames: [], groupNames: ['Reds'] },
  )

  assert.deepEqual(plan.entries[0].groups, ['Reds', 'כחולים'])
  assert.deepEqual(plan.existingGroups, ['Reds'])
  assert.deepEqual(plan.newGroups, ['כחולים'])
})

test('the same group twice in one cell is one membership', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'אדומים, אדומים , אדומים']],
    NONE,
  )

  assert.deepEqual(plan.entries[0].groups, ['אדומים'])
  assert.deepEqual(plan.newGroups, ['אדומים'])
})

test('stray separators and spaces do not create empty groups', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', ' , אדומים ,, '], ['יוסי לוי', ' , ']],
    NONE,
  )

  assert.deepEqual(plan.entries[0].groups, ['אדומים'])
  // Nothing but separators is no group at all - the row reads as ungrouped.
  assert.deepEqual(plan.entries[1].groups, [])
  assert.deepEqual(plan.newGroups, ['אדומים'])
})

test('a row naming only groups creates all of them', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['', 'ירוקים, צהובים']],
    NONE,
  )

  assert.deepEqual(plan.entries, [])
  assert.deepEqual(plan.newGroups, ['ירוקים', 'צהובים'])
  assert.equal(plan.groupOnlyRows, 1)
})

test('the first group is repeated as `group`, for a pre-087 database', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'אדומים, כחולים']],
    NONE,
  )

  assert.equal(plan.entries[0].group, 'אדומים')
})

// ============================================================
// PHONE NUMBERS - only for a game with the sms_notifications flag
// ============================================================

const WITH_PHONES = { collectPhones: true }

test('the phone column is not read at all without the flag', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה', 'טלפון'], ['דנה כהן', 'אדומים', '050-1234567']],
    NONE,
  )

  assert.deepEqual(plan.entries, [whole('דנה כהן', 'אדומים', '')])
  assert.equal(plan.missingPhoneRows, 0)
})

test('phones are normalised on the way in, however the file wrote them', () => {
  const plan = planRosterImport(
    [
      ['שם המשתתף', 'קבוצה', 'טלפון'],
      ['דנה כהן', 'אדומים', '050-1234567'],
      ['יוסי לוי', 'אדומים', '+972 52 765 4321'],
      ['מיכל אברהם', 'כחולים', '541234567'],
    ],
    NONE,
    WITH_PHONES,
  )

  assert.deepEqual(plan.entries.map((entry) => entry.phone), [
    '+972501234567',
    '+972527654321',
    '+972541234567',
  ])
  assert.equal(plan.missingPhoneRows, 0)
})

test('a header spelling we did not write still maps to the phone column', () => {
  const plan = planRosterImport(
    [['שם', 'נייד'], ['דנה כהן', '050-1234567']],
    NONE,
    WITH_PHONES,
  )

  assert.deepEqual(plan.entries, [whole('דנה כהן', '', '+972501234567')])
})

test('a participant whose number is unreadable is still imported, and counted', () => {
  const plan = planRosterImport(
    [
      ['שם המשתתף', 'קבוצה', 'טלפון'],
      ['דנה כהן', 'אדומים', '050-1234567'],
      ['יוסי לוי', 'אדומים', '03-1234567'],
      ['מיכל אברהם', 'אדומים', ''],
    ],
    NONE,
    WITH_PHONES,
  )

  assert.equal(plan.entries.length, 3)
  assert.deepEqual(plan.entries.map((entry) => entry.phone), ['+972501234567', '', ''])
  assert.equal(plan.missingPhoneRows, 2)
  // Nothing was skipped - a bad phone is not a reason to lose the participant.
  assert.equal(skippedRowCount(plan), 0)
})

test('a file with no phone column leaves everyone without a number', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'אדומים']],
    NONE,
    WITH_PHONES,
  )

  assert.deepEqual(plan.entries, [whole('דנה כהן', 'אדומים', '')])
  assert.equal(plan.missingPhoneRows, 1)
  assert.deepEqual(plan.newGroups, ['אדומים'])
})

test('a name-and-phone file does not turn phone numbers into groups', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'טלפון'], ['דנה כהן', '050-1234567'], ['יוסי לוי', '052-7654321']],
    NONE,
    WITH_PHONES,
  )

  assert.deepEqual(plan.newGroups, [])
  assert.deepEqual(plan.entries, [
    whole('דנה כהן', '', '+972501234567'),
    whole('יוסי לוי', '', '+972527654321'),
  ])
})

test('a headerless file is read by what the columns hold, not by their order', () => {
  const plan = planRosterImport(
    [['דנה כהן', '050-1234567'], ['יוסי לוי', '052-7654321']],
    NONE,
    WITH_PHONES,
  )

  assert.equal(plan.hasHeader, false)
  assert.deepEqual(plan.newGroups, [])
  assert.deepEqual(plan.entries, [
    whole('דנה כהן', '', '+972501234567'),
    whole('יוסי לוי', '', '+972527654321'),
  ])
})

test('a headerless file in template order keeps the group column a group', () => {
  const plan = planRosterImport(
    [['דנה כהן', 'אדומים', '050-1234567']],
    NONE,
    WITH_PHONES,
  )

  assert.deepEqual(plan.newGroups, ['אדומים'])
  assert.deepEqual(plan.entries, [whole('דנה כהן', 'אדומים', '+972501234567')])
})
