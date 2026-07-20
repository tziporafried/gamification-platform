/** App design tokens - semantic token class strings for app-wide styling. */
export const theme = {
  // Page shells
  pageBg: 'bg-app-radial',
  pageRadial: 'bg-app-radial',

  // Atomic colors
  bg: 'bg-app-radial',
  bgCard: 'bg-surface',
  bgModal: 'bg-modal',
  bgCardMuted: 'bg-surface-elevated',
  bgInset: 'bg-surface-elevated',
  border: 'border-border',
  /** Gray bordered surfaces - uniform default + orange hover (wizard & lists) */
  borderInteractive: 'border border-border transition-colors hover:border-accent',
  borderInteractiveDashed:
    'border border-dashed border-border transition-colors hover:border-accent',
  text: 'text-foreground',
  textMuted: 'text-muted',
  textSubtle: 'text-muted',
  label: 'text-foreground',
  accentText: 'text-accent-text',
  accentBorder: 'border-accent',
  accentBg: 'bg-surface-elevated',
  /**
   * WCAG 2.4.7 - this used to be `focus:outline-none focus-visible:outline-none`,
   * which stripped the browser default and put nothing back, leaving keyboard
   * users with no focus indicator at all. The offset ring reads against every
   * surface and only shows for keyboard focus, so pointer users see no change.
   */
  focusRing:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary-text focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  focusBorder: 'focus:border-tertiary-text',
  focusWithinBorder: 'focus-within:border-tertiary-text',
  inputBg: 'bg-surface',
  inputBorder: 'border-border-strong',
  inputPlaceholder: 'placeholder-muted',
  hoverSurface: 'hover:bg-surface-elevated',
  hoverText: 'hover:text-foreground',
  progressTrack: 'bg-border',
  progressFill: 'bg-secondary',
  spinner: 'border-tertiary',
  checkbox: 'accent-tertiary-text focus-visible:ring-2 focus-visible:ring-tertiary-text focus-visible:ring-offset-2',
  iconBg: 'bg-surface-elevated',
  iconBgSubtle: 'bg-surface-elevated',

  /** Dropdown / select panel section titles */
  dropdownHeader: 'px-3 py-1.5 text-[11px] font-semibold text-primary-text text-right',

  // Composite surfaces
  surfaceCard: 'rounded-xl border border-border bg-surface shadow-card',
  surfaceCardElevated: 'rounded-xl border border-border bg-surface-elevated shadow-podium',
  surfacePanel: 'rounded-2xl border border-border bg-surface shadow-card',
  surfaceMuted: 'rounded-2xl border border-border bg-surface-elevated',
  surfaceInset: 'rounded-xl border border-border bg-surface-elevated',
  surfaceEmpty:
    'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface-elevated px-6 py-12 text-center',
  surfaceInteractive:
    'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 hover:border-accent',

  /** Wizard list rows - base shadow + subtle hover lift */
  wizardListRowHover:
    'shadow-lift transition-[box-shadow,transform] duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.002] hover:shadow-card-hover before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:bg-black/0 before:transition-colors before:duration-[180ms] hover:before:bg-black/[0.04] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0 motion-reduce:hover:before:bg-black/0',

  /** Compact chip triggers in wizard rows (groups, limits, etc.) */
  wizardCompactChip:
    'inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-normal leading-none shrink-0 transition-all [&_svg]:size-3 [&_svg]:shrink-0',

  // Icon containers
  iconBox: 'flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated text-secondary-text',
  iconBoxSm: 'flex h-8 w-8 items-center justify-center rounded-lg bg-surface-elevated text-secondary-text',
  iconBoxMd: 'flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated text-secondary-text',
} as const

export const buttonVariants = {
  primary: 'bg-primary text-[var(--color-on-primary)] hover:bg-primary-hover focus-visible:ring-primary font-semibold [&_svg]:text-[var(--color-on-primary)]',
  // `-strong` fills: white text on the plain secondary/danger tokens lands at
  // 3.7:1 and 3.1:1. The darker fills carry the same white at 4.5:1+.
  secondary: 'bg-secondary-strong text-[var(--color-on-secondary)] hover:opacity-90 focus-visible:ring-secondary-text font-semibold',
  outline: 'border border-border-strong text-foreground hover:bg-surface-elevated focus-visible:ring-secondary-text',
  soft: 'border border-primary bg-surface text-primary hover:bg-primary hover:text-[var(--color-on-primary)] focus-visible:ring-primary font-medium',
  ghost: 'text-muted hover:bg-surface-elevated hover:text-foreground focus-visible:ring-secondary-text',
  danger: 'bg-danger-strong text-[var(--color-on-danger)] hover:bg-danger-strong focus-visible:ring-danger-text font-semibold',
  gradient: 'bg-primary text-[var(--color-on-primary)] hover:bg-primary-hover focus-visible:ring-primary font-semibold [&_svg]:text-[var(--color-on-primary)]',
} as const

export const alertVariants = {
  error: 'rounded-lg bg-surface-elevated border border-danger text-danger-text',
  success: 'rounded-lg bg-surface-elevated border border-success text-success-text',
  warning: 'rounded-lg bg-surface-elevated border border-warning text-warning-text',
} as const

export const chipColors = {
  brand: 'border-primary text-primary-text bg-surface-elevated hover:bg-surface',
  accent: 'border-accent text-accent-text bg-surface-elevated hover:bg-surface',
  amber: 'border-warning text-warning-text bg-surface-elevated hover:bg-surface',
  cyan: 'border-secondary text-secondary-text bg-surface-elevated hover:bg-surface',
  default: 'border-border text-muted bg-surface-elevated hover:bg-surface hover:border-accent',
} as const

export type ButtonVariant = keyof typeof buttonVariants
export type AlertVariant = keyof typeof alertVariants
export type ChipColor = keyof typeof chipColors
