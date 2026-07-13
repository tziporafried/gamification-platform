/**
 * Approved palette hex values — mirrors design-tokens.css primitives.
 * Use for colors persisted to the database (groups, templates).
 */

export const PALETTE_BRAND_PRIMARY = '#D83000'
export const PALETTE_BRAND_ACCENT = '#FC6024'
export const PALETTE_SECONDARY = '#009090'
export const PALETTE_TERTIARY = '#FC9000'
export const PALETTE_SUCCESS = '#45CF6B'
export const PALETTE_WARNING = '#FFB800'
export const PALETTE_DANGER = '#FF4D4D'
export const PALETTE_MUTED = '#7D706A'

export const PRESET_COLORS = [
  PALETTE_BRAND_PRIMARY,
  PALETTE_BRAND_ACCENT,
  PALETTE_SECONDARY,
  PALETTE_TERTIARY,
  PALETTE_SUCCESS,
  PALETTE_WARNING,
  PALETTE_DANGER,
  PALETTE_MUTED,
] as const

export const DEFAULT_PRESET_COLOR = PALETTE_BRAND_PRIMARY

export function getNextPresetColor(usedColors: string[] = []): string {
  const used = new Set(usedColors.map((color) => normalizeHexColor(color)))
  const unused = PRESET_COLORS.filter((color) => !used.has(color.toLowerCase()))
  const pool = unused.length > 0 ? unused : PRESET_COLORS
  return pool[Math.floor(Math.random() * pool.length)]
}

export function getRandomPresetColor(): string {
  return getNextPresetColor()
}

export function isPresetColor(color: string): boolean {
  return PRESET_COLORS.some((preset) => preset.toLowerCase() === color.toLowerCase())
}

export function normalizeHexColor(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase()
  return DEFAULT_PRESET_COLOR
}
