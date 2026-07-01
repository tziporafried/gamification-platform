import { ReactNode, RefObject } from 'react'
import { cn } from '@/lib/utils'
import { ScrollContainer } from './ScrollContainer'

interface ScrollableListLayoutProps {
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  listRef?: RefObject<HTMLDivElement>
  className?: string
  listClassName?: string
}

export function ScrollableListLayout({
  header,
  footer,
  children,
  listRef,
  className,
  listClassName,
}: ScrollableListLayoutProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      {header}
      <ScrollContainer
        ref={listRef}
        className={cn('flex-1 space-y-2', listClassName)}
      >
        {children}
      </ScrollContainer>
      {footer && <div className="shrink-0 pt-3">{footer}</div>}
    </div>
  )
}
