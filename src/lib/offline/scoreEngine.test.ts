import test from 'node:test'
import assert from 'node:assert/strict'
import { submitOfflineScan } from './scoreEngine.ts'
import { emptyState, makeAction, makeGroup, makePack, makeParticipant } from './fixtures.ts'

test('awards points for a valid scan and returns the kiosk result shape', () => {
  const participant = makeParticipant({ external_id: 'P-1001', name: 'דנה' })
  const action = makeAction({ code: 'A-1001', name: 'ריקוד', points: 15 })
  const pack = makePack({ participants: [participant], actions: [action] })

  const res = submitOfflineScan(pack, emptyState(), 'P-1001', 'A-1001')
  assert.equal(res.ok, true)
  if (!res.ok) return
  assert.equal(res.result.points, 15)
  assert.equal(res.result.participantTotalPoints, 15)
  assert.equal(res.result.participantName, 'דנה')
  assert.equal(res.result.actionName, 'ריקוד')
  assert.equal(res.result.eventScanCount, 1)
  assert.equal(res.state.scans.length, 1)
})

test('rejects an unknown participant code', () => {
  const pack = makePack({ actions: [makeAction({ code: 'A-1' })] })
  const res = submitOfflineScan(pack, emptyState(), 'NOPE', 'A-1')
  assert.equal(res.ok, false)
})

test('rejects an unknown action code', () => {
  const pack = makePack({ participants: [makeParticipant({ external_id: 'P-1' })] })
  const res = submitOfflineScan(pack, emptyState(), 'P-1', 'NOPE')
  assert.equal(res.ok, false)
})

test('max_completions=1 blocks the second scan', () => {
  const participant = makeParticipant({ external_id: 'P-1' })
  const action = makeAction({ code: 'A-1', max_completions: 1 })
  const pack = makePack({ participants: [participant], actions: [action] })

  const first = submitOfflineScan(pack, emptyState(), 'P-1', 'A-1')
  assert.equal(first.ok, true)
  if (!first.ok) return

  const second = submitOfflineScan(pack, first.state, 'P-1', 'A-1')
  assert.equal(second.ok, false)
})

test('accumulates across repeated scans when unlimited', () => {
  const participant = makeParticipant({ external_id: 'P-1' })
  const action = makeAction({ code: 'A-1', points: 5, max_completions: null })
  const pack = makePack({ participants: [participant], actions: [action] })

  let state = emptyState()
  for (let i = 0; i < 4; i++) {
    const res = submitOfflineScan(pack, state, 'P-1', 'A-1')
    assert.equal(res.ok, true)
    if (!res.ok) return
    state = res.state
  }
  assert.equal(state.scans.length, 4)
})

test('blocks an action restricted to a group the participant is not in', () => {
  const other = makeGroup({ name: 'אחרים' })
  const participant = makeParticipant({ external_id: 'P-1' })
  const action = makeAction({ code: 'A-1' })
  const pack = makePack({
    groups: [other],
    participants: [participant],
    actions: [action],
    actionGroups: [{ action_id: action.id, group_id: other.id }],
    participantGroups: [],
  })

  const res = submitOfflineScan(pack, emptyState(), 'P-1', 'A-1')
  assert.equal(res.ok, false)
})

test('allows an action restricted to a group the participant belongs to', () => {
  const team = makeGroup({ name: 'הקבוצה' })
  const participant = makeParticipant({ external_id: 'P-1' })
  const action = makeAction({ code: 'A-1' })
  const pack = makePack({
    groups: [team],
    participants: [participant],
    actions: [action],
    actionGroups: [{ action_id: action.id, group_id: team.id }],
    participantGroups: [{ participant_id: participant.id, group_id: team.id }],
  })

  const res = submitOfflineScan(pack, emptyState(), 'P-1', 'A-1')
  assert.equal(res.ok, true)
})

test('blocks an inactive action', () => {
  const participant = makeParticipant({ external_id: 'P-1' })
  const action = makeAction({ code: 'A-1', is_active: false })
  const pack = makePack({ participants: [participant], actions: [action] })

  const res = submitOfflineScan(pack, emptyState(), 'P-1', 'A-1')
  assert.equal(res.ok, false)
})

test('daily_limit blocks a second scan on the same Israel day', () => {
  const participant = makeParticipant({ external_id: 'P-1' })
  const action = makeAction({ code: 'A-1', daily_limit: true })
  const pack = makePack({ participants: [participant], actions: [action] })

  const morning = new Date('2026-07-16T06:00:00.000Z')
  const evening = new Date('2026-07-16T18:00:00.000Z')

  const first = submitOfflineScan(pack, emptyState(), 'P-1', 'A-1', morning)
  assert.equal(first.ok, true)
  if (!first.ok) return

  const second = submitOfflineScan(pack, first.state, 'P-1', 'A-1', evening)
  assert.equal(second.ok, false)
})

test('each scan gets a unique client transaction id', () => {
  const participant = makeParticipant({ external_id: 'P-1' })
  const action = makeAction({ code: 'A-1' })
  const pack = makePack({ participants: [participant], actions: [action] })

  const first = submitOfflineScan(pack, emptyState(), 'P-1', 'A-1')
  assert.equal(first.ok, true)
  if (!first.ok) return
  const second = submitOfflineScan(pack, first.state, 'P-1', 'A-1')
  assert.equal(second.ok, true)
  if (!second.ok) return

  assert.notEqual(first.scan.clientTxId, second.scan.clientTxId)
})
