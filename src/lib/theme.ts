/** App design tokens — edit this file to swap the design language app-wide. */
export const theme = {
  // Page shells
  pageBg: 'bg-game-dark',
  pageRadial: 'bg-game-radial',

  // Atomic colors
  bg: 'bg-game-dark',
  bgCard: 'bg-game-card',
  bgCardMuted: 'bg-game-card/50',
  bgInset: 'bg-game-dark',
  border: 'border-game-border',
  text: 'text-white',
  textMuted: 'text-gray-400',
  textSubtle: 'text-gray-500',
  label: 'text-gray-300',
  accentText: 'text-brand-400',
  accentBorder: 'border-brand-500/30',
  accentBg: 'bg-brand-500/10',
  focusRing: 'focus:ring-brand-500/30',
  focusBorder: 'focus:border-brand-500',
  inputBg: 'bg-game-dark',
  inputBorder: 'border-game-border',
  inputPlaceholder: 'placeholder-gray-500',
  hoverSurface: 'hover:bg-white/5',
  hoverText: 'hover:text-white',
  progressTrack: 'bg-game-border',
  progressFill: 'bg-brand-500',
  spinner: 'border-brand-600',
  iconBg: 'bg-brand-500/20',
  iconBgSubtle: 'bg-brand-500/15',

  // Composite surfaces — prefer these over repeating class strings
  surfaceCard: 'rounded-xl border border-game-border bg-game-card shadow-card',
  surfaceCardElevated: 'rounded-xl border border-game-border bg-game-card shadow-podium',
  surfacePanel: 'rounded-2xl border border-game-border bg-game-card shadow-card',
  surfaceMuted: 'rounded-2xl border border-game-border bg-game-card/50',
  surfaceInset: 'rounded-xl border border-game-border bg-game-dark',
  surfaceEmpty:
    'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-game-border bg-game-card/30 px-6 py-12 text-center',
  surfaceInteractive:
    'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 hover:border-brand-700/50',

  // Icon containers
  iconBox: 'flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400',
  iconBoxSm: 'flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20',
  iconBoxMd: 'flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20',
} as const

export const buttonVariants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500',
  secondary: 'bg-white/10 text-gray-200 hover:bg-white/15 focus:ring-gray-500',
  outline: 'border border-game-border text-gray-300 hover:bg-white/5 focus:ring-brand-500',
  ghost: 'text-gray-400 hover:bg-white/10 hover:text-gray-200 focus:ring-gray-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  gradient: 'gradient-brand text-white hover:opacity-90 focus:ring-brand-500 shadow-sm',
} as const

export const alertVariants = {
  error: 'rounded-lg bg-red-900/20 border border-red-800/30 text-red-300',
  success: 'rounded-lg bg-emerald-900/20 border border-emerald-800/30 text-emerald-300',
  warning: 'rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200',
} as const

export const chipColors = {
  brand: 'border-brand-500/30 text-brand-400 bg-brand-400/10 hover:bg-brand-400/15',
  amber: 'border-amber-500/30 text-amber-400 bg-amber-400/10 hover:bg-amber-400/15',
  cyan: 'border-cyan-500/30 text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/15',
  default: 'border-game-border text-gray-400 bg-white/5 hover:bg-white/10',
} as const

export type ButtonVariant = keyof typeof buttonVariants
export type AlertVariant = keyof typeof alertVariants
export type ChipColor = keyof typeof chipColors
