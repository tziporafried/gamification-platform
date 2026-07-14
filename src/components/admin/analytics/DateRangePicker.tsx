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
}

export function DateRangePicker({
  preset,
  startDate,
  endDate,
  onPresetChange,
  onCustomChange,
  disabled,
}: DateRangePickerProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-wrap items-center gap-2 text-sm">
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
              disabled={disabled}
              onChange={(e) => onCustomChange(startDate, e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-foreground"
            />
          </label>
        </div>
      )}
    </div>
  )
}
