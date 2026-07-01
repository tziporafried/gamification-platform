import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface InlineEditableTextProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onCancel?: () => void
  isEditing: boolean
  onStartEdit: () => void
  placeholder?: string
  className?: string
}

export function InlineEditableText({
  value,
  onChange,
  onSave,
  onCancel,
  isEditing,
  onStartEdit,
  placeholder,
  className,
}: InlineEditableTextProps) {
  if (isEditing) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave()
          if (e.key === 'Escape') onCancel?.()
        }}
        onBlur={onSave}
        autoFocus
        placeholder={placeholder}
        className={cn(
          'w-full bg-transparent text-sm font-semibold outline-none border-b pb-0.5',
          theme.focusBorder,
          theme.text,
          className,
        )}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={onStartEdit}
      className={cn(
        'w-full text-right text-sm font-semibold transition-colors',
        theme.text,
        theme.hoverText,
        className,
      )}
    >
      {value || placeholder}
    </button>
  )
}
