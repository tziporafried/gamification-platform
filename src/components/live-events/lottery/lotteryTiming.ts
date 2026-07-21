/**
 * Continuous intro bed (trimmed + full) — draw starts when this ends.
 */
export const LOTTERY_INTRO_BED_MS = 20_080
export const LOTTERY_INTRO_DURATION_MS = LOTTERY_INTRO_BED_MS
export const LOTTERY_INTRO_SHOW_MS = LOTTERY_INTRO_BED_MS

/** @deprecated Legacy constants kept for unused sequence helpers. */
export const LOTTERY_PRE_DRAW_TIMING = {
  lock: 500,
  card: 2_500,
  countdown: 800,
  summary: 1_000,
} as const
