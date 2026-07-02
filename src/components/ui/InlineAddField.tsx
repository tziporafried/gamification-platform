import { KeyboardEvent, ReactNode, RefObject } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface InlineAddFieldProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  disabled?: boolean
  submitLabel?: string
  onSubmit?: () => void
  showSubmit?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  autoFocus?: boolean
  trailing?: ReactNode
  className?: string
}

export function InlineAddField({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled = false,
  submitLabel = 'הוסף',
  onSubmit,
  showSubmit,
  inputRef,
  autoFocus,
  trailing,
  className,
}: InlineAddFieldProps) {
  const hasContent = Boolean(value.trim())
  const canSubmit = !disabled && hasContent

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl p-1.5',
        theme.bgCardMuted,
        theme.borderInteractiveDashed,
        'focus-within:border-accent',
        className,
      )}
    >
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn(
          'min-w-0 flex-1 h-9 rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors',
          theme.text,
          theme.inputPlaceholder,
          'focus:border-secondary',
          disabled && 'opacity-50',
        )}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      {trailing}
      {onSubmit && showSubmit !== false && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={cn(
            'inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border px-3 text-xs font-semibold transition-all',
            canSubmit
              ? 'border-transparent bg-primary text-[var(--color-on-primary)] hover:bg-primary-hover active:scale-[0.97]'
              : 'cursor-not-allowed border-border bg-surface text-muted',
          )}
        >
          <Plus size={14} strokeWidth={2.5} />
          {submitLabel}
        </button>
      )}
    </div>
  )
}
