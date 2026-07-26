import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  isMissingFeatureTableError,
  planFeatureDefaults,
  resolveEventFeatures,
  type EventFeatureOverride,
  type EventFeatureSet,
  type FeatureCatalog,
  type FeatureFlag,
} from '@/lib/eventFeatures'
import type { UserPlan } from '@/types'

const OVERRIDE_COLUMNS = 'feature_key, enabled, note, price_ils, updated_at'
const FLAG_COLUMNS = 'key, label, description, default_plans, is_active, sort_order'

const EMPTY_CATALOG: FeatureCatalog = []

/**
 * Both halves are cached module-wide and shared.
 *
 * The catalogue is one small list for the whole app, and a game's overrides are
 * read by whichever screen happens to gate on them - the control center, the
 * kiosk, a single button somewhere. Without a shared cache, four components
 * mounting together would issue the same queries, and a gated area would flash
 * on and off while they resolved.
 *
 * Nothing expires on its own; the admin panel invalidates explicitly after a
 * change. Flags do not move by themselves during a session.
 */
let catalogCache: FeatureCatalog | null = null
let catalogInflight: Promise<FeatureCatalog> | null = null
const overridesCache = new Map<string, EventFeatureOverride[]>()
const overridesInflight = new Map<string, Promise<EventFeatureOverride[]>>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

function toFlag(row: Record<string, unknown>): FeatureFlag {
  return {
    key: String(row.key),
    label: String(row.label ?? ''),
    description: String(row.description ?? ''),
    default_plans: (row.default_plans as UserPlan[] | null) ?? [],
    is_active: row.is_active !== false,
    sort_order: Number(row.sort_order ?? 0),
  }
}

/** The whole catalogue, cached. A missing table means "no flags exist". */
export function loadFeatureCatalog(): Promise<FeatureCatalog> {
  if (catalogCache) return Promise.resolve(catalogCache)
  if (catalogInflight) return catalogInflight

  catalogInflight = (async () => {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select(FLAG_COLUMNS)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true })
      if (error && !isMissingFeatureTableError(error.message)) throw error
      const flags = ((data ?? []) as Record<string, unknown>[]).map(toFlag)
      catalogCache = flags
      return flags
    } finally {
      catalogInflight = null
    }
  })()

  return catalogInflight
}

/** Cached read of one game's overrides. Missing table / no rows both mean []. */
export function loadEventFeatureOverrides(eventId: string): Promise<EventFeatureOverride[]> {
  const cached = overridesCache.get(eventId)
  if (cached) return Promise.resolve(cached)

  const pending = overridesInflight.get(eventId)
  if (pending) return pending

  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('event_features')
        .select(OVERRIDE_COLUMNS)
        .eq('event_id', eventId)
      if (error && !isMissingFeatureTableError(error.message)) throw error
      const rows = (data ?? []) as EventFeatureOverride[]
      overridesCache.set(eventId, rows)
      return rows
    } finally {
      overridesInflight.delete(eventId)
    }
  })()

  overridesInflight.set(eventId, promise)
  return promise
}

/**
 * Overrides for many games at once, for admin lists. Not cached: the admin
 * panel wants a fresh picture every time it loads, and it holds the whole set.
 */
export async function fetchEventFeatureOverrides(
  eventIds: readonly string[],
): Promise<Record<string, EventFeatureOverride[]>> {
  if (eventIds.length === 0) return {}

  const { data, error } = await supabase
    .from('event_features')
    .select(`event_id, ${OVERRIDE_COLUMNS}`)
    .in('event_id', eventIds)

  if (error) {
    if (isMissingFeatureTableError(error.message)) return {}
    throw error
  }

  const byEvent: Record<string, EventFeatureOverride[]> = {}
  for (const row of (data ?? []) as (EventFeatureOverride & { event_id: string })[]) {
    ;(byEvent[row.event_id] ??= []).push(row)
  }
  return byEvent
}

/** Drop cached flags and re-render every reader. Call after an admin change. */
export function invalidateFeatureCatalog() {
  catalogCache = null
  catalogInflight = null
  notify()
}

/** Drop one game's cached overrides (or all of them) and re-render readers. */
export function invalidateEventFeatures(eventId?: string) {
  if (eventId) {
    overridesCache.delete(eventId)
    overridesInflight.delete(eventId)
  } else {
    overridesCache.clear()
    overridesInflight.clear()
  }
  notify()
}

/** Re-runs `read` whenever anything is invalidated, and on unmount cleans up. */
function useInvalidatingEffect(read: () => () => void) {
  useEffect(() => {
    let cleanup = read()
    const onInvalidate = () => {
      cleanup()
      cleanup = read()
    }
    listeners.add(onInvalidate)
    return () => {
      listeners.delete(onInvalidate)
      cleanup()
    }
  }, [read])
}

export interface UseFeatureCatalogResult {
  catalog: FeatureCatalog
  loading: boolean
  /** Re-read from the server, e.g. after the admin edits a flag. */
  refresh: () => void
}

/** The flag catalogue on its own, for screens that do not have a game. */
export function useFeatureCatalog(): UseFeatureCatalogResult {
  const [catalog, setCatalog] = useState<FeatureCatalog>(() => catalogCache ?? EMPTY_CATALOG)
  const [loading, setLoading] = useState(() => catalogCache == null)

  const read = useCallback(() => {
    let cancelled = false
    if (catalogCache) {
      setCatalog(catalogCache)
      setLoading(false)
      return () => { cancelled = true }
    }
    setLoading(true)
    loadFeatureCatalog()
      .then((flags) => { if (!cancelled) setCatalog(flags) })
      .catch(() => { if (!cancelled) setCatalog(EMPTY_CATALOG) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useInvalidatingEffect(read)

  return { catalog, loading, refresh: invalidateFeatureCatalog }
}

export interface UseEventFeaturesResult {
  /** Plan defaults with overrides applied. Plan defaults while still loading. */
  features: EventFeatureSet
  catalog: FeatureCatalog
  overrides: EventFeatureOverride[]
  loading: boolean
}

/**
 * Effective flags for one game.
 *
 * `features` falls back to the plan defaults while the overrides are in
 * flight, so a gate never renders as "locked" before we know better - the only
 * thing that can flicker is a flag granted as an extra. Screens that must not
 * flicker at all can wait on `loading`; <FeatureGate> does that for you.
 */
export function useEventFeatures(
  eventId: string | undefined,
  plan: UserPlan | undefined,
): UseEventFeaturesResult {
  const { catalog, loading: catalogLoading } = useFeatureCatalog()
  const [overrides, setOverrides] = useState<EventFeatureOverride[]>(
    () => (eventId ? overridesCache.get(eventId) ?? [] : []),
  )
  const [loading, setLoading] = useState(() => !!eventId && !overridesCache.get(eventId))

  const read = useCallback(() => {
    if (!eventId) {
      setOverrides([])
      setLoading(false)
      return () => {}
    }

    let cancelled = false
    const cached = overridesCache.get(eventId)
    if (cached) {
      setOverrides(cached)
      setLoading(false)
      return () => { cancelled = true }
    }

    setLoading(true)
    loadEventFeatureOverrides(eventId)
      .then((rows) => { if (!cancelled) setOverrides(rows) })
      .catch(() => {
        // A game whose flags cannot be read falls back to its plan - the same
        // capabilities it had before this system existed.
        if (!cancelled) setOverrides([])
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [eventId])

  useInvalidatingEffect(read)

  // Stable identity: resolving builds a fresh object, and this feeds a context
  // value, so recomputing on every render would re-render every gated area.
  const features = useMemo(
    () => (plan ? resolveEventFeatures(catalog, plan, overrides) : planFeatureDefaults(catalog, 'free')),
    [catalog, plan, overrides],
  )

  return {
    features,
    catalog,
    overrides,
    loading: loading || catalogLoading || !plan,
  }
}
