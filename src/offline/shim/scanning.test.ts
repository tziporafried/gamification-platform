import test from 'node:test'
import assert from 'node:assert/strict'
import {
  makeAction,
  makeGroup,
  makePack,
  makeParticipant,
  makeReward,
} from '../../lib/offline/fixtures.ts'
import { initOfflineData } from './data.ts'
import { supabase } from './supabase.ts'

/**
 * The queries the kiosk actually makes, answered from the pack.
 *
 * A downloaded game runs the real kiosk, so nothing here re-implements a
 * scoring rule - those live in canPerformAction and triviaScan and are tested
 * against the functions themselves. What this file covers is the wiring
 * underneath: whether each query useScoreSubmit, the board and the management
 * screen make comes back shaped the way they read it. That seam is where the
 * lottery bug lived, and it is the one thing a unit test of any single module
 * cannot see.
 */

const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
})

function startGame(over: Parameters<typeof makePack>[0] = {}) {
  store.clear()
  const pack = makePack(over)
  initOfflineData(pack)
  return pack
}

async function scan(eventId: string, participantId: string, actionId: string, points: number) {
  const { data, error } = await supabase
    .from('point_transactions')
    .insert({ event_id: eventId, participant_id: participantId, action_id: actionId, points })
    .select('id')
    .single()
  assert.equal(error, null)
  return (data as { id: string }).id
}

test('a scan reaches the leaderboard, the group board and the activity feed', async () => {
  const group = makeGroup({ name: 'נמרים' })
  const dana = makeParticipant({ name: 'דנה', external_id: 'P-1' })
  const ron = makeParticipant({ name: 'רון', external_id: 'P-2' })
  const dance = makeAction({ name: 'ריקוד', code: 'A-1', points: 15 })
  const pack = startGame({
    groups: [group],
    participants: [dana, ron],
    participantGroups: [{ participant_id: dana.id, group_id: group.id }],
    actions: [dance],
  })

  await scan(pack.event.id, dana.id, dance.id, 15)

  const board = (await supabase.rpc('get_participant_leaderboard')).data as {
    participant_id: string
    total_points: number
  }[]
  assert.equal(board[0].participant_id, dana.id)
  assert.equal(board[0].total_points, 15)
  // Everyone appears, scored or not - the RPC left-joins the transactions.
  assert.equal(board.find((r) => r.participant_id === ron.id)?.total_points, 0)

  const groups = (await supabase.rpc('get_group_leaderboard')).data as { total_points: number }[]
  assert.equal(groups[0].total_points, 15)

  // The kiosk's feed: newest first, with the names joined in.
  const feed = (
    await supabase
      .from('point_transactions')
      .select('id, points, created_at, participant:participants(name), action:actions(id, name, code)')
      .eq('event_id', pack.event.id)
      .order('created_at', { ascending: false })
      .limit(10)
  ).data as { points: number; participant: { name: string }; action: { name: string } }[]
  assert.equal(feed.length, 1)
  assert.equal(feed[0].points, 15)
  assert.equal(feed[0].participant.name, 'דנה')
  assert.equal(feed[0].action.name, 'ריקוד')
})

test('the completion counts useScoreSubmit gates on are answered', async () => {
  const dana = makeParticipant({ external_id: 'P-1' })
  const dance = makeAction({ code: 'A-1', points: 10 })
  const sing = makeAction({ code: 'A-2', points: 10 })
  const pack = startGame({ participants: [dana], actions: [dance, sing] })

  await scan(pack.event.id, dana.id, dance.id, 10)
  await scan(pack.event.id, dana.id, dance.id, 10)

  // The count-only form, for a task with no daily limit.
  const counted = await supabase
    .from('point_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('participant_id', dana.id)
    .eq('action_id', dance.id)
  assert.equal(counted.count, 2)
  assert.equal(counted.data, null)

  // The other task is untouched by them.
  const other = await supabase
    .from('point_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('participant_id', dana.id)
    .eq('action_id', sing.id)
  assert.equal(other.count, 0)

  // The timestamp form, for a task that may be done once a day.
  const stamps = (
    await supabase
      .from('point_transactions')
      .select('created_at')
      .eq('participant_id', dana.id)
      .eq('action_id', dance.id)
  ).data as { created_at: string }[]
  assert.equal(stamps.length, 2)
  assert.ok(stamps.every((row) => typeof row.created_at === 'string' && row.created_at.length > 0))
})

test('a task aimed at groups comes back with its links, both ways round', async () => {
  const team = makeGroup({ name: 'הקבוצה' })
  const dana = makeParticipant({ external_id: 'P-1' })
  const dance = makeAction({ code: 'A-1' })
  const pack = startGame({
    groups: [team],
    participants: [dana],
    participantGroups: [{ participant_id: dana.id, group_id: team.id }],
    actions: [dance],
    actionGroups: [{ action_id: dance.id, group_id: team.id }],
  })

  const allowed = (
    await supabase.from('action_groups').select('group_id').eq('action_id', dance.id)
  ).data as { group_id: string }[]
  assert.deepEqual(allowed.map((r) => r.group_id), [team.id])

  const mine = (
    await supabase.from('participant_groups').select('group_id').eq('participant_id', dana.id)
  ).data as { group_id: string }[]
  assert.deepEqual(mine.map((r) => r.group_id), [team.id])
  assert.equal(pack.groups.length, 1)
})

test('crossing a prize threshold awards it once, and it shows in the log', async () => {
  const dana = makeParticipant({ name: 'דנה', external_id: 'P-1' })
  const dance = makeAction({ code: 'A-1', points: 15 })
  const trophy = makeReward({ name: 'גביע', required_points: 10 })
  const pack = startGame({ participants: [dana], actions: [dance], rewards: [trophy] })

  await scan(pack.event.id, dana.id, dance.id, 15)

  const earned = (await supabase.rpc('check_and_award_rewards', { p_participant_id: dana.id }))
    .data as { out_reward_id: string }[]
  assert.deepEqual(earned.map((r) => r.out_reward_id), [trophy.id])

  // Asked twice: a prize already held is not handed out again.
  const again = (await supabase.rpc('check_and_award_rewards', { p_participant_id: dana.id }))
    .data as unknown[]
  assert.equal(again.length, 0)

  const awards = (
    await supabase
      .from('participant_rewards')
      .select('id, participant_id, score_at_award, awarded_at, participant:participants(name), reward:rewards(name)')
      .eq('event_id', pack.event.id)
      .order('awarded_at', { ascending: false })
  ).data as { participant: { name: string }; reward: { name: string }; score_at_award: number }[]
  assert.equal(awards.length, 1)
  assert.equal(awards[0].participant.name, 'דנה')
  assert.equal(awards[0].reward.name, 'גביע')
  assert.equal(awards[0].score_at_award, 15)
})

test('deleting a scan takes back the prize it paid for', async () => {
  const dana = makeParticipant({ name: 'דנה', external_id: 'P-1' })
  const dance = makeAction({ name: 'ריקוד', code: 'A-1', points: 15 })
  const trophy = makeReward({ name: 'גביע', required_points: 10 })
  const pack = startGame({ participants: [dana], actions: [dance], rewards: [trophy] })

  const txId = await scan(pack.event.id, dana.id, dance.id, 15)
  await supabase.rpc('check_and_award_rewards', { p_participant_id: dana.id })

  const preview = (await supabase.rpc('preview_delete_event_scan', { p_transaction_id: txId }))
    .data as {
    participant_name: string
    deleted_points: number
    new_total: number
    revoked_rewards: { reward_name: string }[]
  }
  assert.equal(preview.participant_name, 'דנה')
  assert.equal(preview.deleted_points, 15)
  assert.equal(preview.new_total, 0)
  assert.deepEqual(preview.revoked_rewards.map((r) => r.reward_name), ['גביע'])

  await supabase.rpc('delete_event_scan', { p_transaction_id: txId, p_transfers: [] })

  const board = (await supabase.rpc('get_participant_leaderboard')).data as {
    total_points: number
  }[]
  assert.equal(board[0].total_points, 0)
  const awards = (await supabase.from('participant_rewards').select('*')).data as unknown[]
  assert.equal(awards.length, 0)
})

test('a scan is announced on the channel the kiosk listens to', async () => {
  const dana = makeParticipant({ external_id: 'P-1' })
  const dance = makeAction({ code: 'A-1', points: 5 })
  const pack = startGame({ participants: [dana], actions: [dance] })

  let heard = 0
  const channel = supabase
    .channel('kiosk_transactions')
    .on('postgres_changes', { event: 'INSERT', table: 'point_transactions' }, () => {
      heard += 1
    })
    .subscribe()

  await scan(pack.event.id, dana.id, dance.id, 5)
  assert.equal(heard, 1)

  supabase.removeChannel(channel)
  await scan(pack.event.id, dana.id, dance.id, 5)
  assert.equal(heard, 1, 'a removed channel stops hearing')
})

test('the game survives a reload: scans and prizes come back', async () => {
  const dana = makeParticipant({ external_id: 'P-1' })
  const dance = makeAction({ code: 'A-1', points: 15 })
  const trophy = makeReward({ required_points: 10 })
  const pack = startGame({ participants: [dana], actions: [dance], rewards: [trophy] })

  await scan(pack.event.id, dana.id, dance.id, 15)
  await supabase.rpc('check_and_award_rewards', { p_participant_id: dana.id })

  // What opening the file again does - same storage, fresh in-memory state.
  initOfflineData(pack)

  const board = (await supabase.rpc('get_participant_leaderboard')).data as {
    total_points: number
  }[]
  assert.equal(board[0].total_points, 15)
  const awards = (await supabase.from('participant_rewards').select('*')).data as unknown[]
  assert.equal(awards.length, 1)
})

test('two games on one machine do not read each other', async () => {
  const dana = makeParticipant({ external_id: 'P-1' })
  const dance = makeAction({ code: 'A-1', points: 15 })
  store.clear()

  const first = makePack({
    event: { id: 'evt-a', name: 'משחק א', logo_url: null },
    participants: [dana],
    actions: [dance],
  })
  initOfflineData(first)
  await scan(first.event.id, dana.id, dance.id, 15)

  const second = makePack({
    event: { id: 'evt-b', name: 'משחק ב', logo_url: null },
    participants: [dana],
    actions: [dance],
  })
  initOfflineData(second)
  const board = (await supabase.rpc('get_participant_leaderboard')).data as {
    total_points: number
  }[]
  assert.equal(board[0].total_points, 0)

  initOfflineData(first)
  const back = (await supabase.rpc('get_participant_leaderboard')).data as {
    total_points: number
  }[]
  assert.equal(back[0].total_points, 15)
})
