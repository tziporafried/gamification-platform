import { cn } from '@/lib/utils'

interface ColorPickerProps {
  label?: string
  value: string
  onChange: (color: string) => void
  error?: string
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
]

export function ColorPicker({ label, value, onChange, error }: ColorPickerProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
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
                value === color ? 'border-gray-900 scale-110' : 'border-transparent',
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border border-gray-300"
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
