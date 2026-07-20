import { useEffect, useState } from 'react'
import { AnalyticsDatePreset } from './types'
import { cn } from '@/lib/utils'
import { ChipButton } from '@/components/ui/ChipButton'

const PRESETS: { id: AnalyticsDatePreset; label: string }[] = [
  { id: 'today', label: 'היום' },
  { id: '7d', label: '7 ימים' },
  { id: '14d', label: '14 ימים' },
  { id: '28d', label: '28 ימים' },
  { id: 'custom', label: 'מותאם' },
]

interface DateRangePickerProps {
  preset: AnalyticsDatePreset
  startDate: string
  endDate: string
  onPresetChange: (preset: AnalyticsDatePreset) => void
  onCustomChange: (start: string, end: string) => void
  disabled?: boolean
  /** YYYY-MM-DD - max selectable day (usually today in Israel). */
  maxDate?: string
}

export function DateRangePicker({
  preset,
  startDate,
  endDate,
  onPresetChange,
  onCustomChange,
  disabled,
  maxDate,
}: DateRangePickerProps) {
  const isSingleDay = startDate === endDate
  const [rangeMode, setRangeMode] = useState(!isSingleDay)

  // Keep toggle in sync when parent changes dates (e.g. preset → custom defaults to one day).
  useEffect(() => {
    if (preset !== 'custom') return
    setRangeMode(startDate !== endDate)
  }, [preset, startDate, endDate])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <ChipButton
            key={p.id}
            color={preset === p.id ? 'brand' : 'default'}
            disabled={disabled}
            onClick={() => onPresetChange(p.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs',
              preset === p.id && 'ring-1 ring-primary/30',
            )}
          >
            {p.label}
          </ChipButton>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <ChipButton
              color={!rangeMode ? 'brand' : 'default'}
              disabled={disabled}
              onClick={() => {
                setRangeMode(false)
                onCustomChange(startDate, startDate)
              }}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px]',
                !rangeMode && 'ring-1 ring-primary/30',
              )}
            >
              יום בודד (שעתי)
            </ChipButton>
            <ChipButton
              color={rangeMode ? 'brand' : 'default'}
              disabled={disabled}
              onClick={() => setRangeMode(true)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px]',
                rangeMode && 'ring-1 ring-primary/30',
              )}
            >
              טווח ימים
            </ChipButton>
          </div>

          {!rangeMode ? (
            <label className="flex flex-wrap items-center gap-1.5 text-muted">
              <span className="text-xs">תאריך</span>
              <input
                type="date"
                value={startDate}
                max={maxDate}
                disabled={disabled}
                onChange={(e) => {
                  const day = e.target.value
                  if (!day) return
                  onCustomChange(day, day)
                }}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-foreground"
              />
              <span className="text-[11px] text-muted">הגרף לפי שעה</span>
            </label>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-muted">
                <span className="text-xs">מ־</span>
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  disabled={disabled}
                  onChange={(e) => onCustomChange(e.target.value, endDate)}
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-foreground"
                />
              </label>
              <label className="flex items-center gap-1.5 text-muted">
                <span className="text-xs">עד</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={maxDate}
                  disabled={disabled}
                  onChange={(e) => onCustomChange(startDate, e.target.value)}
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-foreground"
                />
              </label>
              {startDate === endDate && (
                <span className="text-[11px] text-muted">יום אחד · גרף שעתי</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
