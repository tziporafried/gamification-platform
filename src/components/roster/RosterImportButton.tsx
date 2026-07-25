import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface RosterImportButtonProps {
  onClick: () => void
  label: string
  /** 'row' sits above the inline add field; 'button' sits inside an empty state. */
  variant?: 'row' | 'button'
  className?: string
}

export function RosterImportButton({ onClick, label, variant = 'row', className }: RosterImportButtonProps) {
  if (variant === 'button') {
    return (
      <Button size="sm" variant="outline" className={cn('gap-1.5', className)} onClick={onClick}>
        <FileSpreadsheet size={16} className="shrink-0" strokeWidth={2} aria-hidden="true" />
        {label}
      </Button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted transition-colors',
        'border border-dashed border-border bg-surface hover:border-accent hover:text-foreground',
        theme.focusRing,
        className,
      )}
    >
      <FileSpreadsheet size={14} className="shrink-0" strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  )
}
