import test from 'node:test'
import assert from 'node:assert/strict'
import { getGroupLeaderboard, getParticipantLeaderboard } from './leaderboard.ts'
import type { LocalScan } from './types.ts'
import { makeGroup, makePack, makeParticipant } from './fixtures.ts'

function scan(participantId: string, points: number): LocalScan {
  return {
    clientTxId: Math.random().toString(36).slice(2),
    participantId,
    actionId: 'a',
    points,
    createdAt: '2026-07-16T10:00:00.000Z',
  }
}

test('participant leaderboard includes everyone, unscored at zero', () => {
  const a = makeParticipant({ name: 'אבי' })
  const b = makeParticipant({ name: 'בת' })
  const pack = makePack({ participants: [a, b] })

  const board = getParticipantLeaderboard(pack, [scan(a.id, 30)])
  assert.equal(board.length, 2)
  assert.equal(board[0].participant_id, a.id)
  assert.equal(board[0].total_points, 30)
  assert.equal(board[1].total_points, 0)
})

test('participant leaderboard sorts by points desc then name', () => {
  const a = makeParticipant({ name: 'ב' })
  const b = makeParticipant({ name: 'א' })
  const pack = makePack({ participants: [a, b] })

  // Equal points → name breaks the tie: 'א' before 'ב'.
  const board = getParticipantLeaderboard(pack, [scan(a.id, 10), scan(b.id, 10)])
  assert.equal(board[0].participant_name, 'א')
  assert.equal(board[1].participant_name, 'ב')
})

test('group score sums its members', () => {
  const team = makeGroup({ name: 'קבוצה' })
  const a = makeParticipant()
  const b = makeParticipant()
  const pack = makePack({
    groups: [team],
    participants: [a, b],
    participantGroups: [
      { participant_id: a.id, group_id: team.id },
      { participant_id: b.id, group_id: team.id },
    ],
  })

  const board = getGroupLeaderboard(pack, [scan(a.id, 10), scan(b.id, 25)])
  assert.equal(board.length, 1)
  assert.equal(board[0].total_points, 35)
})

test('a participant in two groups counts toward both (mirrors the SQL join)', () => {
  const g1 = makeGroup({ name: 'ראשונה' })
  const g2 = makeGroup({ name: 'שנייה' })
  const p = makeParticipant()
  const pack = makePack({
    groups: [g1, g2],
    participants: [p],
    participantGroups: [
      { participant_id: p.id, group_id: g1.id },
      { participant_id: p.id, group_id: g2.id },
    ],
  })

  const board = getGroupLeaderboard(pack, [scan(p.id, 40)])
  const byId = new Map(board.map((row) => [row.group_id, row.total_points]))
  assert.equal(byId.get(g1.id), 40)
  assert.equal(byId.get(g2.id), 40)
})

test('a distribution group is not ranked, and its members still score', () => {
  const team = makeGroup({ name: 'אדומים' })
  const staff = makeGroup({ name: 'צוות היגוי', purpose: 'distribution' })
  const p = makeParticipant()
  const pack = makePack({
    groups: [team, staff],
    participants: [p],
    participantGroups: [
      { participant_id: p.id, group_id: team.id },
      { participant_id: p.id, group_id: staff.id },
    ],
  })

  const board = getGroupLeaderboard(pack, [scan(p.id, 40)])
  assert.deepEqual(board.map((row) => row.group_id), [team.id])
  // The distribution membership takes nothing away from the group that competes.
  assert.equal(board[0].total_points, 40)
  assert.equal(getParticipantLeaderboard(pack, [scan(p.id, 40)])[0].total_points, 40)
})

test('a pack from before 090 ranks every group - the fixture has no purpose at all', () => {
  const team = makeGroup({ name: 'ותיקה' })
  assert.equal(team.purpose, undefined)

  assert.equal(getGroupLeaderboard(makePack({ groups: [team] }), []).length, 1)
})

test('empty groups appear at zero', () => {
  const team = makeGroup({ name: 'ריקה' })
  const pack = makePack({ groups: [team] })
  const board = getGroupLeaderboard(pack, [])
  assert.equal(board.length, 1)
  assert.equal(board[0].total_points, 0)
})
