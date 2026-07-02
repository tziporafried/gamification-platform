import { ButtonHTMLAttributes } from 'react'
import { DeleteButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/utils'

type WizardDeleteButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  title?: string
  iconSize?: number
  /** 'card' = colored card top-left; 'row' = inline in list rows */
  variant?: 'card' | 'row'
  containerClassName?: string
  /** Fixed 28×28px hit target — same reserved size in every row */
  fixedSize?: boolean
}

const FIXED_SIZE_CLASSES = 'h-7 w-7 !p-0 inline-flex items-center justify-center'

const VARIANT_CONFIG = {
  card: {
    containerClassName: 'absolute left-2 top-2 z-20',
    revealOnHover: 'card' as const,
    className: 'text-white/70 hover:bg-white/15 hover:text-white',
  },
  row: {
    containerClassName: undefined,
    revealOnHover: true as const,
    className: undefined,
  },
} as const

export function WizardDeleteButton({
  variant = 'row',
  title = 'מחיקה',
  iconSize = 14,
  containerClassName,
  className,
  fixedSize = false,
  ...props
}: WizardDeleteButtonProps) {
  const config = VARIANT_CONFIG[variant]
  const wrapperClassName = containerClassName ?? config.containerClassName
  const resolvedIconSize = fixedSize ? 14 : iconSize

  const button = (
    <DeleteButton
      revealOnHover={config.revealOnHover}
      iconSize={resolvedIconSize}
      title={title}
      className={cn(
        config.className,
        fixedSize && FIXED_SIZE_CLASSES,
        className,
      )}
      {...props}
    />
  )

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{button}</div>
  }

  return button
}
