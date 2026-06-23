export interface AccentRgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): AccentRgb {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16) || 139,
    g: parseInt(h.substring(2, 4), 16) || 92,
    b: parseInt(h.substring(4, 6), 16) || 246,
  }
}

export function rgba(rgb: AccentRgb, alpha: number): string {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`
}
