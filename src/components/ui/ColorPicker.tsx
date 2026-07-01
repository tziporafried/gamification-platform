import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface ColorPickerProps {
  label?: string
  value: string
  onChange: (color: string) => void
  error?: string
}

const PRESET_COLORS = [
  'var(--color-primary)',
  'var(--color-primary-hover)',
  'var(--color-secondary)',
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-danger)',
  'var(--color-muted)',
]

export function ColorPicker({ label, value, onChange, error }: ColorPickerProps) {
  return (
    <div className="w-full">
      {label && (
        <label className={cn('block text-sm font-medium mb-1', theme.label)}>{label}</label>
      )}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={cn(
                'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
                value === color ? 'border-foreground scale-110' : 'border-transparent',
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn('h-8 w-8 cursor-pointer rounded border', theme.inputBorder, theme.inputBg)}
        />
      </div>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  )
}
