import { TextareaHTMLAttributes, forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, 'aria-describedby': describedBy, ...props }, ref) => {
    // Without this the label's htmlFor pointed at `undefined` whenever a caller
    // omitted an id, leaving the control unlabelled (WCAG 1.3.1 / 4.1.2).
    const generatedId = useId()
    const textareaId = id ?? generatedId
    const errorId = `${textareaId}-error`

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className={cn('block text-sm font-medium mb-1', theme.label)}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errorId : null, describedBy].filter(Boolean).join(' ') || undefined}
          className={cn(
            'block w-full rounded-xl border px-3 py-2 text-sm shadow-sm transition-colors',
            theme.inputBg,
            theme.text,
            theme.inputPlaceholder,
            theme.focusRing,
            error ? 'border-danger-text' : cn(theme.inputBorder, theme.focusBorder),
            className,
          )}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-danger-text">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
