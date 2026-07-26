import assert from 'node:assert/strict'
import test from 'node:test'
import {
  featureOrigin,
  findFlag,
  isFeatureOn,
  planFeatureDefaults,
  planIncludesFlag,
  resolveEventFeatures,
  suggestFlagKey,
  summariseOverrides,
  FEATURE_KEY_PATTERN,
  type EventFeatureOverride,
  type FeatureCatalog,
  type FeatureFlag,
} from './eventFeatures.ts'

function flag(key: string, overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    key,
    label: key,
    description: '',
    default_plans: [],
    is_active: true,
    sort_order: 0,
    ...overrides,
  }
}

/**
 * `sold_separately` is the normal shape of a flag - no plan includes it, it is
 * sold per game. `in_big_plans` is one attached to products, and `retired` is
 * one switched off in the admin panel.
 */
const CATALOG: FeatureCatalog = [
  flag('sold_separately'),
  flag('in_big_plans', { default_plans: ['full', 'organizations'] }),
  flag('retired', { default_plans: ['full'], is_active: false }),
]

function override(
  feature_key: string,
  enabled: boolean,
  price_ils: number | null = null,
): EventFeatureOverride {
  return { feature_key, enabled, note: null, price_ils }
}

test('an empty catalogue resolves to nothing, for every plan', () => {
  // The state the app ships in: no flag exists, so no area can be gated off.
  assert.deepEqual(resolveEventFeatures([], 'free', []), {})
  assert.deepEqual(resolveEventFeatures([], 'full', [override('anything', true)]), {})
})

test('plan defaults come from the catalogue', () => {
  assert.deepEqual(planFeatureDefaults(CATALOG, 'independent'), {
    sold_separately: false,
    in_big_plans: false,
  })
  assert.deepEqual(planFeatureDefaults(CATALOG, 'full'), {
    sold_separately: false,
    in_big_plans: true,
  })
})

test('a retired flag is off everywhere, whatever its products say', () => {
  assert.equal(planIncludesFlag(CATALOG, 'full', 'retired'), false)
  assert.equal('retired' in planFeatureDefaults(CATALOG, 'full'), false)
  // even for a game that was sold it before it was retired
  const features = resolveEventFeatures(CATALOG, 'independent', [override('retired', true)])
  assert.equal(isFeatureOn(features, 'retired'), false)
})

test('no overrides leaves the plan untouched', () => {
  assert.deepEqual(resolveEventFeatures(CATALOG, 'full', []), planFeatureDefaults(CATALOG, 'full'))
  assert.deepEqual(resolveEventFeatures(CATALOG, 'full', null), planFeatureDefaults(CATALOG, 'full'))
})

test('an override grants a flag the plan does not include', () => {
  const features = resolveEventFeatures(CATALOG, 'independent', [override('sold_separately', true)])
  assert.equal(isFeatureOn(features, 'sold_separately'), true)
  // and only that one
  assert.equal(isFeatureOn(features, 'in_big_plans'), false)
})

test('an override withholds a flag the plan does include', () => {
  const features = resolveEventFeatures(CATALOG, 'full', [override('in_big_plans', false)])
  assert.equal(isFeatureOn(features, 'in_big_plans'), false)
})

test('a row naming a flag that no longer exists changes nothing', () => {
  const features = resolveEventFeatures(
    CATALOG,
    'independent',
    [override('deleted_flag', true), override('sold_separately', true)],
  )
  assert.deepEqual(features, {
    ...planFeatureDefaults(CATALOG, 'independent'),
    sold_separately: true,
  })
})

test('isFeatureOn treats an undefined key as off', () => {
  assert.equal(isFeatureOn({}, 'never_defined'), false)
  assert.equal(isFeatureOn({ a: false }, 'a'), false)
})

test('origin distinguishes a granted flag from a plan default', () => {
  assert.equal(featureOrigin(CATALOG, 'independent', 'sold_separately', undefined), 'plan_off')
  assert.equal(
    featureOrigin(CATALOG, 'independent', 'sold_separately', override('sold_separately', true)),
    'granted',
  )
  assert.equal(featureOrigin(CATALOG, 'full', 'in_big_plans', undefined), 'plan')
  // A redundant "yes" on a plan that already includes it is not an extra.
  assert.equal(
    featureOrigin(CATALOG, 'full', 'in_big_plans', override('in_big_plans', true)),
    'plan',
  )
  assert.equal(
    featureOrigin(CATALOG, 'full', 'in_big_plans', override('in_big_plans', false)),
    'withheld',
  )
})

test('summary counts extras and adds up only what was granted', () => {
  const summary = summariseOverrides(CATALOG, 'full', [
    override('sold_separately', true, 250),
    override('in_big_plans', false, 999), // withheld - not income
    override('retired', true, 400), // switched off - not counted
    override('deleted_flag', true, 5000), // no such flag - ignored
  ])
  assert.deepEqual(summary, { granted: 1, withheld: 1, totalPriceIls: 250 })
})

test('summary of a game with nothing agreed separately is empty', () => {
  assert.deepEqual(summariseOverrides(CATALOG, 'full', []), {
    granted: 0,
    withheld: 0,
    totalPriceIls: 0,
  })
})

test('findFlag returns undefined rather than throwing on an unknown key', () => {
  assert.equal(findFlag(CATALOG, 'nope'), undefined)
  assert.equal(findFlag(CATALOG, 'sold_separately')?.key, 'sold_separately')
})

test('suggested keys are always ones the database will accept', () => {
  assert.equal(suggestFlagKey('Custom Leaderboard'), 'custom_leaderboard')
  assert.equal(suggestFlagKey('  Spaced  Out!  '), 'spaced_out')
  // A Hebrew label cannot produce a key - better empty than a guess.
  assert.equal(suggestFlagKey('לוח תוצאות'), '')
  assert.equal(suggestFlagKey('123 numbers first'), '')
  for (const label of ['Custom Leaderboard', 'a b', 'Team Mode 2']) {
    const key = suggestFlagKey(label)
    assert.match(key, FEATURE_KEY_PATTERN, `"${label}" -> "${key}"`)
  }
})
