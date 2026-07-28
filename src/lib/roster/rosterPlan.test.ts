import assert from 'node:assert/strict'
import test from 'node:test'
import { planRosterImport, skippedRowCount } from './rosterPlan.ts'

const NONE = { participantNames: [], groupNames: [] }

test('reads the template layout: header row, name then group', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'אדומים'], ['יוסי לוי', 'כחולים']],
    NONE,
  )

  assert.equal(plan.hasHeader, true)
  assert.deepEqual(plan.entries, [
    { name: 'דנה כהן', group: 'אדומים', phone: '' },
    { name: 'יוסי לוי', group: 'כחולים', phone: '' },
  ])
  assert.deepEqual(plan.newGroups, ['אדומים', 'כחולים'])
})

test('a file with no header row is still read as name, group', () => {
  const plan = planRosterImport([['דנה כהן', 'אדומים']], NONE)

  assert.equal(plan.hasHeader, false)
  assert.deepEqual(plan.entries, [{ name: 'דנה כהן', group: 'אדומים', phone: '' }])
})

test('columns are located by header, so a group-first file still maps', () => {
  const plan = planRosterImport([['Group', 'Name'], ['אדומים', 'דנה כהן']], NONE)

  assert.deepEqual(plan.entries, [{ name: 'דנה כהן', group: 'אדומים', phone: '' }])
})

test('a name-only file imports participants and no groups', () => {
  const plan = planRosterImport([['שם'], ['דנה כהן'], ['יוסי לוי']], NONE)

  assert.deepEqual(plan.entries, [
    { name: 'דנה כהן', group: '', phone: '' },
    { name: 'יוסי לוי', group: '', phone: '' },
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

  assert.deepEqual(plan.entries, [{ name: 'דנה כהן', group: 'Reds', phone: '' }])
  assert.deepEqual(plan.newGroups, [])
})

test('re-uploading the same file adds nobody twice', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'אדומים'], ['יוסי לוי', 'אדומים']],
    { participantNames: ['דנה כהן'], groupNames: ['אדומים'] },
  )

  assert.deepEqual(plan.entries, [{ name: 'יוסי לוי', group: 'אדומים', phone: '' }])
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
// PHONE NUMBERS - only for a game with the sms_notifications flag
// ============================================================

const WITH_PHONES = { collectPhones: true }

test('the phone column is not read at all without the flag', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה', 'טלפון'], ['דנה כהן', 'אדומים', '050-1234567']],
    NONE,
  )

  assert.deepEqual(plan.entries, [{ name: 'דנה כהן', group: 'אדומים', phone: '' }])
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

  assert.deepEqual(plan.entries, [{ name: 'דנה כהן', group: '', phone: '+972501234567' }])
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

  assert.deepEqual(plan.entries, [{ name: 'דנה כהן', group: 'אדומים', phone: '' }])
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
    { name: 'דנה כהן', group: '', phone: '+972501234567' },
    { name: 'יוסי לוי', group: '', phone: '+972527654321' },
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
    { name: 'דנה כהן', group: '', phone: '+972501234567' },
    { name: 'יוסי לוי', group: '', phone: '+972527654321' },
  ])
})

test('a headerless file in template order keeps the group column a group', () => {
  const plan = planRosterImport(
    [['דנה כהן', 'אדומים', '050-1234567']],
    NONE,
    WITH_PHONES,
  )

  assert.deepEqual(plan.newGroups, ['אדומים'])
  assert.deepEqual(plan.entries, [{ name: 'דנה כהן', group: 'אדומים', phone: '+972501234567' }])
})
