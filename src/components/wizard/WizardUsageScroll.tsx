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

/** One scroll region so usage bar, list, and footer share the exact same width. */
export function WizardUsageScroll({
  usageBar,
  footer,
  scrollRef,
  className,
  children,
}: WizardUsageScrollProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <ScrollContainer ref={scrollRef} className="flex-1">
        {usageBar && <div className="pb-3">{usageBar}</div>}
        {children}
        {footer && <div className="pt-2">{footer}</div>}
      </ScrollContainer>
    </div>
  )
}
