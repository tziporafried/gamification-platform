import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, RotateCcw, Sparkles, SlidersHorizontal } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { formatPriceIls } from '@/lib/planPrices'
import { cn } from '@/lib/utils'
import {
  activeFlags,
  FEATURE_ORIGIN_LABELS,
  featureOrigin,
  isMissingFeatureTableError,
  planIncludesFlag,
  summariseOverrides,
  type EventFeatureOverride,
  type FeatureOrigin,
} from '@/lib/eventFeatures'
import { invalidateEventFeatures, useFeatureCatalog } from '@/hooks/useEventFeatures'
import type { UserPlan } from '@/types'

interface EventFeaturesPanelProps {
  eventId: string
  plan: UserPlan
  /** Fires after any change lands, so a parent list can refresh its summary. */
  onChanged?: () => void
  className?: string
}

const ORIGIN_COLORS: Record<FeatureOrigin, string> = {
  plan: 'var(--color-muted)',
  granted: 'var(--color-success)',
  withheld: 'var(--color-danger)',
  plan_off: 'var(--color-muted)',
}

const MISSING_TABLE_HINT =
  'טבלת הפיצ׳ר פלאגים עדיין לא הותקנה במסד הנתונים. הריצו את supabase/APPLY_EVENT_FEATURES.sql ורעננו.'

/**
 * Per-game feature flags, for a super admin.
 *
 * The plan sets the baseline and each switch here is an exception to it, so
 * flipping a switch back to what the plan already says deletes the row rather
 * than storing a redundant "yes" - that way the list of overrides stays a list
 * of things that were actually agreed separately.
 *
 * The catalogue is empty until the first flag ships, so the usual state of this
 * panel right now is the empty one below.
 */
export function EventFeaturesPanel({ eventId, plan, onChanged, className }: EventFeaturesPanelProps) {
  const { user } = useAuth()
  const { catalog, loading: catalogLoading } = useFeatureCatalog()
  const [overrides, setOverrides] = useState<EventFeatureOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableMissing, setTableMissing] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from('event_features')
      .select('feature_key, enabled, note, price_ils, updated_at')
      .eq('event_id', eventId)

    if (loadError) {
      if (isMissingFeatureTableError(loadError.message)) {
        setTableMissing(true)
        setOverrides([])
      } else {
        setError(loadError.message)
      }
      setLoading(false)
      return
    }
    setTableMissing(false)
    setOverrides((data ?? []) as EventFeatureOverride[])
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const overrideByKey = useMemo(() => {
    const map = new Map<string, EventFeatureOverride>()
    for (const row of overrides) map.set(row.feature_key, row)
    return map
  }, [overrides])

  const flags = useMemo(() => activeFlags(catalog), [catalog])
  const summary = useMemo(
    () => summariseOverrides(catalog, plan, overrides),
    [catalog, plan, overrides],
  )

  function flashSaved(key: string) {
    setSavedKey(key)
    window.setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1600)
  }

  function afterWrite() {
    invalidateEventFeatures(eventId)
    onChanged?.()
  }

  /** Writes an override, or clears it when the value matches the plan. */
  async function setFeature(key: string, enabled: boolean) {
    if (tableMissing) return
    setBusyKey(key)
    setError(null)

    if (planIncludesFlag(catalog, plan, key) === enabled) {
      const { error: delError } = await supabase
        .from('event_features')
        .delete()
        .eq('event_id', eventId)
        .eq('feature_key', key)
      setBusyKey(null)
      if (delError) {
        setError(delError.message)
        return
      }
      setOverrides((prev) => prev.filter((row) => row.feature_key !== key))
      flashSaved(key)
      afterWrite()
      return
    }

    const existing = overrideByKey.get(key)
    const row = {
      event_id: eventId,
      feature_key: key,
      enabled,
      note: existing?.note ?? null,
      price_ils: existing?.price_ils ?? null,
      set_by: user?.id ?? null,
    }
    const { error: upsertError } = await supabase
      .from('event_features')
      .upsert(row, { onConflict: 'event_id,feature_key' })
    setBusyKey(null)
    if (upsertError) {
      setError(upsertError.message)
      return
    }
    setOverrides((prev) => [
      ...prev.filter((r) => r.feature_key !== key),
      { feature_key: key, enabled, note: row.note, price_ils: row.price_ils },
    ])
    flashSaved(key)
    afterWrite()
  }

  /** Saves the deal details (price / note) on an override that already exists. */
  async function saveDetails(key: string, patch: { note?: string | null; price_ils?: number | null }) {
    const existing = overrideByKey.get(key)
    if (!existing) return
    const next = { ...existing, ...patch }
    if (next.note === existing.note && next.price_ils === existing.price_ils) return

    setBusyKey(key)
    setError(null)
    const { error: updateError } = await supabase
      .from('event_features')
      .update({ note: next.note ?? null, price_ils: next.price_ils ?? null, set_by: user?.id ?? null })
      .eq('event_id', eventId)
      .eq('feature_key', key)
    setBusyKey(null)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setOverrides((prev) => prev.map((r) => (r.feature_key === key ? next : r)))
    flashSaved(key)
    afterWrite()
  }

  if (loading || catalogLoading) {
    return (
      <div className={cn('flex items-center justify-center py-10', className)}>
        <Spinner />
      </div>
    )
  }

  if (flags.length === 0) {
    return (
      <div className={cn('py-8 text-center', className)}>
        <SlidersHorizontal size={26} className="mx-auto text-muted/50" aria-hidden="true" />
        <p className="mt-2.5 text-sm font-semibold text-foreground">עדיין אין פיצ׳ר פלאגים</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
          קודם מגדירים פיצ׳ר פלאג בלשונית "פיצ׳ר פלאגים" בפאנל הניהול, ואז אפשר
          למכור אותו למשחק הזה. בינתיים המשחק פועל לפי התוכנית שלו.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {tableMissing && (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning-text">
          {MISSING_TABLE_HINT}
        </p>
      )}
      {error && <ErrorAlert message={error} />}

      <p className="text-xs leading-relaxed text-muted">
        התוכנית קובעת את ברירת המחדל. כאן מוסיפים או מורידים פיצ׳ר פלאג למשחק הזה בלבד -
        לפי מה שסוכם עם הלקוח.
      </p>

      <div className="space-y-2">
        {flags.map((feature) => {
          const override = overrideByKey.get(feature.key)
          const origin = featureOrigin(catalog, plan, feature.key, override)
          const enabled = override ? override.enabled : planIncludesFlag(catalog, plan, feature.key)
          const busy = busyKey === feature.key

          return (
            <div
              key={feature.key}
              className={cn(
                'rounded-xl border px-3 py-2.5 transition-colors',
                origin === 'granted'
                  ? 'border-success/35 bg-success/[0.06]'
                  : origin === 'withheld'
                    ? 'border-danger/35 bg-danger/[0.06]'
                    : 'border-border bg-surface',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">{feature.label}</span>
                    <Badge
                      label={FEATURE_ORIGIN_LABELS[origin]}
                      color={ORIGIN_COLORS[origin]}
                      variant={origin === 'plan' || origin === 'plan_off' ? 'quiet' : 'subtle'}
                    />
                    {savedKey === feature.key && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-success-text">
                        <Check size={11} strokeWidth={2.5} />
                        נשמר
                      </span>
                    )}
                  </div>
                  {feature.description && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                      {feature.description}
                    </p>
                  )}
                </div>
                <ToggleSwitch
                  checked={enabled}
                  disabled={busy || tableMissing}
                  onChange={(next) => void setFeature(feature.key, next)}
                  aria-label={`${feature.label} - ${enabled ? 'פעיל' : 'כבוי'}`}
                  className="mt-0.5"
                />
              </div>

              {override && (
                <div className="mt-2.5 space-y-2 border-t border-border/60 pt-2.5">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-28 shrink-0">
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        inputMode="decimal"
                        label="מחיר שסוכם"
                        dir="ltr"
                        className="!py-1.5 text-xs"
                        defaultValue={override.price_ils ?? ''}
                        disabled={busy}
                        onBlur={(e) => {
                          const raw = e.target.value.trim()
                          const value = raw === '' ? null : Number(raw)
                          if (value != null && !Number.isFinite(value)) return
                          void saveDetails(feature.key, { price_ils: value })
                        }}
                      />
                    </div>
                    <div className="min-w-[9rem] flex-1">
                      <Input
                        label="מה סוכם"
                        placeholder="למשל: נכלל בחבילה שסוכמה בטלפון"
                        className="!py-1.5 text-xs"
                        defaultValue={override.note ?? ''}
                        disabled={busy}
                        onBlur={(e) => {
                          const value = e.target.value.trim()
                          void saveDetails(feature.key, { note: value === '' ? null : value })
                        }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void setFeature(feature.key, planIncludesFlag(catalog, plan, feature.key))
                    }
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5',
                      'text-[11px] font-medium text-muted transition-colors',
                      'hover:bg-white/40 hover:text-foreground disabled:opacity-50',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    )}
                  >
                    <RotateCcw size={11} strokeWidth={2} aria-hidden="true" />
                    חזרה לברירת המחדל של התוכנית
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <FeaturesSummaryLine
        granted={summary.granted}
        withheld={summary.withheld}
        totalPriceIls={summary.totalPriceIls}
      />
    </div>
  )
}

function FeaturesSummaryLine({
  granted,
  withheld,
  totalPriceIls,
}: {
  granted: number
  withheld: number
  totalPriceIls: number
}) {
  if (granted === 0 && withheld === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <SlidersHorizontal size={12} aria-hidden="true" />
        המשחק פועל לפי ברירת המחדל של התוכנית.
      </p>
    )
  }

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <Sparkles size={12} className="text-success-text" aria-hidden="true" />
      {granted > 0 && <span>{granted} תוספות מעבר לתוכנית</span>}
      {withheld > 0 && <span>{withheld} פיצ׳ר פלאגים הוסרו</span>}
      {totalPriceIls > 0 && (
        <span className="font-semibold text-foreground">
          סה״כ תוספות: {formatPriceIls(totalPriceIls)}
        </span>
      )}
    </p>
  )
}
