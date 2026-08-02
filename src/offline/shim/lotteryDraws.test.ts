import test from 'node:test'
import assert from 'node:assert/strict'
import { makeAction, makePack, makeParticipant } from '../../lib/offline/fixtures.ts'
import { initOfflineData } from './data.ts'
import { supabase } from './supabase.ts'

/**
 * The lottery, through the shim the offline player hands the real components.
 *
 * These cover the two halves of one regression: a draw used to be written into
 * the scan log, because every insert went to recordScan whatever table it was
 * aimed at. That gave each of its entrants a scan with no points, so their
 * total became NaN - which dropped them out of every later points lottery,
 * looking for all the world like the app was refusing to let them play twice -
 * and it left the management screen's lottery tab permanently empty.
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

/** Exactly what recordLotteryDraw() does when a winner is revealed. */
async function drawPrize(
  eventId: string,
  prizeName: string,
  entrants: { id: string; name: string }[],
) {
  const { data, error } = await supabase
    .from('lottery_draws')
    .insert({
      event_id: eventId,
      run_id: 'run-1',
      prize_name: prizeName,
      prize_icon: '🎁',
      eligibility_mode: 'min_points',
      min_points: 5,
      pool_label: null,
      entrant_count: entrants.length,
      winner_participant_id: entrants[0].id,
      winner_name: entrants[0].name,
      draw_index: 0,
    })
    .select('id')
    .single()

  assert.equal(error, null)
  const { error: entrantsError } = await supabase.from('lottery_draw_entrants').insert(
    entrants.map((p) => ({
      draw_id: (data as { id: string }).id,
      participant_id: p.id,
      participant_name: p.name,
    })),
  )
  assert.equal(entrantsError, null)
}

function startGame() {
  const participant = makeParticipant({ name: 'אלישבע' })
  const action = makeAction({ points: 10 })
  const pack = makePack({ participants: [participant], actions: [action] })
  store.clear()
  initOfflineData(pack)
  return { pack, participant, action }
}

async function totalFor(participantId: string): Promise<number> {
  const { data } = await supabase.rpc('get_participant_leaderboard')
  const rows = data as { participant_id: string; total_points: number }[]
  return rows.find((r) => r.participant_id === participantId)!.total_points
}

test('a draw leaves its entrants scored, and eligible for the next lottery', async () => {
  const { pack, participant, action } = startGame()
  await supabase.from('point_transactions').insert({
    event_id: pack.event.id,
    participant_id: participant.id,
    action_id: action.id,
    points: 10,
  })

  await drawPrize(pack.event.id, 'שי ראשון', [{ id: participant.id, name: participant.name }])
  assert.equal(await totalFor(participant.id), 10)

  // The second lottery of the event - the one the field report said refused
  // anyone who had been in the first.
  await drawPrize(pack.event.id, 'שי שני', [{ id: participant.id, name: participant.name }])
  assert.equal(await totalFor(participant.id), 10)

  const { data: scans } = await supabase.from('point_transactions').select('*')
  assert.equal((scans as unknown[]).length, 1)
})

test('the draws read back the way the management tab asks for them', async () => {
  const { pack, participant } = startGame()
  await drawPrize(pack.event.id, 'שי', [{ id: participant.id, name: participant.name }])

  const { data, error } = await supabase
    .from('lottery_draws')
    .select(
      'id, run_id, prize_name, entrant_count, winner_name, drawn_at,' +
        ' entrants:lottery_draw_entrants(participant_id, participant_name)',
    )
    .eq('event_id', pack.event.id)
    .order('drawn_at', { ascending: false })

  assert.equal(error, null)
  const rows = data as {
    run_id: string
    prize_name: string
    entrant_count: number
    winner_name: string
    entrants: { participant_id: string; participant_name: string }[]
  }[]
  assert.equal(rows.length, 1)
  assert.equal(rows[0].prize_name, 'שי')
  assert.equal(rows[0].run_id, 'run-1')
  assert.equal(rows[0].entrant_count, 1)
  assert.equal(rows[0].winner_name, participant.name)
  assert.deepEqual(rows[0].entrants, [
    { participant_id: participant.id, participant_name: participant.name },
  ])
})

test('a write to a table the shim does not have fails instead of becoming a scan', async () => {
  const { pack } = startGame()

  const { error } = await supabase.from('scanner_bookings').insert({ event_id: pack.event.id })
  assert.equal((error as { code: string }).code, '42P01')

  const { data: scans } = await supabase.from('point_transactions').select('*')
  assert.equal((scans as unknown[]).length, 0)
})
