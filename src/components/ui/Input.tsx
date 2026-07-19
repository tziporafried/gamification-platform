import { InputHTMLAttributes, forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, 'aria-describedby': describedBy, ...props }, ref) => {
    // Without this the label's htmlFor pointed at `undefined` whenever a caller
    // omitted an id, leaving the control unlabelled (WCAG 1.3.1 / 4.1.2).
    const generatedId = useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={cn('block text-sm font-medium mb-1', theme.label)}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
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
        {/* role="alert" so the message is announced the moment validation fails. */}
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-danger-text">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'

export { Input }
