import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import {
  DEFAULT_PRESET_COLOR,
  isPresetColor,
  normalizeHexColor,
  PRESET_COLORS,
} from '@/lib/paletteColors'

interface ColorPickerProps {
  label?: string
  value: string
  onChange: (color: string) => void
  error?: string
  compact?: boolean
}

export function ColorPicker({ label, value, onChange, error, compact = false }: ColorPickerProps) {
  const normalizedValue = normalizeHexColor(value)
  const colorInputValue = /^#[0-9a-f]{6}$/i.test(normalizedValue)
    ? normalizedValue
    : DEFAULT_PRESET_COLOR
  const isCustom = !isPresetColor(normalizedValue)

  const picker = (
    <div
      className={cn(
        'flex items-center',
        compact ? 'flex-nowrap gap-1.5' : 'gap-3',
      )}
    >
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            'shrink-0 rounded-full border-2 transition-transform hover:scale-110',
            compact ? 'h-6 w-6' : 'h-7 w-7',
            normalizedValue.toLowerCase() === color.toLowerCase()
              ? 'border-foreground scale-110'
              : 'border-transparent',
          )}
          style={{ backgroundColor: color }}
        />
      ))}
      <input
        type="color"
        value={colorInputValue}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'shrink-0 cursor-pointer rounded border',
          compact ? 'h-6 w-6' : 'h-8 w-8',
          isCustom && 'border-foreground ring-1 ring-foreground',
          theme.inputBorder,
          theme.inputBg,
        )}
        title="צבע מותאם אישית"
      />
    </div>
  )

  if (compact) return picker

  return (
    <div className="w-full">
      {label && (
        <label className={cn('block text-sm font-medium mb-1', theme.label)}>{label}</label>
      )}
      {picker}
      {error && <p className="mt-1 text-sm text-danger-text">{error}</p>}
    </div>
  )
}
