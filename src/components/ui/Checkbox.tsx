import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => (
    <label htmlFor={id} className={cn('flex items-center gap-2 text-sm', theme.label)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={cn(
          'h-4 w-4 rounded border-border bg-surface',
          theme.checkbox,
          className,
        )}
        {...props}
      />
      {label}
    </label>
  ),
)

Checkbox.displayName = 'Checkbox'
