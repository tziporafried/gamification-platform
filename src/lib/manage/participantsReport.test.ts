import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EMPTY_FILTERS,
  filterParticipants,
  groupNames,
  NO_GROUP,
  participantColumns,
  participantsGrid,
  sortParticipants,
  totalsOf,
  visibleColumns,
  withRanks,
  type ParticipantRow,
} from './participantsReport.ts'

const TODAY = '2026-07-29'

function participant(over: Partial<ParticipantRow> & { id: string; name: string }): Omit<ParticipantRow, 'rank'> {
  return {
    firstName: '',
    lastName: '',
    groups: [],
    phone: '',
    points: 0,
    scans: 0,
    lastScanAt: null,
    rewards: [],
    lotteryWins: [],
    triviaAttempts: 0,
    triviaCorrect: 0,
    createdAt: '2026-07-01T09:00:00Z',
    ...over,
  }
}

const ROSTER = withRanks([
  participant({ id: 'a', name: 'דנה כהן', groups: ['קבוצה א'], points: 340, scans: 12, lastScanAt: '2026-07-29T11:32:00Z', rewards: ['שובר'] }),
  participant({ id: 'b', name: 'יוסי לוי', groups: ['קבוצה ב'], points: 280, scans: 9, lastScanAt: '2026-07-28T11:18:00Z', lotteryWins: ['אופניים'] }),
  participant({ id: 'c', name: 'מיכל אברהם', groups: ['קבוצה ב'], points: 280, scans: 7, lastScanAt: '2026-07-28T10:00:00Z' }),
  participant({ id: 'd', name: 'אבי ישראלי' }),
])

test('ties share a place, and the next place skips', () => {
  const byId = new Map(ROSTER.map((row) => [row.id, row.rank]))
  assert.equal(byId.get('a'), 1)
  assert.equal(byId.get('b'), 2)
  assert.equal(byId.get('c'), 2)
})

test('somebody who has not scored has no place at all', () => {
  // Sharing last place with everyone else who has not started says nothing.
  assert.equal(ROSTER.find((row) => row.id === 'd')?.rank, 0)
})

test('a column nobody has a value for is not shown', () => {
  const columns = visibleColumns(participantColumns(TODAY), ROSTER)
  const ids = columns.map((column) => column.id)

  assert.ok(!ids.includes('phone'), 'no phone was ever collected')
  assert.ok(ids.includes('groups'), 'groups exist, so the column does')
  assert.ok(ids.includes('rewards'))
})

test('points and scans stay even when the whole game is at zero', () => {
  const fresh = withRanks([participant({ id: 'x', name: 'משתתף' })])
  const ids = visibleColumns(participantColumns(TODAY), fresh).map((column) => column.id)

  // Everything a brand new game can say about somebody: nobody has scored, and
  // saying so with a zero is the answer. Only createdAt comes along, because
  // every participant has one.
  assert.deepEqual(ids, ['rank', 'name', 'points', 'scans', 'createdAt'])
})

test('search reaches every field a person might be looked up by', () => {
  const rows = withRanks([
    participant({ id: 'a', name: 'דנה כהן', phone: '050-1234567', groups: ['נמרים'] }),
  ])
  const found = (query: string) => filterParticipants(rows, { ...EMPTY_FILTERS, query }).length

  assert.equal(found('דנה'), 1)
  assert.equal(found('1234567'), 1)
  assert.equal(found('נמרים'), 1)
  assert.equal(found('אין כזה'), 0)
})

test('the status filter separates who played from who did not', () => {
  const played = filterParticipants(ROSTER, { ...EMPTY_FILTERS, status: 'played' })
  const idle = filterParticipants(ROSTER, { ...EMPTY_FILTERS, status: 'not_played' })

  assert.deepEqual(played.map((row) => row.id), ['a', 'b', 'c'])
  assert.deepEqual(idle.map((row) => row.id), ['d'])
})

test('the group filter can also ask for everybody in no group', () => {
  assert.deepEqual(
    filterParticipants(ROSTER, { ...EMPTY_FILTERS, group: NO_GROUP }).map((row) => row.id),
    ['d'],
  )
  assert.deepEqual(
    filterParticipants(ROSTER, { ...EMPTY_FILTERS, group: 'קבוצה ב' }).map((row) => row.id),
    ['b', 'c'],
  )
})

test('groups are offered once each, in Hebrew order', () => {
  assert.deepEqual(groupNames(ROSTER), ['קבוצה א', 'קבוצה ב'])
})

test('sorting by points puts the leader first and breaks ties by name', () => {
  const columns = participantColumns(TODAY)
  const sorted = sortParticipants(ROSTER, { column: 'points', direction: 'desc' }, columns)

  // b and c are both on 280, so the name decides: י before מ.
  assert.deepEqual(sorted.map((row) => row.id), ['a', 'b', 'c', 'd'])
})

test('an empty cell sinks to the bottom whichever way the column points', () => {
  const columns = participantColumns(TODAY)
  const ascending = sortParticipants(ROSTER, { column: 'lastScan', direction: 'asc' }, columns)

  // Ascending should surface the earliest scan, not the person who never scanned.
  assert.equal(ascending[0].id, 'c')
  assert.equal(ascending[ascending.length - 1].id, 'd')
})

test('totals count the rows they were handed, not the whole game', () => {
  const played = filterParticipants(ROSTER, { ...EMPTY_FILTERS, status: 'played' })

  assert.deepEqual(totalsOf(played), { participants: 3, played: 3, scans: 28, points: 900 })
  assert.equal(totalsOf(ROSTER).participants, 4)
})

test('the exported grid says the same thing as the table, in full', () => {
  const columns = visibleColumns(participantColumns(TODAY), ROSTER)
  const onScreen = participantsGrid(ROSTER, columns)
  const exported = participantsGrid(ROSTER, columns, true)
  const at = (grid: string[][], column: string) =>
    grid[1][columns.findIndex((c) => c.id === column)]

  assert.deepEqual(onScreen[0], exported[0], 'same headers')
  assert.equal(at(onScreen, 'name'), 'דנה כהן')
  // The screen may write a bare time because the reader knows it is today; a
  // file opened next month cannot, so it carries the date.
  assert.match(at(exported, 'lastScan'), /^29\.07\.2026 /)
})
