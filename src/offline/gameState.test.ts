import test from 'node:test'
import assert from 'node:assert/strict'
import { getParticipantTotal } from '../lib/offline/leaderboard.ts'
import { makePack, makeParticipant } from '../lib/offline/fixtures.ts'
import { loadGameState, storageKeyFor } from './gameState.ts'

const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
})

test('a game saved with lottery rows in its scan log comes back scored', () => {
  const participant = makeParticipant()
  const pack = makePack({ participants: [participant] })

  store.set(
    storageKeyFor(pack.event.id),
    JSON.stringify({
      scans: [
        {
          clientTxId: 'tx-1',
          participantId: participant.id,
          actionId: 'a',
          points: 10,
          createdAt: '2026-07-20T10:00:00.000Z',
        },
        // What the old shim wrote for an entrant of a draw: a real participant,
        // no points at all - which made their total NaN.
        { clientTxId: 'tx-2', participantId: participant.id, createdAt: '2026-07-20T11:00:00.000Z' },
        // And for the draw row itself, which has no participant either.
        { clientTxId: 'tx-3', createdAt: '2026-07-20T11:00:00.000Z' },
      ],
      awards: [],
    }),
  )

  const state = loadGameState(pack)
  assert.equal(state.scans.length, 1)
  assert.equal(getParticipantTotal(state.scans, participant.id), 10)
  assert.deepEqual(state.draws, [])
})

test('a saved game with no draws yet loads as one with none', () => {
  const pack = makePack()
  store.set(storageKeyFor(pack.event.id), JSON.stringify({ scans: [], awards: [] }))
  assert.deepEqual(loadGameState(pack), { scans: [], awards: [], draws: [] })
})
