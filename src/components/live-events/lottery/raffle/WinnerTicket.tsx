import { Ticket } from './Ticket'
import type { RaffleTicketData } from './raffleTiming'

interface WinnerTicketProps {
  ticket: RaffleTicketData
  phase: 'winnerRise' | 'winnerHero'
  /** Measured box opening - the winner rises out of it, not out of mid-air. */
  slot?: { left: string; top: string }
}

/** Glowing ticket rises from the box — plain paper, no branding. */
export function WinnerTicket({ ticket, phase, slot }: WinnerTicketProps) {
  return <Ticket ticket={ticket} phase={phase} slot={slot} isWinner />
}
