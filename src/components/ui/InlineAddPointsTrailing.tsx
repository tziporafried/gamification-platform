import { KeyboardEvent, RefObject } from 'react'
import { cn } from '@/lib/utils'

interface InlineAddPointsTrailingProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  inputRef?: RefObject<HTMLInputElement | null>
  disabled?: boolean
}

export function InlineAddPointsTrailing({
  value,
  onChange,
  onKeyDown,
  inputRef,
  disabled = false,
}: InlineAddPointsTrailingProps) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3">
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        className={cn(
          'w-10 bg-transparent text-center text-sm font-bold text-success outline-none',
          disabled && 'opacity-50',
        )}
      />
      <span className="text-xs text-muted">נקודות</span>
    </div>
  )
}
