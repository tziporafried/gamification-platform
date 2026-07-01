/** App design tokens — semantic token class strings for app-wide styling. */
export const theme = {
  // Page shells
  pageBg: 'bg-app-radial',
  pageRadial: 'bg-app-radial',

  // Atomic colors
  bg: 'bg-app-radial',
  bgCard: 'bg-surface',
  bgCardMuted: 'bg-surface-elevated',
  bgInset: 'bg-surface-elevated',
  border: 'border-border',
  text: 'text-foreground',
  textMuted: 'text-muted',
  textSubtle: 'text-muted',
  label: 'text-foreground',
  accentText: 'text-accent',
  accentBorder: 'border-accent',
  accentBg: 'bg-surface-elevated',
  focusRing: 'focus:outline-none focus-visible:outline-none',
  focusBorder: 'focus:border-tertiary',
  focusWithinBorder: 'focus-within:border-tertiary',
  inputBg: 'bg-surface',
  inputBorder: 'border-border',
  inputPlaceholder: 'placeholder-muted',
  hoverSurface: 'hover:bg-surface-elevated',
  hoverText: 'hover:text-foreground',
  progressTrack: 'bg-border',
  progressFill: 'bg-secondary',
  spinner: 'border-tertiary',
  checkbox: 'accent-tertiary focus:ring-tertiary',
  iconBg: 'bg-surface-elevated',
  iconBgSubtle: 'bg-surface-elevated',

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

  // Icon containers
  iconBox: 'flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated text-secondary',
  iconBoxSm: 'flex h-8 w-8 items-center justify-center rounded-lg bg-surface-elevated text-secondary',
  iconBoxMd: 'flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated text-secondary',
} as const

export const buttonVariants = {
  primary: 'bg-primary text-[var(--color-on-primary)] hover:bg-primary-hover focus:ring-primary font-semibold [&_svg]:text-[var(--color-on-primary)]',
  secondary: 'bg-secondary text-[var(--color-on-secondary)] hover:opacity-90 focus:ring-secondary font-semibold',
  outline: 'border border-border text-foreground hover:bg-surface-elevated focus:ring-secondary',
  soft: 'border border-primary bg-surface text-primary hover:bg-primary hover:text-[var(--color-on-primary)] focus:ring-primary font-medium',
  ghost: 'text-muted hover:bg-surface-elevated hover:text-foreground focus:ring-secondary',
  danger: 'bg-danger text-[var(--color-on-danger)] hover:bg-danger focus:ring-danger font-semibold',
  gradient: 'bg-primary text-[var(--color-on-primary)] hover:bg-primary-hover focus:ring-primary font-semibold [&_svg]:text-[var(--color-on-primary)]',
} as const

export const alertVariants = {
  error: 'rounded-lg bg-surface-elevated border border-danger text-danger',
  success: 'rounded-lg bg-surface-elevated border border-success text-success',
  warning: 'rounded-lg bg-surface-elevated border border-warning text-warning-foreground',
} as const

export const chipColors = {
  brand: 'border-primary text-primary bg-surface-elevated hover:bg-surface',
  accent: 'border-accent text-accent bg-surface-elevated hover:bg-surface',
  amber: 'border-warning text-warning bg-surface-elevated hover:bg-surface',
  cyan: 'border-secondary text-secondary bg-surface-elevated hover:bg-surface',
  default: 'border-border text-muted bg-surface-elevated hover:bg-surface',
} as const

export type ButtonVariant = keyof typeof buttonVariants
export type AlertVariant = keyof typeof alertVariants
export type ChipColor = keyof typeof chipColors
