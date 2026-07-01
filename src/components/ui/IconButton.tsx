import { ButtonHTMLAttributes } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  revealOnHover?: boolean | string
  variant?: 'default' | 'danger'
}

export function IconButton({ className, revealOnHover, variant = 'danger', children, ...props }: IconButtonProps) {
  const variantClasses = variant === 'danger'
    ? 'text-muted hover:bg-danger/10 hover:text-danger'
    : 'text-muted hover:bg-surface-elevated hover:text-foreground'

  return (
    <button
      type="button"
      className={cn(
        'shrink-0 p-1.5 rounded-lg transition-all',
        variantClasses,
        revealOnHover === true && 'opacity-0 group-hover:opacity-100',
        typeof revealOnHover === 'string' && `opacity-0 group-hover/${revealOnHover}:opacity-100`,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function DeleteButton({ iconSize = 16, title = 'מחיקה', ...props }: Omit<IconButtonProps, 'children'> & { iconSize?: number }) {
  return (
    <IconButton title={title} variant="danger" {...props}>
      <Trash2 size={iconSize} />
    </IconButton>
  )
}
