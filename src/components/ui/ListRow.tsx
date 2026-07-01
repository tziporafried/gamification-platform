import { HTMLAttributes, forwardRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface ListRowProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  children: ReactNode
}

export const ListRow = forwardRef<HTMLDivElement, ListRowProps>(
  ({ className, interactive = true, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 transition-all group',
        theme.bgCard,
        theme.border,
        interactive && 'hover:border-secondary',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)

ListRow.displayName = 'ListRow'
