import { SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className={cn('block text-sm font-medium mb-1', theme.label)}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={cn(
          'block w-full rounded-xl border px-3 py-2 text-sm shadow-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          theme.inputBg,
          theme.text,
          error
            ? 'border-danger/50 focus:border-danger focus:ring-danger/30'
            : cn(theme.inputBorder, theme.focusBorder, theme.focusRing),
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  ),
)

Select.displayName = 'Select'
