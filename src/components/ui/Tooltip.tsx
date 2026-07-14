import { ReactNode, RefObject, useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  className?: string
  side?: 'top' | 'bottom'
  hidden?: boolean
  /**
   * Render tooltip in a portal with fixed positioning.
   * Use inside overflow-hidden containers (e.g. event cards).
   */
  portal?: boolean
  /** Wider padded tip for multi-line / persuasive copy. */
  rich?: boolean
}

const tipClassName = cn(
  'pointer-events-none z-[100] w-max',
  'rounded-lg border border-border bg-surface-elevated text-foreground shadow-card',
)

export function Tooltip({
  content,
  children,
  className,
  side = 'top',
  hidden = false,
  portal = false,
  rich = false,
}: TooltipProps) {
  if (hidden || content == null || content === '') {
    return <>{children}</>
  }

  const tipSurface = cn(
    tipClassName,
    rich
      ? 'max-w-[15.5rem] px-3.5 py-2.5 text-right'
      : 'max-w-[16rem] px-3 py-1.5 text-center text-xs',
  )

  if (portal) {
    return (
      <PortalTooltip content={content} side={side} className={className} tipClassName={tipSurface}>
        {children}
      </PortalTooltip>
    )
  }

  return (
    <span className={cn('group/tooltip relative flex max-w-full min-w-0', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          tipSurface,
          'absolute left-1/2 -translate-x-1/2 opacity-0 transition-opacity duration-150',
          'group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        )}
      >
        {content}
      </span>
    </span>
  )
}

function PortalTooltip({
  content,
  children,
  className,
  side,
  tipClassName: tipSurface,
}: {
  content: ReactNode
  children: ReactNode
  className?: string
  side: 'top' | 'bottom'
  tipClassName: string
}) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tipId = useId()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  const updatePosition = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 8
    setCoords({
      left: rect.left + rect.width / 2,
      top: side === 'top' ? rect.top - gap : rect.bottom + gap,
    })
  }, [side])

  const show = useCallback(() => {
    updatePosition()
    setOpen(true)
  }, [updatePosition])

  const hide = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, updatePosition])

  return (
    <span
      ref={anchorRef}
      className={cn('inline-flex max-w-full min-w-0', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && coords && typeof document !== 'undefined' && createPortal(
        <span
          id={tipId}
          role="tooltip"
          className={cn(
            tipSurface,
            'fixed -translate-x-1/2',
            side === 'top' ? '-translate-y-full' : '',
          )}
          style={{ top: coords.top, left: coords.left }}
        >
          {content}
        </span>,
        document.body,
      )}
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
