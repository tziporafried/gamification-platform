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
