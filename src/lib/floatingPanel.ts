export function getPanelLeftAlignedToTriggerRight(
  triggerRight: number,
  panelWidth: number,
  viewportPadding = 8,
): number {
  const left = triggerRight - panelWidth
  return Math.max(
    viewportPadding,
    Math.min(left, window.innerWidth - panelWidth - viewportPadding),
  )
}

export interface FloatingPanelSize {
  width: number
  height: number
}

export interface FloatingPanelPosition {
  top: number
  left: number
  maxHeight?: number
}

export interface FloatingPanelOptions {
  gap?: number
  viewportPadding?: number
}

/** Position a fixed portal panel beside its trigger, clamped to the viewport. */
export function positionFloatingPanel(
  triggerRect: DOMRect,
  panelSize: FloatingPanelSize,
  options: FloatingPanelOptions = {},
): FloatingPanelPosition {
  const gap = options.gap ?? 4
  const pad = options.viewportPadding ?? 8
  const { width, height } = panelSize
  const maxHeight = window.innerHeight - pad * 2

  const spaceBelow = window.innerHeight - triggerRect.bottom - pad
  const spaceAbove = triggerRect.top - pad
  const openUp = height + gap > spaceBelow && spaceAbove > spaceBelow

  let top = openUp
    ? triggerRect.top - height - gap
    : triggerRect.bottom + gap

  const clampedHeight = Math.min(height, maxHeight)
  top = Math.max(pad, Math.min(top, window.innerHeight - clampedHeight - pad))

  const left = getPanelLeftAlignedToTriggerRight(triggerRect.right, width, pad)

  return { top, left, maxHeight }
}

export function isRectInsideViewport(
  rect: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
  padding = 0,
): boolean {
  return (
    rect.x >= padding
    && rect.y >= padding
    && rect.x + rect.width <= viewport.width - padding
    && rect.y + rect.height <= viewport.height - padding
  )
}
