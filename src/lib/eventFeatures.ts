import type { UserPlan } from '@/types'

/**
 * Feature flags, per game.
 *
 * Two tables, two questions:
 *   feature_flags  (076) - what flags exist, and which products include them
 *   event_features (075) - which game was sold which, and for how much
 *
 * A flag is created and described in the admin panel, not in code, so shipping
 * one needs no deploy. Code decides what a flag *does*: gate an area on
 * <FeatureGate flag="my_flag"> or useFeatureFlag('my_flag'), and until the
 * matching row exists in the catalogue that area is simply off.
 *
 * Resolution order for one game: the flag's default_plans decide the baseline,
 * and a row in event_features overrides it either way - granting an extra that
 * was paid for, or withholding something the plan would include.
 *
 * Everything here is pure and takes the catalogue as its first argument; the
 * catalogue itself is loaded by useFeatureCatalog / useEventFeatures.
 */

/** A row of `feature_flags`. */
export interface FeatureFlag {
  key: string
  label: string
  description: string
  /** Products that include this flag with no per-game row. Usually empty. */
  default_plans: UserPlan[]
  /** Retired flags resolve off everywhere but keep their history. */
  is_active: boolean
  sort_order: number
}

export type FeatureCatalog = readonly FeatureFlag[]

/** A row of `event_features` - one game's exception to the plan default. */
export interface EventFeatureOverride {
  feature_key: string
  enabled: boolean
  note: string | null
  price_ils: number | null
  updated_at?: string
}

/** Resolved answer per flag key. Missing key = the flag does not apply. */
export type EventFeatureSet = Record<string, boolean>

/** Reads a flag safely: one nobody defined is off, never undefined. */
export function isFeatureOn(features: EventFeatureSet, key: string): boolean {
  return features[key] === true
}

/** Flags an operator can act on - retired ones are history, not choices. */
export function activeFlags(catalog: FeatureCatalog): FeatureFlag[] {
  return catalog.filter((f) => f.is_active)
}

export function findFlag(catalog: FeatureCatalog, key: string): FeatureFlag | undefined {
  return catalog.find((f) => f.key === key)
}

/** Only an active flag counts; an unknown or retired key is never "included". */
export function planIncludesFlag(catalog: FeatureCatalog, plan: UserPlan, key: string): boolean {
  const flag = findFlag(catalog, key)
  if (!flag || !flag.is_active) return false
  return flag.default_plans.includes(plan)
}

/** Plan defaults with no overrides applied - what a brand new game gets. */
export function planFeatureDefaults(catalog: FeatureCatalog, plan: UserPlan): EventFeatureSet {
  return Object.fromEntries(
    activeFlags(catalog).map((f) => [f.key, f.default_plans.includes(plan)]),
  )
}

/**
 * Plan defaults, then overrides on top.
 *
 * Rows whose flag is unknown or retired are skipped. A row can outlive the
 * flag it names - a flag deleted while its cascade had not reached every row,
 * or one switched off - and neither case should quietly widen or narrow what a
 * game can do.
 */
export function resolveEventFeatures(
  catalog: FeatureCatalog,
  plan: UserPlan,
  overrides: readonly EventFeatureOverride[] | null | undefined,
): EventFeatureSet {
  const features = planFeatureDefaults(catalog, plan)
  for (const row of overrides ?? []) {
    const flag = findFlag(catalog, row.feature_key)
    if (!flag || !flag.is_active) continue
    features[row.feature_key] = row.enabled
  }
  return features
}

/** How one flag ended up where it is - drives the admin panel's chips. */
export type FeatureOrigin = 'plan' | 'granted' | 'withheld' | 'plan_off'

export function featureOrigin(
  catalog: FeatureCatalog,
  plan: UserPlan,
  key: string,
  override: EventFeatureOverride | undefined,
): FeatureOrigin {
  const byPlan = planIncludesFlag(catalog, plan, key)
  if (!override) return byPlan ? 'plan' : 'plan_off'
  if (override.enabled) return byPlan ? 'plan' : 'granted'
  return byPlan ? 'withheld' : 'plan_off'
}

export const FEATURE_ORIGIN_LABELS: Record<FeatureOrigin, string> = {
  plan: 'כלול בתוכנית',
  granted: 'נוסף למשחק',
  withheld: 'הוסר מהמשחק',
  plan_off: 'לא נמכר למשחק',
}

/**
 * Counts for the admin games list: how many flags were granted on top of the
 * plan, and how many plan features were taken away.
 */
export function summariseOverrides(
  catalog: FeatureCatalog,
  plan: UserPlan,
  overrides: readonly EventFeatureOverride[],
): { granted: number; withheld: number; totalPriceIls: number } {
  let granted = 0
  let withheld = 0
  let totalPriceIls = 0
  for (const row of overrides) {
    const flag = findFlag(catalog, row.feature_key)
    if (!flag || !flag.is_active) continue
    const origin = featureOrigin(catalog, plan, row.feature_key, row)
    if (origin === 'granted') {
      granted += 1
      totalPriceIls += row.price_ils ?? 0
    } else if (origin === 'withheld') {
      withheld += 1
    }
  }
  return { granted, withheld, totalPriceIls }
}

/** Shape a flag key must have to be accepted by both tables' CHECK. */
export const FEATURE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,48}$/

/** Turns a typed label into a usable key, so the operator rarely types one. */
export function suggestFlagKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 49)
  // A Hebrew label slugs to nothing - leave the field empty rather than guess.
  return FEATURE_KEY_PATTERN.test(slug) ? slug : ''
}

/**
 * True when a caller should treat a read failure as "nothing here yet" rather
 * than an error: before 075/076 run, every read 404s and the right answer is
 * that no flag exists.
 */
export function isMissingFeatureTableError(message: string | null | undefined): boolean {
  if (!message) return false
  const missing = message.includes('does not exist') || message.includes('schema cache')
  return missing && (message.includes('event_features') || message.includes('feature_flags'))
}
