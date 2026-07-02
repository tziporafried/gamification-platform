import { ReactNode, Ref } from 'react'
import { ScrollContainer } from '@/components/ui/ScrollContainer'
import { cn } from '@/lib/utils'

interface WizardUsageScrollProps {
  usageBar?: ReactNode
  footer?: ReactNode
  scrollRef?: Ref<HTMLDivElement>
  className?: string
  children: ReactNode
}

/** Scrollable list with optional pinned usage bar (top) and add field (bottom). */
export function WizardUsageScroll({
  usageBar,
  footer,
  scrollRef,
  className,
  children,
}: WizardUsageScrollProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {usageBar && <div className="shrink-0 pb-3">{usageBar}</div>}
      <ScrollContainer ref={scrollRef} className="min-h-0 flex-1">
        {children}
      </ScrollContainer>
      {footer && <div className="shrink-0 pt-2">{footer}</div>}
    </div>
  )
}
