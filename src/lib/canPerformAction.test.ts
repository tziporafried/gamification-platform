import test from 'node:test'
import assert from 'node:assert/strict'
import { canPerformAction } from './canPerformAction.ts'

/**
 * The rules that decide whether a scan is allowed at all.
 *
 * One copy, asked by both scanning paths: useScoreSubmit online, and the same
 * hook offline over the supabase shim. These cases came from the exported
 * game's own engine, which was a second implementation of them; that engine is
 * gone and they belong here, against the function that actually runs.
 */

interface ActionOver {
  is_active?: boolean
  max_completions?: number | null
  daily_limit?: boolean
  daily_start_hour?: number | null
  daily_start_minute?: number | null
  daily_end_hour?: number | null
  daily_end_minute?: number | null
  allowedGroupIds?: string[]
}

function action(over: ActionOver = {}) {
  return {
    is_active: true,
    max_completions: null,
    daily_limit: false,
    daily_start_hour: null,
    daily_start_minute: null,
    daily_end_hour: null,
    daily_end_minute: null,
    allowedGroupIds: [],
    ...over,
  }
}

test('an ordinary task with nothing set is allowed, however many times', () => {
  for (const previousCompletions of [0, 1, 7]) {
    const result = canPerformAction({
      action: action(),
      participantGroupIds: [],
      previousCompletions,
    })
    assert.equal(result.allowed, true)
  }
})

test('max_completions=1 blocks the second scan', () => {
  const first = canPerformAction({
    action: action({ max_completions: 1 }),
    participantGroupIds: [],
    previousCompletions: 0,
  })
  assert.equal(first.allowed, true)

  const second = canPerformAction({
    action: action({ max_completions: 1 }),
    participantGroupIds: [],
    previousCompletions: 1,
  })
  assert.equal(second.allowed, false)
  assert.equal(second.reason, 'LIMIT_REACHED')
})

test('an inactive task is blocked', () => {
  const result = canPerformAction({
    action: action({ is_active: false }),
    participantGroupIds: [],
    previousCompletions: 0,
  })
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'ACTION_INACTIVE')
})

test('daily_limit blocks a second scan on the same Israel day', () => {
  const morning = new Date('2026-07-16T06:00:00.000Z')
  const evening = new Date('2026-07-16T18:00:00.000Z')

  const first = canPerformAction({
    action: action({ daily_limit: true }),
    participantGroupIds: [],
    previousCompletions: 0,
    previousCompletionsToday: 0,
    now: morning,
  })
  assert.equal(first.allowed, true)

  const second = canPerformAction({
    action: action({ daily_limit: true }),
    participantGroupIds: [],
    previousCompletions: 1,
    previousCompletionsToday: 1,
    now: evening,
  })
  assert.equal(second.allowed, false)
})

test('daily_limit lets the same task come round again the next day', () => {
  const nextDay = new Date('2026-07-17T06:00:00.000Z')
  const result = canPerformAction({
    action: action({ daily_limit: true }),
    participantGroupIds: [],
    previousCompletions: 1,
    previousCompletionsToday: 0,
    now: nextDay,
  })
  assert.equal(result.allowed, true)
})

test('a task outside its daily hours is blocked, and inside them is not', () => {
  const window = {
    daily_limit: true,
    daily_start_hour: 9,
    daily_start_minute: 0,
    daily_end_hour: 11,
    daily_end_minute: 0,
  }
  // 07:00 and 10:00 Israel time (UTC+3 in July).
  const tooEarly = new Date('2026-07-16T04:00:00.000Z')
  const inside = new Date('2026-07-16T07:00:00.000Z')

  const blocked = canPerformAction({
    action: action(window),
    participantGroupIds: [],
    previousCompletions: 0,
    now: tooEarly,
  })
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.reason, 'DAILY_HOURS_OUT_OF_RANGE')

  const allowed = canPerformAction({
    action: action(window),
    participantGroupIds: [],
    previousCompletions: 0,
    now: inside,
  })
  assert.equal(allowed.allowed, true)
})

test('a task aimed at groups refuses someone outside them', () => {
  const result = canPerformAction({
    action: action({ allowedGroupIds: ['g-other'] }),
    participantGroupIds: ['g-mine'],
    previousCompletions: 0,
  })
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'GROUP_NOT_ALLOWED')
})

test('a task aimed at groups allows a member of one of them', () => {
  const result = canPerformAction({
    action: action({ allowedGroupIds: ['g-a', 'g-b'] }),
    participantGroupIds: ['g-b'],
    previousCompletions: 0,
  })
  assert.equal(result.allowed, true)
})

test('a task aimed at no group in particular is open to everyone', () => {
  const result = canPerformAction({
    action: action({ allowedGroupIds: [] }),
    participantGroupIds: [],
    previousCompletions: 0,
  })
  assert.equal(result.allowed, true)
})
