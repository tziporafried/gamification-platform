import test from 'node:test'
import assert from 'node:assert/strict'
import { checkAndAwardRewards } from './rewardEngine.ts'
import type { GameState, LocalScan } from './types.ts'
import { makeGroup, makePack, makeParticipant, makeReward } from './fixtures.ts'

function scan(participantId: string, points: number): LocalScan {
  return {
    clientTxId: Math.random().toString(36).slice(2),
    participantId,
    actionId: 'a',
    points,
    createdAt: '2026-07-16T10:00:00.000Z',
  }
}

function stateWith(scans: LocalScan[], awards: GameState['awards'] = []): GameState {
  return { scans, awards }
}

test('awards a reward once the threshold is reached', () => {
  const p = makeParticipant()
  const reward = makeReward({ required_points: 20 })
  const pack = makePack({ participants: [p], rewards: [reward] })

  const none = checkAndAwardRewards(pack, [scan(p.id, 15)], [], p.id)
  assert.equal(none.length, 0)

  const earned = checkAndAwardRewards(pack, [scan(p.id, 25)], [], p.id)
  assert.equal(earned.length, 1)
  assert.equal(earned[0].out_reward_id, reward.id)
  assert.equal(earned[0].out_total_points, 25)
})

test('does not re-award a reward the participant already holds', () => {
  const p = makeParticipant()
  const reward = makeReward({ required_points: 20 })
  const pack = makePack({ participants: [p], rewards: [reward] })

  const already = stateWith(
    [scan(p.id, 30)],
    [{ participantId: p.id, rewardId: reward.id, scoreAtAward: 25, awardedAt: 'x' }],
  )
  const earned = checkAndAwardRewards(pack, already.scans, already.awards, p.id)
  assert.equal(earned.length, 0)
})

test('ignores inactive rewards', () => {
  const p = makeParticipant()
  const reward = makeReward({ required_points: 10, is_active: false })
  const pack = makePack({ participants: [p], rewards: [reward] })

  const earned = checkAndAwardRewards(pack, [scan(p.id, 50)], [], p.id)
  assert.equal(earned.length, 0)
})

test('participant-targeted reward only fires for its target', () => {
  const target = makeParticipant({ external_id: 'P-target' })
  const other = makeParticipant({ external_id: 'P-other' })
  const reward = makeReward({
    required_points: 10,
    target_type: 'participant',
    target_participant_id: target.id,
  })
  const pack = makePack({ participants: [target, other], rewards: [reward] })

  assert.equal(checkAndAwardRewards(pack, [scan(other.id, 50)], [], other.id).length, 0)
  assert.equal(checkAndAwardRewards(pack, [scan(target.id, 50)], [], target.id).length, 1)
})

test('group-targeted reward only fires for members', () => {
  const team = makeGroup()
  const member = makeParticipant()
  const outsider = makeParticipant()
  const reward = makeReward({ required_points: 10, target_type: 'groups' })
  const pack = makePack({
    groups: [team],
    participants: [member, outsider],
    rewards: [reward],
    rewardGroups: [{ reward_id: reward.id, group_id: team.id }],
    participantGroups: [{ participant_id: member.id, group_id: team.id }],
  })

  assert.equal(checkAndAwardRewards(pack, [scan(outsider.id, 50)], [], outsider.id).length, 0)
  assert.equal(checkAndAwardRewards(pack, [scan(member.id, 50)], [], member.id).length, 1)
})

test("winner_mode 'first' lets only one participant win", () => {
  const first = makeParticipant()
  const second = makeParticipant()
  const reward = makeReward({ required_points: 10, winner_mode: 'first' })
  const pack = makePack({ participants: [first, second], rewards: [reward] })

  const firstWins = checkAndAwardRewards(pack, [scan(first.id, 50)], [], first.id)
  assert.equal(firstWins.length, 1)

  // Record the first winner, then the second reaches the threshold too.
  const awards = [{ participantId: first.id, rewardId: reward.id, scoreAtAward: 50, awardedAt: 'x' }]
  const secondBlocked = checkAndAwardRewards(pack, [scan(second.id, 50)], awards, second.id)
  assert.equal(secondBlocked.length, 0)
})

test("winner_mode 'all' lets everyone who qualifies win", () => {
  const first = makeParticipant()
  const second = makeParticipant()
  const reward = makeReward({ required_points: 10, winner_mode: 'all' })
  const pack = makePack({ participants: [first, second], rewards: [reward] })

  const awards = [{ participantId: first.id, rewardId: reward.id, scoreAtAward: 50, awardedAt: 'x' }]
  const secondWins = checkAndAwardRewards(pack, [scan(second.id, 50)], awards, second.id)
  assert.equal(secondWins.length, 1)
})
