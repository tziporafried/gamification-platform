import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Flame, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PillButton } from '@/components/ui/PillButton'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import type { ActionWithGroups } from '@/types'

type StartMode = 'immediately' | 'specific'
type DurationMode = '15' | '30' | '60' | '1440' | '10080' | 'custom'

const DURATION_OPTIONS: { value: DurationMode; label: string }[] = [
  { value: '15', label: '15 דק׳' },
  { value: '30', label: '30 דק׳' },
  { value: '60', label: 'שעה' },
  { value: '1440', label: 'יום' },
  { value: '10080', label: 'שבוע' },
  { value: 'custom', label: 'מותאם' },
]

type BonusOption =
  | { kind: 'multiplier'; value: number; label: string }
  | { kind: 'flat'; value: number; label: string }

const BONUS_OPTIONS: BonusOption[] = [
  { kind: 'multiplier', value: 2, label: '×2' },
  { kind: 'multiplier', value: 3, label: '×3' },
  { kind: 'flat', value: 100, label: '+100' },
  { kind: 'flat', value: 500, label: '+500' },
]

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day}T${h}:${min}`
}

function nowPlusMs(ms = 0): string {
  return toDatetimeLocal(new Date(Date.now() + ms).toISOString())
}

function inferDurationMode(action: ActionWithGroups): DurationMode {
  const dm = action.duration_minutes
  if (dm === 15) return '15'
  if (dm === 30) return '30'
  if (dm === 60) return '60'
  if (dm === 1440) return '1440'
  if (dm === 10080) return '10080'
  return 'custom'
}

interface ActionTimeSettingsProps {
  action: ActionWithGroups
  onUpdated: (patch: Partial<ActionWithGroups>) => void
}

export function ActionTimeSettings({ action, onUpdated }: ActionTimeSettingsProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [timeEnabled, setTimeEnabled] = useState(action.time_enabled)
  const [startMode, setStartMode] = useState<StartMode>(action.start_at ? 'specific' : 'immediately')
  const [specificStartAt, setSpecificStartAt] = useState(
    action.start_at ? toDatetimeLocal(action.start_at) : nowPlusMs(),
  )
  const [durationMode, setDurationMode] = useState<DurationMode>(inferDurationMode(action))
  const [customEndAt, setCustomEndAt] = useState(
    action.end_at ? toDatetimeLocal(action.end_at) : nowPlusMs(3_600_000),
  )
  const [speedBonusEnabled, setSpeedBonusEnabled] = useState(action.speed_bonus_enabled)
  const [speedBonusMinutes, setSpeedBonusMinutes] = useState(action.speed_bonus_minutes ?? 10)
  // bonusFlatPoints: null = multiplier mode, number = flat bonus mode
  const [bonusFlatPoints, setBonusFlatPoints] = useState<number | null>(
    action.speed_bonus_flat_points ?? null,
  )
  const [speedMultiplier, setSpeedMultiplier] = useState(Number(action.speed_multiplier) || 2)

  // Sync state from updated props, but only when the panel is closed
  useEffect(() => {
    if (open) return
    setTimeEnabled(action.time_enabled)
    setStartMode(action.start_at ? 'specific' : 'immediately')
    setSpecificStartAt(action.start_at ? toDatetimeLocal(action.start_at) : nowPlusMs())
    setDurationMode(inferDurationMode(action))
    setCustomEndAt(action.end_at ? toDatetimeLocal(action.end_at) : nowPlusMs(3_600_000))
    setSpeedBonusEnabled(action.speed_bonus_enabled)
    setSpeedBonusMinutes(action.speed_bonus_minutes ?? 10)
    setBonusFlatPoints(action.speed_bonus_flat_points ?? null)
    setSpeedMultiplier(Number(action.speed_multiplier) || 2)
  }, [
    open,
    action.id,
    action.time_enabled,
    action.start_at,
    action.end_at,
    action.duration_minutes,
    action.speed_bonus_enabled,
    action.speed_bonus_minutes,
    action.speed_bonus_flat_points,
    action.speed_multiplier,
  ])

  const hasSettings = action.time_enabled || action.speed_bonus_enabled

  function handleTimeToggle(val: boolean) {
    setTimeEnabled(val)
    if (!val) setSpeedBonusEnabled(false)
  }

  async function handleSave() {
    setFormError('')

    if (!timeEnabled) {
      setSaving(true)
      const { error } = await supabase
        .from('actions')
        .update({
          time_enabled: false,
          start_at: null,
          end_at: null,
          duration_minutes: null,
          speed_bonus_enabled: false,
          speed_bonus_minutes: null,
          speed_bonus_flat_points: null,
          speed_multiplier: 2,
        })
        .eq('id', action.id)
      setSaving(false)
      if (error) { setFormError(error.message); return }
      onUpdated({
        time_enabled: false,
        start_at: null,
        end_at: null,
        duration_minutes: null,
        speed_bonus_enabled: false,
        speed_bonus_minutes: null,
        speed_bonus_flat_points: null,
        speed_multiplier: 2,
      })
      setOpen(false)
      return
    }

    const startAt =
      startMode === 'immediately'
        ? new Date().toISOString()
        : new Date(specificStartAt).toISOString()

    const startDate = new Date(startAt)
    let endAt: string | null = null
    let durationMinutes: number | null = null
    let endDate: Date

    if (durationMode === 'custom') {
      endAt = new Date(customEndAt).toISOString()
      endDate = new Date(customEndAt)
    } else {
      durationMinutes = parseInt(durationMode)
      endDate = new Date(startDate.getTime() + durationMinutes * 60_000)
    }

    if (endDate <= startDate) {
      setFormError('תאריך הסיום חייב להיות אחרי תאריך ההתחלה.')
      return
    }

    if (speedBonusEnabled) {
      if (speedBonusMinutes <= 0) {
        setFormError('חלון בונוס המהירות חייב להיות חיובי.')
        return
      }
      const speedEnd = new Date(startDate.getTime() + speedBonusMinutes * 60_000)
      if (speedEnd >= endDate) {
        setFormError('חלון בונוס המהירות חייב להסתיים לפני סיום הפעילות.')
        return
      }
    }

    setSaving(true)
    const { error } = await supabase
      .from('actions')
      .update({
        time_enabled: true,
        start_at: startAt,
        end_at: endAt,
        duration_minutes: durationMinutes,
        speed_bonus_enabled: speedBonusEnabled,
        speed_bonus_minutes: speedBonusEnabled ? speedBonusMinutes : null,
        speed_bonus_flat_points: speedBonusEnabled ? bonusFlatPoints : null,
        speed_multiplier: speedBonusEnabled && bonusFlatPoints == null ? speedMultiplier : 2,
      })
      .eq('id', action.id)
    setSaving(false)

    if (error) { setFormError(error.message); return }
    onUpdated({
      time_enabled: true,
      start_at: startAt,
      end_at: endAt,
      duration_minutes: durationMinutes,
      speed_bonus_enabled: speedBonusEnabled,
      speed_bonus_minutes: speedBonusEnabled ? speedBonusMinutes : null,
      speed_bonus_flat_points: speedBonusEnabled ? bonusFlatPoints : null,
      speed_multiplier: speedBonusEnabled && bonusFlatPoints == null ? speedMultiplier : 2,
    })
    setOpen(false)
  }

  return (
    <div className="border-t border-border/30">
      {/* ── Collapse trigger ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-1.5 px-4 py-1.5 text-[11px] transition-colors duration-150',
          hasSettings
            ? 'text-secondary hover:text-accent'
            : 'text-muted hover:text-foreground',
        )}
      >
        <Clock size={11} className="shrink-0" />
        <span className="font-medium">
          {hasSettings ? 'הגדרות זמן' : 'הוסף הגדרות זמן'}
        </span>
        {hasSettings && (
          <span className="mr-1 flex gap-1">
            <span className="rounded px-1 py-px text-[9px] bg-surface-elevated text-accent">⏱</span>
            {action.speed_bonus_enabled && (
              <span className="rounded px-1 py-px text-[9px] bg-surface-elevated text-accent">🔥</span>
            )}
          </span>
        )}
        <ChevronDown
          size={11}
          className={cn(
            'mr-auto shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* ── Expandable panel ── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              <div className="rounded-xl border border-border bg-surface-elevated p-4 space-y-4">

                {/* ── Time Limitation ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-secondary" />
                      <span className="text-xs font-semibold text-foreground">הגבלת זמן</span>
                    </div>
                    <ToggleSwitch checked={timeEnabled} onChange={handleTimeToggle} />
                  </div>

                  <AnimatePresence initial={false}>
                    {timeEnabled && (
                      <motion.div
                        key="time-fields"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden space-y-3"
                      >
                        {/* Start */}
                        <div>
                          <p className="mb-1.5 text-[10px] font-medium text-muted">התחלה</p>
                          <div className="flex gap-1.5">
                            <PillButton
                              active={startMode === 'immediately'}
                              onClick={() => setStartMode('immediately')}
                            >
                              מיידי
                            </PillButton>
                            <PillButton
                              active={startMode === 'specific'}
                              onClick={() => setStartMode('specific')}
                            >
                              תאריך ושעה
                            </PillButton>
                          </div>
                          {startMode === 'specific' && (
                            <input
                              type="datetime-local"
                              dir="ltr"
                              value={specificStartAt}
                              onChange={(e) => setSpecificStartAt(e.target.value)}
                              className="mt-2 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                            />
                          )}
                        </div>

                        {/* Duration */}
                        <div>
                          <p className="mb-1.5 text-[10px] font-medium text-muted">משך</p>
                          <div className="flex flex-wrap gap-1.5">
                            {DURATION_OPTIONS.map((opt) => (
                              <PillButton
                                key={opt.value}
                                active={durationMode === opt.value}
                                onClick={() => setDurationMode(opt.value)}
                              >
                                {opt.label}
                              </PillButton>
                            ))}
                          </div>
                          {durationMode === 'custom' && (
                            <div className="mt-2">
                              <p className="mb-1 text-[10px] text-muted">תאריך סיום</p>
                              <input
                                type="datetime-local"
                                dir="ltr"
                                value={customEndAt}
                                onChange={(e) => setCustomEndAt(e.target.value)}
                                className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                              />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="border-t border-border" />

                {/* ── Speed Bonus ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame size={14} className="text-accent" />
                      <span className="text-xs font-semibold text-foreground">בונוס מהירות</span>
                    </div>
                    <ToggleSwitch
                      checked={speedBonusEnabled}
                      onChange={setSpeedBonusEnabled}
                      disabled={!timeEnabled}
                    />
                  </div>
                  {!timeEnabled && (
                    <p className="text-[10px] text-muted">יש להפעיל הגבלת זמן תחילה</p>
                  )}

                  <AnimatePresence initial={false}>
                    {speedBonusEnabled && timeEnabled && (
                      <motion.div
                        key="bonus-fields"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-xl border border-accent/20 bg-surface-elevated p-3 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground">
                            <span>משלימים תוך</span>
                            <input
                              type="number"
                              min={1}
                              dir="ltr"
                              value={speedBonusMinutes}
                              onChange={(e) =>
                                setSpeedBonusMinutes(Math.max(1, parseInt(e.target.value) || 1))
                              }
                              className="w-14 rounded-lg border border-border bg-surface px-2 py-1 text-center text-xs text-foreground outline-none focus:border-accent"
                            />
                            <span>דקות יקבלו</span>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {BONUS_OPTIONS.map((opt) => {
                              const isActive =
                                opt.kind === 'flat'
                                  ? bonusFlatPoints === opt.value
                                  : bonusFlatPoints === null && speedMultiplier === opt.value
                              return (
                                <button
                                  key={`${opt.kind}-${opt.value}`}
                                  type="button"
                                  onClick={() => {
                                    if (opt.kind === 'flat') {
                                      setBonusFlatPoints(opt.value)
                                    } else {
                                      setBonusFlatPoints(null)
                                      setSpeedMultiplier(opt.value)
                                    }
                                  }}
                                  className={cn(
                                    'rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                                    isActive
                                      ? 'border-accent/50 bg-surface-elevated text-accent'
                                      : 'border-border text-muted hover:border-accent/30 hover:text-foreground',
                                  )}
                                >
                                  {opt.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Combined-limits hint */}
                <p className="text-[10px] leading-relaxed text-muted">
                  הגבלת זמן והגבלת כמות פועלות יחד. המשתתף יוכל לבצע את המשימה רק אם הוא גם בתוך הזמן המותר וגם לא עבר את מגבלת הביצועים.
                </p>

                {/* Error */}
                {formError && (
                  <p className="text-xs text-danger">⚠ {formError}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button size="xs" loading={saving} onClick={handleSave}>
                    {saving ? 'שומר...' : 'שמירה'}
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => { setOpen(false); setFormError('') }}>
                    ביטול
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

