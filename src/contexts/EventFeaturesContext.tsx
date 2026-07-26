import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useEventFeatures } from '@/hooks/useEventFeatures'
import { isFeatureOn, type EventFeatureSet, type FeatureCatalog } from '@/lib/eventFeatures'
import type { UserPlan } from '@/types'

/**
 * Makes an area of the app depend on a feature flag.
 *
 * Wrap a game's screens once:
 *
 *   <EventFeaturesProvider eventId={event.id} plan={event.plan}>
 *     …
 *   </EventFeaturesProvider>
 *
 * and anywhere inside, however deep, gate on a flag by key:
 *
 *   <FeatureGate flag="my_flag">
 *     <TheNewThing />
 *   </FeatureGate>
 *
 *   const on = useFeatureFlag('my_flag')      // when you need the boolean
 *
 * The key is the one created in the admin panel. Until a flag with that key
 * exists and the game has it, the area is off - which is why gating something
 * before its flag exists hides it, rather than crashing.
 *
 * Nothing here fetches per gate: the provider reads once through
 * useEventFeatures, which shares a module-level cache across the whole app.
 */

interface EventFeaturesContextValue {
  eventId: string | undefined
  plan: UserPlan | undefined
  features: EventFeatureSet
  catalog: FeatureCatalog
  /** True until both the catalogue and this game's overrides have arrived. */
  loading: boolean
}

const EventFeaturesContext = createContext<EventFeaturesContextValue | null>(null)

interface EventFeaturesProviderProps {
  eventId: string | undefined
  plan: UserPlan | undefined
  children: ReactNode
}

export function EventFeaturesProvider({ eventId, plan, children }: EventFeaturesProviderProps) {
  const { features, catalog, loading } = useEventFeatures(eventId, plan)

  const value = useMemo<EventFeaturesContextValue>(
    () => ({ eventId, plan, features, catalog, loading }),
    [eventId, plan, features, catalog, loading],
  )

  return <EventFeaturesContext.Provider value={value}>{children}</EventFeaturesContext.Provider>
}

/**
 * Everything the provider knows. Returns null outside one, so a shared
 * component can be gated and still render on a screen that has no game.
 */
export function useEventFeaturesContext(): EventFeaturesContextValue | null {
  return useContext(EventFeaturesContext)
}

export interface FeatureFlagState {
  /** The flag is on for this game. False while still loading. */
  on: boolean
  loading: boolean
}

/**
 * One flag's state, with its loading flag - for gates that must not flash.
 * Outside a provider it reads as off, never as an error.
 */
export function useFeatureFlagState(key: string): FeatureFlagState {
  const ctx = useContext(EventFeaturesContext)
  if (!ctx) return { on: false, loading: false }
  return { on: !ctx.loading && isFeatureOn(ctx.features, key), loading: ctx.loading }
}

/** The common case: is this flag on for the current game? */
export function useFeatureFlag(key: string): boolean {
  return useFeatureFlagState(key).on
}

interface FeatureGateProps {
  /** The flag key, as created in the admin panel. */
  flag: string
  children: ReactNode
  /** Rendered instead when the flag is off. Nothing by default. */
  fallback?: ReactNode
  /**
   * What to show while the flag is still resolving. Defaults to the fallback,
   * so an area never appears and then disappears - which for something the
   * customer did not buy would read as it being taken away.
   */
  pending?: ReactNode
}

export function FeatureGate({ flag, children, fallback = null, pending }: FeatureGateProps) {
  const { on, loading } = useFeatureFlagState(flag)
  if (loading) return <>{pending ?? fallback}</>
  return <>{on ? children : fallback}</>
}
