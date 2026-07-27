import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The lottery settings area, as one thing.
 *
 * Not three cards that happen to sit next to each other - one bar, on one
 * grid, holding sections that share a single anatomy:
 *
 *     label     16px   what this setting is
 *     (gap)      8px
 *     control   40px   the control, and whatever that choice needs next
 *                     ─────
 *                     64px, always
 *
 * One row, not two. What a choice needs afterwards - a points line, a group
 * picker, the scan round - opens *inside the chosen option itself*, so a
 * segmented control reads as one sentence: the option and its detail are the
 * same object, and an option that needs no detail is simply shorter.
 *
 * Every rule below exists to stop the bar moving. Rows are fixed heights
 * rather than content heights, and only the chosen segment grows - sideways,
 * never taller - so switching choices never changes a height anywhere.
 *
 * Spacing is 8 / 16 / 24 only. Three control sizes, each centred on the line
 * above it: 40px for a section's own control, 32px for a segment, 24px for
 * anything that opened inside one. There are no nested boxes: sections are
 * separated by whitespace, and the only filled surface is the one button that
 * starts the show.
 */

// ─── the scale ───────────────────────────────────────────────────────────────

/** Row heights. Fixed, so the bar never reflows. */
export const SETTINGS_LABEL_H = 'h-4' /* 16 */
export const SETTINGS_MAIN_H = 'h-10' /* 40 */
/** Controls that open up *inside* a selected segment. */
export const SETTINGS_INLINE_H = 'h-6' /* 24 */

/** A section's full height: 16 label + 8 gap + 40 control. */
export const SETTINGS_BLOCK_H = 'h-16' /* 64 */

// ─── the language ────────────────────────────────────────────────────────────

export const SETTINGS_LABEL = cn(
  SETTINGS_LABEL_H,
  'block text-[11px] font-bold leading-4 tracking-wide text-muted',
)

/** Text inputs and anything shaped like one. */
export const SETTINGS_FIELD = cn(
  SETTINGS_MAIN_H,
  'w-full rounded-xl border border-black/[0.07] bg-white/70 px-3',
  'text-[15px] font-black text-foreground',
  'placeholder:font-semibold placeholder:text-muted/60',
  'transition-colors duration-150',
  'focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15',
)

/** The track a segmented control sits in. Its buttons are SETTINGS_SEGMENT. */
export const SETTINGS_SEGMENT_TRACK = cn(
  SETTINGS_MAIN_H,
  'flex w-fit max-w-full items-center gap-1 rounded-xl bg-black/[0.05] p-1',
)

export const SETTINGS_SEGMENT = cn(
  'flex h-8 cursor-pointer select-none items-center gap-2 rounded-lg px-3',
  'text-[13px] font-black leading-none',
  'transition-all duration-150 active:scale-[0.97]',
)

export const SETTINGS_SEGMENT_ON = 'bg-white text-primary shadow-sm'
export const SETTINGS_SEGMENT_OFF = 'text-foreground/70 hover:bg-white/60 hover:text-foreground'

/** Buttons and triggers that live inside the selected segment. */
export const SETTINGS_INLINE_BUTTON = cn(
  SETTINGS_INLINE_H,
  'inline-flex shrink-0 items-center gap-1 rounded-md px-2',
  'text-[12px] font-black leading-none transition-all duration-150',
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
)

/** Inputs that live inside the selected segment. */
export const SETTINGS_INLINE_FIELD = cn(
  SETTINGS_INLINE_H,
  'rounded-md border border-primary/25 bg-primary/[0.07] px-1.5',
  'text-center text-[12px] font-black tabular-nums text-primary',
  'transition-colors duration-150',
  'focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15',
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
)

/** The hairline between a segment's label and what it expanded into. */
export const SETTINGS_INLINE_DIVIDER = 'h-4 w-px shrink-0 bg-current opacity-20'

// ─── the structure ───────────────────────────────────────────────────────────

interface LotterySettingsBarProps {
  children: ReactNode
}

/**
 * The grid. Two settings columns that stretch, and the action at its natural
 * width - so the button never drifts and the two settings keep their
 * proportions on every screen the projector might be.
 */
export function LotterySettingsBar({ children }: LotterySettingsBarProps) {
  return (
    <div
      className={cn(
        'grid w-full items-start gap-6',
        '[grid-template-columns:minmax(180px,0.85fr)_minmax(320px,1.6fr)_auto]',
      )}
    >
      {children}
    </div>
  )
}

interface SettingsSectionProps {
  label: string
  /**
   * The control the organizer always sees, first on the line - and after it,
   * whatever the current choice needs. Keeping the control first is what lets
   * the follow-up appear and change without anything moving.
   */
  children: ReactNode
  className?: string
}

export function SettingsSection({ label, children, className }: SettingsSectionProps) {
  return (
    <section className={cn('flex min-w-0 flex-col', SETTINGS_BLOCK_H, className)}>
      <span className={SETTINGS_LABEL}>{label}</span>
      <div className={cn('mt-2 flex min-w-0 items-center gap-4', SETTINGS_MAIN_H)}>{children}</div>
    </section>
  )
}
