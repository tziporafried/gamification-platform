import { useCallback, useEffect, useMemo, useState } from 'react'
import { Flag, Plus, Pencil, Trash2, Copy, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { ModalActions } from '@/components/ui/ModalActions'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { StatusBadge, PLAN_BADGE_COLORS } from '@/components/ui/StatusBadge'
import { EVENT_PLAN_OPTIONS, PLAN_LABELS } from '@/lib/eventPlanLabels'
import { invalidateFeatureCatalog } from '@/hooks/useEventFeatures'
import {
  FEATURE_KEY_PATTERN,
  isMissingFeatureTableError,
  suggestFlagKey,
  type FeatureFlag,
} from '@/lib/eventFeatures'
import { cn } from '@/lib/utils'
import type { UserPlan } from '@/types'

const SELECT_COLUMNS = 'key, label, description, default_plans, is_active, sort_order'

const MISSING_TABLE_HINT =
  'טבלת הפיצ׳ר פלאגים עדיין לא הותקנה במסד הנתונים. הריצו את ' +
  'supabase/APPLY_FEATURE_FLAGS_CATALOG.sql (ולפניו APPLY_EVENT_FEATURES.sql) ורעננו.'

interface FlagRow extends FeatureFlag {
  /** How many games were sold this flag on top of their plan. */
  grantedTo: number
}

interface DraftFlag {
  /** The key being edited, or null when creating a new flag. */
  originalKey: string | null
  key: string
  label: string
  description: string
  default_plans: UserPlan[]
  is_active: boolean
}

function emptyDraft(): DraftFlag {
  return {
    originalKey: null,
    key: '',
    label: '',
    description: '',
    default_plans: [],
    is_active: true,
  }
}

function draftFrom(flag: FeatureFlag): DraftFlag {
  return {
    originalKey: flag.key,
    key: flag.key,
    label: flag.label,
    description: flag.description,
    default_plans: [...flag.default_plans],
    is_active: flag.is_active,
  }
}

/**
 * The flag catalogue, for a super admin.
 *
 * This screen answers "what can be sold"; the per-game panel (a game's
 * פיצ׳ר פלאגים tab) answers "who bought it". A flag created here does nothing
 * on its own - some area of the app has to gate on its key, via
 * <FeatureGate flag="…"> - so the key is shown next to every row, ready to
 * copy into the code.
 */
export function FeatureFlagsAdminPanel() {
  const { user } = useAuth()
  const [flags, setFlags] = useState<FlagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableMissing, setTableMissing] = useState(false)
  const [draft, setDraft] = useState<DraftFlag | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FlagRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [flagsRes, grantsRes] = await Promise.all([
      supabase
        .from('feature_flags')
        .select(SELECT_COLUMNS)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true }),
      supabase.from('event_features').select('feature_key, enabled'),
    ])

    if (flagsRes.error) {
      if (isMissingFeatureTableError(flagsRes.error.message)) {
        setTableMissing(true)
        setFlags([])
      } else {
        setError(flagsRes.error.message)
      }
      setLoading(false)
      return
    }

    const grantCounts = new Map<string, number>()
    for (const row of (grantsRes.data ?? []) as { feature_key: string; enabled: boolean }[]) {
      if (!row.enabled) continue
      grantCounts.set(row.feature_key, (grantCounts.get(row.feature_key) ?? 0) + 1)
    }

    setTableMissing(false)
    setFlags(
      ((flagsRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
        key: String(row.key),
        label: String(row.label ?? ''),
        description: String(row.description ?? ''),
        default_plans: (row.default_plans as UserPlan[] | null) ?? [],
        is_active: row.is_active !== false,
        sort_order: Number(row.sort_order ?? 0),
        grantedTo: grantCounts.get(String(row.key)) ?? 0,
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const takenKeys = useMemo(() => new Set(flags.map((f) => f.key)), [flags])

  function validateDraft(d: DraftFlag): string | null {
    if (!d.label.trim()) return 'צריך שם לפיצ׳ר פלאג'
    if (!d.key.trim()) return 'צריך מפתח באנגלית - זה מה שהקוד יבדוק'
    if (!FEATURE_KEY_PATTERN.test(d.key)) {
      return 'המפתח חייב להתחיל באות אנגלית קטנה ולהכיל רק אותיות קטנות, ספרות וקו תחתון'
    }
    if (d.key !== d.originalKey && takenKeys.has(d.key)) return 'כבר קיים פיצ׳ר פלאג עם המפתח הזה'
    return null
  }

  async function handleSave() {
    if (!draft) return
    const problem = validateDraft(draft)
    if (problem) {
      setFormError(problem)
      return
    }

    setSaving(true)
    setFormError(null)

    const payload = {
      key: draft.key.trim(),
      label: draft.label.trim(),
      description: draft.description.trim(),
      default_plans: draft.default_plans,
      is_active: draft.is_active,
    }

    // Renaming a key is an update, not an insert; the FK from event_features
    // cascades the new key onto every game that was already sold this flag.
    const query = draft.originalKey
      ? supabase.from('feature_flags').update(payload).eq('key', draft.originalKey)
      : supabase.from('feature_flags').insert({
          ...payload,
          sort_order: flags.length,
          created_by: user?.id ?? null,
        })

    const { error: saveError } = await query
    setSaving(false)
    if (saveError) {
      setFormError(saveError.message)
      return
    }

    setDraft(null)
    invalidateFeatureCatalog()
    await load()
  }

  async function handleToggleActive(flag: FlagRow, isActive: boolean) {
    setTogglingKey(flag.key)
    setError(null)
    const { error: toggleError } = await supabase
      .from('feature_flags')
      .update({ is_active: isActive })
      .eq('key', flag.key)
    setTogglingKey(null)
    if (toggleError) {
      setError(toggleError.message)
      return
    }
    setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, is_active: isActive } : f)))
    invalidateFeatureCatalog()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    const { error: deleteError } = await supabase
      .from('feature_flags')
      .delete()
      .eq('key', deleteTarget.key)
    setDeleting(false)
    setDeleteTarget(null)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    invalidateFeatureCatalog()
    await load()
  }

  function copyKey(key: string) {
    void navigator.clipboard?.writeText(key)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600)
  }

  if (loading) return <CenteredLoader />

  return (
    <>
      {tableMissing && (
        <p className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-relaxed text-warning-text">
          {MISSING_TABLE_HINT}
        </p>
      )}
      {error && <ErrorAlert message={error} className="mb-4" />}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Flag size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-medium text-muted">{flags.length} פיצ׳ר פלאגים</h2>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
            כאן מגדירים מה בכלל אפשר למכור. כל פלאג מקבל מפתח באנגלית שהקוד בודק,
            ואפשר לצרף אותו למוצרים שכוללים אותו מראש. הוספה למשחק ספציפי נעשית
            בכרטיס המשחק.
          </p>
        </div>
        <Button
          type="button"
          disabled={tableMissing}
          onClick={() => {
            setFormError(null)
            setDraft(emptyDraft())
          }}
        >
          <Plus size={16} className="ml-1.5" aria-hidden="true" />
          פיצ׳ר פלאג חדש
        </Button>
      </div>

      {flags.length === 0 ? (
        <EmptyState
          icon={<Flag size={32} />}
          title="אין עדיין פיצ׳ר פלאגים"
          description="הוסיפו את הראשון, ואז אפשר יהיה למכור אותו למשחקים בנפרד מהתוכנית."
        />
      ) : (
        <div className="space-y-2.5">
          {flags.map((flag) => (
            <Card key={flag.key} className={cn('p-4', !flag.is_active && 'opacity-60')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{flag.label}</span>
                    {!flag.is_active && (
                      <Badge label="לא פעיל" color="var(--color-muted)" variant="quiet" />
                    )}
                    {flag.grantedTo > 0 && (
                      <Badge
                        label={`נמכר ל־${flag.grantedTo} משחקים`}
                        color="var(--color-success)"
                      />
                    )}
                  </div>

                  {flag.description && (
                    <p className="mt-1 text-xs leading-relaxed text-muted">{flag.description}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyKey(flag.key)}
                      title="העתקת המפתח לקוד"
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border border-border bg-surface',
                        'px-2 py-0.5 font-mono text-[11px] text-muted transition-colors',
                        'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      )}
                      dir="ltr"
                    >
                      {copiedKey === flag.key ? (
                        <Check size={11} className="text-success-text" aria-hidden="true" />
                      ) : (
                        <Copy size={11} aria-hidden="true" />
                      )}
                      {flag.key}
                    </button>

                    {flag.default_plans.length > 0 ? (
                      flag.default_plans.map((plan) => (
                        <StatusBadge
                          key={plan}
                          label={PLAN_LABELS[plan] ?? plan}
                          color={PLAN_BADGE_COLORS[plan] ?? 'var(--color-muted)'}
                        />
                      ))
                    ) : (
                      <span className="text-[11px] text-muted/70">נמכר בנפרד · לא כלול במוצר</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <ToggleSwitch
                    checked={flag.is_active}
                    disabled={togglingKey === flag.key}
                    onChange={(next) => void handleToggleActive(flag, next)}
                    aria-label={`${flag.label} - ${flag.is_active ? 'פעיל' : 'לא פעיל'}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormError(null)
                      setDraft(draftFrom(flag))
                    }}
                  >
                    <Pencil size={13} className="ml-1" aria-hidden="true" />
                    עריכה
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(flag)}
                    aria-label={`מחיקת ${flag.label}`}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <FlagFormModal
        draft={draft}
        saving={saving}
        error={formError}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onSave={() => void handleSave()}
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        loading={deleting}
        title="מחיקת פיצ׳ר פלאג"
        confirmLabel="מחק"
        description={deleteTarget ? deleteDescription(deleteTarget) : ''}
      />
    </>
  )
}

/** Deleting takes the per-game grants with it, so say so before it happens. */
function deleteDescription(flag: FlagRow): string {
  if (flag.grantedTo > 0) {
    return (
      `"${flag.label}" נמכר כרגע ל־${flag.grantedTo} משחקים, ומחיקה תסיר אותו גם מהם. ` +
      'אם המטרה היא רק להפסיק למכור אותו מעכשיו - עדיף לכבות אותו במקום למחוק.'
    )
  }
  return `למחוק את "${flag.label}"? כל אזור בקוד שתלוי במפתח הזה יתנהג מעכשיו כאילו הפלאג כבוי.`
}

interface FlagFormModalProps {
  draft: DraftFlag | null
  saving: boolean
  error: string | null
  onChange: (draft: DraftFlag) => void
  onClose: () => void
  onSave: () => void
}

function FlagFormModal({ draft, saving, error, onChange, onClose, onSave }: FlagFormModalProps) {
  if (!draft) return null
  const isNew = draft.originalKey === null

  function patch(next: Partial<DraftFlag>) {
    onChange({ ...draft!, ...next })
  }

  function togglePlan(plan: UserPlan, checked: boolean) {
    patch({
      default_plans: checked
        ? [...draft!.default_plans, plan]
        : draft!.default_plans.filter((p) => p !== plan),
    })
  }

  return (
    <Modal
      isOpen
      onClose={() => { if (!saving) onClose() }}
      title={isNew ? 'פיצ׳ר פלאג חדש' : 'עריכת פיצ׳ר פלאג'}
      dialogClassName="max-w-lg"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSave()
        }}
      >
        <Input
          label="שם"
          value={draft.label}
          autoFocus
          disabled={saving}
          placeholder="למשל: לוח תוצאות מותאם אישית"
          onChange={(e) => {
            const label = e.target.value
            // Only fill the key while it is untouched, so an edit is never
            // overwritten by a later change to the name.
            const shouldSuggest = isNew && (draft.key === '' || draft.key === suggestFlagKey(draft.label))
            patch({ label, ...(shouldSuggest ? { key: suggestFlagKey(label) } : {}) })
          }}
        />

        <div>
          <Input
            label="מפתח לקוד"
            value={draft.key}
            dir="ltr"
            disabled={saving}
            placeholder="custom_leaderboard"
            className="font-mono"
            onChange={(e) => patch({ key: e.target.value.trim().toLowerCase() })}
          />
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            זה מה שהקוד בודק:{' '}
            <code className="font-mono text-foreground" dir="ltr">
              {`<FeatureGate flag="${draft.key || 'my_flag'}">`}
            </code>
            . אותיות אנגליות קטנות, ספרות וקו תחתון.
          </p>
        </div>

        <Textarea
          label="תיאור"
          rows={3}
          value={draft.description}
          disabled={saving}
          placeholder="מה זה נותן ללקוח, במילים שלכם - מוצג רק לכם בפאנל הניהול."
          onChange={(e) => patch({ description: e.target.value })}
        />

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-foreground">
            כלול במוצרים
          </legend>
          <p className="mb-2 text-[11px] leading-relaxed text-muted">
            תוכניות שמקבלות את הפלאג אוטומטית. השאירו ריק אם הוא נמכר רק בנפרד,
            לכל משחק לחוד.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {EVENT_PLAN_OPTIONS.map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                checked={draft.default_plans.includes(option.value)}
                disabled={saving}
                onChange={(e) => togglePlan(option.value, e.target.checked)}
              />
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-2.5">
          <ToggleSwitch
            checked={draft.is_active}
            disabled={saving}
            onChange={(next) => patch({ is_active: next })}
            aria-label="פלאג פעיל"
          />
          <span className="text-sm text-foreground">
            פעיל
            <span className="mr-1.5 text-xs text-muted">
              (כשכבוי, האזורים שתלויים בו מוסתרים בכל המשחקים)
            </span>
          </span>
        </label>

        {error && <ErrorAlert message={error} />}

        <ModalActions>
          <Button type="submit" loading={saving}>
            {isNew ? 'הוספה' : 'שמירה'}
          </Button>
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            ביטול
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}
