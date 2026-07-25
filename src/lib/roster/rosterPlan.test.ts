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
    { name: 'דנה כהן', group: 'אדומים' },
    { name: 'יוסי לוי', group: 'כחולים' },
  ])
  assert.deepEqual(plan.newGroups, ['אדומים', 'כחולים'])
})

test('a file with no header row is still read as name, group', () => {
  const plan = planRosterImport([['דנה כהן', 'אדומים']], NONE)

  assert.equal(plan.hasHeader, false)
  assert.deepEqual(plan.entries, [{ name: 'דנה כהן', group: 'אדומים' }])
})

test('columns are located by header, so a group-first file still maps', () => {
  const plan = planRosterImport([['Group', 'Name'], ['אדומים', 'דנה כהן']], NONE)

  assert.deepEqual(plan.entries, [{ name: 'דנה כהן', group: 'אדומים' }])
})

test('a name-only file imports participants and no groups', () => {
  const plan = planRosterImport([['שם'], ['דנה כהן'], ['יוסי לוי']], NONE)

  assert.deepEqual(plan.entries, [
    { name: 'דנה כהן', group: '' },
    { name: 'יוסי לוי', group: '' },
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

  assert.deepEqual(plan.entries, [{ name: 'דנה כהן', group: 'Reds' }])
  assert.deepEqual(plan.newGroups, [])
})

test('re-uploading the same file adds nobody twice', () => {
  const plan = planRosterImport(
    [['שם המשתתף', 'קבוצה'], ['דנה כהן', 'אדומים'], ['יוסי לוי', 'אדומים']],
    { participantNames: ['דנה כהן'], groupNames: ['אדומים'] },
  )

  assert.deepEqual(plan.entries, [{ name: 'יוסי לוי', group: 'אדומים' }])
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
