import test from 'node:test'
import assert from 'node:assert/strict'
import {
  competingGroups,
  countCompetingGroups,
  groupPurpose,
  groupPurposeBadge,
  isCompetingGroup,
  isDistributionGroup,
  isMissingGroupPurposeError,
} from './groupPurpose.ts'

/** A group as it arrives from a database that has not run 090. */
const legacy = {}

test('a group with no purpose competes - that is what every group was', () => {
  assert.equal(groupPurpose(legacy), 'competition')
  assert.equal(isCompetingGroup(legacy), true)
  assert.equal(isDistributionGroup(legacy), false)
})

test('null and undefined read as competing, not as an error', () => {
  assert.equal(groupPurpose(null), 'competition')
  assert.equal(groupPurpose(undefined), 'competition')
})

test('only distribution is left off the leaderboard', () => {
  assert.equal(isCompetingGroup({ purpose: 'competition' }), true)
  assert.equal(isCompetingGroup({ purpose: 'distribution' }), false)
  assert.equal(isDistributionGroup({ purpose: 'distribution' }), true)
})

test('a purpose this build does not know still competes', () => {
  // Mirrors the RPC's `<> distribution`: a group missing from the board reads
  // as lost points, which is worse than one row too many.
  const future = { purpose: 'seeded' } as unknown as { purpose?: never }
  assert.equal(isCompetingGroup(future), true)
})

test('splitting a roster keeps the order it came in', () => {
  const groups = [
    { id: '1', purpose: 'competition' as const },
    { id: '2', purpose: 'distribution' as const },
    { id: '3', purpose: 'competition' as const },
  ]

  assert.deepEqual(competingGroups(groups).map((g) => g.id), ['1', '3'])
  assert.equal(countCompetingGroups(groups), 2)
})

test('only the distribution group carries a badge', () => {
  assert.equal(groupPurposeBadge({ purpose: 'distribution' }), 'קבוצת חלוקה')
  assert.equal(groupPurposeBadge({ purpose: 'competition' }), null)
  assert.equal(groupPurposeBadge(legacy), null)
})

test('recognises a database that has not run 090', () => {
  assert.equal(
    isMissingGroupPurposeError("column groups.purpose does not exist"),
    true,
  )
  assert.equal(
    isMissingGroupPurposeError("Could not find the 'purpose' column of 'groups' in the schema cache"),
    true,
  )
  // Anything else is a real failure and must not be dressed up as a missing migration.
  assert.equal(isMissingGroupPurposeError('duplicate key value violates unique constraint'), false)
  assert.equal(isMissingGroupPurposeError('column groups.color does not exist'), false)
  assert.equal(isMissingGroupPurposeError(null), false)
})
