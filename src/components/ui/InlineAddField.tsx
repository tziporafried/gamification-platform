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
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={cn(
            'shrink-0 text-xs font-medium transition-colors',
            canSubmit
              ? 'text-primary hover:text-primary-hover'
              : 'text-muted cursor-default',
          )}
        >
          {submitLabel}
        </button>
      )}
    </div>
  )
}
