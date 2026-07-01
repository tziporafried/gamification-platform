import { cn } from '@/lib/utils'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const SIZES = {
  sm: { track: 'h-5 w-9', thumb: 'h-3.5 w-3.5 top-0.5', onPos: 'right-0.5', offPos: 'left-0.5' },
  md: { track: 'h-6 w-11', thumb: 'h-4 w-4 top-1', onPos: 'right-1', offPos: 'left-1' },
}

export function ToggleSwitch({ checked, onChange, disabled = false, size = 'sm', className }: ToggleSwitchProps) {
  const s = SIZES[size]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex shrink-0 rounded-full border-2 transition-all duration-200',
        s.track,
        checked ? 'border-secondary bg-secondary' : 'border-border bg-surface-elevated',
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
    >
      <span className={cn('absolute rounded-full bg-background shadow-sm transition-all duration-200', s.thumb, checked ? s.onPos : s.offPos)} />
    </button>
  )
}
