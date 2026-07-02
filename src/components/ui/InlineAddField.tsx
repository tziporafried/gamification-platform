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
        'flex items-center gap-2 rounded-xl p-3',
        theme.bgCardMuted,
        theme.borderInteractiveDashed,
        'focus-within:border-accent',
        className,
      )}
    >
      <Plus size={18} className={cn('shrink-0', theme.textSubtle)} />
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn(
          'flex-1 bg-transparent text-sm outline-none',
          theme.text,
          theme.inputPlaceholder,
          disabled && 'opacity-50',
        )}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      {trailing}
      {onSubmit && showSubmit !== false && (
        <>
          {trailing != null && (
            <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className={cn(
              'shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all',
              canSubmit
                ? 'border-transparent bg-primary text-[var(--color-on-primary)] hover:bg-primary-hover active:scale-[0.97]'
                : 'cursor-not-allowed border-border bg-surface text-muted',
            )}
          >
            {submitLabel}
          </button>
        </>
      )}
    </div>
  )
}
