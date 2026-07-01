import { TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className={cn('block text-sm font-medium mb-1', theme.label)}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={cn(
          'block w-full rounded-xl border px-3 py-2 text-sm shadow-sm transition-colors',
          theme.inputBg,
          theme.text,
          theme.inputPlaceholder,
          error
            ? 'border-danger/50 focus:border-danger focus:outline-none focus:ring-1 focus:ring-offset-0 focus:ring-danger/25'
            : cn(theme.inputBorder, theme.focusBorder, theme.focusRing),
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  ),
)

Textarea.displayName = 'Textarea'
