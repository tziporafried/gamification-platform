export interface AccentRgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): AccentRgb {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  // Fall back to brand orange (#AB3500) if the hex string is invalid
  return {
    r: isNaN(r) ? 171 : r,
    g: isNaN(g) ? 53 : g,
    b: isNaN(b) ? 0 : b,
  }
}

export function rgba(rgb: AccentRgb, alpha: number): string {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`
}
