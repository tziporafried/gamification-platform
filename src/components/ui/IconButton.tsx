import { ButtonHTMLAttributes } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  revealOnHover?: boolean | string
  variant?: 'default' | 'danger'
  /**
   * Required: the button renders an icon only, so without this it reaches
   * screen readers as an unnamed "button" (WCAG 4.1.2). `title` alone is not
   * enough - it is unreliable on touch and with several screen readers.
   */
  'aria-label': string
}

const NAMED_REVEAL_CLASSES: Record<string, string> = {
  card: 'opacity-0 group-hover/card:opacity-100',
}

export function IconButton({ className, revealOnHover, variant = 'danger', children, ...props }: IconButtonProps) {
  // Hover-revealed controls stay invisible until hover; without this a keyboard
  // user tabs onto a control they cannot see (WCAG 2.4.7).
  const focusReveal = revealOnHover ? 'focus-visible:opacity-100' : undefined

  const variantClasses = variant === 'danger'
    ? 'text-muted hover:bg-danger/10 hover:text-danger-text'
    : 'text-muted hover:bg-surface-elevated hover:text-foreground'

  const revealClasses =
    revealOnHover === true
      ? 'opacity-0 group-hover:opacity-100'
      : typeof revealOnHover === 'string'
        ? NAMED_REVEAL_CLASSES[revealOnHover]
        : undefined

  return (
    <button
      type="button"
      className={cn(
        'shrink-0 p-1.5 rounded-lg transition-all',
        theme.focusRing,
        variantClasses,
        revealClasses,
        focusReveal,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function DeleteButton({
  iconSize = 16,
  title = 'מחיקה',
  'aria-label': ariaLabel,
  ...props
}: Omit<IconButtonProps, 'children' | 'aria-label'> & { iconSize?: number; 'aria-label'?: string }) {
  return (
    <IconButton title={title} aria-label={ariaLabel ?? title} variant="danger" {...props}>
      <Trash2 size={iconSize} aria-hidden="true" />
    </IconButton>
  )
}
