import { ReactNode, RefObject, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  children: ReactNode
  className?: string
  side?: 'top' | 'bottom'
  hidden?: boolean
}

export function Tooltip({
  content,
  children,
  className,
  side = 'top',
  hidden = false,
}: TooltipProps) {
  if (hidden || !content) {
    return <>{children}</>
  }

  return (
    <span className={cn('group/tooltip relative flex max-w-full min-w-0', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 w-max max-w-[16rem] -translate-x-1/2',
          'rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-center text-xs text-foreground shadow-card',
          'opacity-0 transition-opacity duration-150',
          'group-hover/tooltip:opacity-100 group-focus-visible/tooltip:opacity-100',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        )}
      >
        {content}
      </span>
    </span>
  )
}

export function useIsTruncated<T extends HTMLElement>(
  ref: RefObject<T | null>,
  deps: unknown,
) {
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const check = () => setTruncated(el.scrollWidth > el.clientWidth)
    check()

    const observer = new ResizeObserver(check)
    observer.observe(el)
    window.addEventListener('resize', check)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [ref, deps])

  return truncated
}

interface TruncatedTooltipTextProps {
  text: string
  className?: string
  as?: 'p' | 'span'
}

export function TruncatedTooltipText({
  text,
  className,
  as: Tag = 'p',
}: TruncatedTooltipTextProps) {
  const ref = useRef<HTMLElement>(null)
  const truncated = useIsTruncated(ref, text)

  return (
    <Tooltip content={text} hidden={!truncated} className="w-full min-w-0">
      <Tag ref={ref as never} className={className}>
        {text}
      </Tag>
    </Tooltip>
  )
}
