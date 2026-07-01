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
  const shouldShowSubmit = showSubmit ?? Boolean(value.trim())

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border border-dashed p-3 transition-colors',
        theme.bgCardMuted,
        theme.border,
        'focus-within:border-secondary',
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
      {shouldShowSubmit && onSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className={cn(
            'shrink-0 text-xs font-medium transition-colors disabled:opacity-50',
            theme.accentText,
            'hover:text-accent',
          )}
        >
          {submitLabel}
        </button>
      )}
    </div>
  )
}
