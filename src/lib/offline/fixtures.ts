import type { Action, Group, Participant, Reward } from '@/types'
import type { GamePack, GameState } from './types'

/** Test helpers: build a pack and state without repeating boilerplate in every test. */

let seq = 0
const id = (prefix: string) => `${prefix}-${++seq}`

export function makeGroup(over: Partial<Group> = {}): Group {
  return {
    id: id('g'),
    event_id: 'evt',
    name: 'קבוצה',
    color: '#AB3500',
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: '2026-07-16T00:00:00.000Z',
    ...over,
  }
}

export function makeParticipant(over: Partial<Participant> = {}): Participant {
  return {
    id: id('p'),
    event_id: 'evt',
    external_id: over.external_id ?? id('P'),
    name: 'משתתף',
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: '2026-07-16T00:00:00.000Z',
    ...over,
  }
}

export function makeAction(over: Partial<Action> = {}): Action {
  return {
    id: id('a'),
    event_id: 'evt',
    code: over.code ?? id('A'),
    name: 'משימה',
    points: 10,
    description: null,
    is_active: true,
    max_completions: null,
    daily_limit: false,
    daily_start_hour: null,
    daily_start_minute: null,
    daily_end_hour: null,
    daily_end_minute: null,
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: '2026-07-16T00:00:00.000Z',
    ...over,
  }
}

export function makeReward(over: Partial<Reward> = {}): Reward {
  return {
    id: id('r'),
    event_id: 'evt',
    name: 'פרס',
    required_points: 20,
    is_active: true,
    target_type: 'all',
    target_participant_id: null,
    winner_mode: 'all',
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: '2026-07-16T00:00:00.000Z',
    ...over,
  }
}

export function makePack(over: Partial<GamePack> = {}): GamePack {
  return {
    version: 1,
    exportedAt: '2026-07-16T00:00:00.000Z',
    event: { id: 'evt', name: 'אירוע', logo_url: null },
    groups: [],
    participants: [],
    participantGroups: [],
    actions: [],
    actionGroups: [],
    rewards: [],
    rewardGroups: [],
    ...over,
  }
}

export function emptyState(): GameState {
  return { scans: [], awards: [] }
}
