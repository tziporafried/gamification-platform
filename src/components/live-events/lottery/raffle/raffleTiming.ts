/**
 * Configurable timing & motion for the Gamify raffle ceremony.
 * Longer rain + slow collect for drama (~18s to finished).
 */
export const RAFFLE_TIMING = {
  ready: 1_000,
  /** Tickets float in the air — build anticipation. */
  ticketRain: 3_600,
  /** Slow magnetic pull into the box. */
  collecting: 4_800,
  /** Lid-close crossfade (~550ms) plus a beat of pause before the shake starts. */
  closeBox: 1_800,
  shake: 2_400,
  stop: 800,
  winner: 2_200,
  open: 1_600,
} as const

export const RAFFLE_SPRINGS = {
  idle: { type: 'spring' as const, stiffness: 90, damping: 18, mass: 1.1 },
  ticketAppear: { type: 'spring' as const, stiffness: 180, damping: 16 },
  /** Slower collect — tickets drift in gradually. */
  ticketCollect: { duration: 1.55, ease: [0.4, 0.05, 0.2, 1] as const },
  lidClose: { type: 'spring' as const, stiffness: 160, damping: 18 },
  shake: { duration: 0.4, ease: 'easeInOut' as const },
  winnerRise: { type: 'spring' as const, stiffness: 110, damping: 15, mass: 0.95 },
  winnerHero: { type: 'spring' as const, stiffness: 95, damping: 12, mass: 1 },
  unfold: { type: 'spring' as const, stiffness: 90, damping: 14 },
  reveal: { type: 'spring' as const, stiffness: 150, damping: 16 },
}

export const RAFFLE_ASSETS = {
  empty: '/images/lottery/raffle-box-empty.png',
  openEmpty: '/images/lottery/raffle-box-open-empty.png',
  open: '/images/lottery/raffle-box-open.png',
  full: '/images/lottery/raffle-box-full.png',
} as const

/** Cap on-screen tickets for 60fps (all eligible still "in" the draw). */
export const RAFFLE_MAX_VISIBLE_TICKETS = 40

/**
 * Fraction down the open-box artwork where its mouth (the front rim tickets
 * drop through) sits — measured from raffle-box-open.png. Combined with the
 * box's live on-screen rect, this aims the collecting ticket flight at the
 * real opening instead of a guessed viewport position.
 */
export const OPEN_BOX_SLOT_Y_FRACTION = 0.42

export type RafflePhase =
  | 'ready'
  | 'ticketRain'
  | 'collecting'
  | 'closeBox'
  | 'shake'
  | 'stop'
  | 'winner'
  | 'open'
  | 'finished'

/** Visual box asset key. */
export type RaffleBoxKind = 'openEmpty' | 'open' | 'full' | 'empty'

export interface RaffleTicketData {
  id: string
  name: string
  /** Which side startX/startY are measured from — box grows inward, never past the viewport edge. */
  anchorX?: 'left' | 'right'
  anchorY?: 'top' | 'bottom'
  startX: number
  startY: number
  enterDelay: number
  rotate: number
  drift: number
  scale: number
}

export function boxKindForPhase(phase: RafflePhase): RaffleBoxKind {
  switch (phase) {
    case 'ready':
    case 'ticketRain':
      return 'openEmpty'
    case 'collecting':
      return 'open'
    case 'closeBox':
    case 'shake':
    case 'stop':
    case 'winner':
    case 'open':
    case 'finished':
      // Box stays closed — the winning ticket exits through the top slot.
      return 'full'
    default:
      return 'openEmpty'
  }
}

/** Cumulative ms when each phase begins (after ready starts at 0). */
export function buildPhaseSchedule() {
  const t = RAFFLE_TIMING
  let at = 0
  const start: Record<RafflePhase, number> = {
    ready: 0,
    ticketRain: 0,
    collecting: 0,
    closeBox: 0,
    shake: 0,
    stop: 0,
    winner: 0,
    open: 0,
    finished: 0,
  }
  start.ready = 0
  at += t.ready
  start.ticketRain = at
  at += t.ticketRain
  start.collecting = at
  at += t.collecting
  start.closeBox = at
  at += t.closeBox
  start.shake = at
  at += t.shake
  start.stop = at
  at += t.stop
  start.winner = at
  at += t.winner
  start.open = at
  at += t.open
  start.finished = at
  return start
}
