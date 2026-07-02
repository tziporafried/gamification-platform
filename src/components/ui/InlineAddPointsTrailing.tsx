import { KeyboardEvent, RefObject } from 'react'
import { cn } from '@/lib/utils'

interface InlineAddPointsTrailingProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  inputRef?: RefObject<HTMLInputElement | null>
  disabled?: boolean
  label?: string
  placeholder?: string
}

export function InlineAddPointsTrailing({
  value,
  onChange,
  onKeyDown,
  inputRef,
  disabled = false,
  label = 'נקודות',
  placeholder,
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
        placeholder={placeholder}
        className={cn(
          'bg-transparent text-sm font-bold text-success outline-none placeholder:font-normal placeholder:text-muted',
          placeholder ? 'w-24 text-start' : 'w-10 text-center',
          disabled && 'opacity-50',
        )}
      />
      {!placeholder && <span className="text-xs text-muted">{label}</span>}
    </div>
  )
}
