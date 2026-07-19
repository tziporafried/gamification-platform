import { SelectHTMLAttributes, forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, 'aria-describedby': describedBy, ...props }, ref) => {
    // Without this the label's htmlFor pointed at `undefined` whenever a caller
    // omitted an id, leaving the control unlabelled (WCAG 1.3.1 / 4.1.2).
    const generatedId = useId()
    const selectId = id ?? generatedId
    const errorId = `${selectId}-error`

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className={cn('block text-sm font-medium mb-1', theme.label)}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errorId : null, describedBy].filter(Boolean).join(' ') || undefined}
          className={cn(
            'block w-full rounded-xl border px-3 py-2 text-sm shadow-sm transition-colors',
            theme.inputBg,
            theme.text,
            theme.focusRing,
            error ? 'border-danger-text' : cn(theme.inputBorder, theme.focusBorder),
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-danger-text">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Select.displayName = 'Select'
