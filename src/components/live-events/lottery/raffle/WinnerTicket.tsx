import { Ticket } from './Ticket'
import type { RaffleTicketData } from './raffleTiming'

interface WinnerTicketProps {
  ticket: RaffleTicketData
  phase: 'winnerRise' | 'winnerHero'
}

/** Glowing ticket rises from the box — plain paper, no branding. */
export function WinnerTicket({ ticket, phase }: WinnerTicketProps) {
  return <Ticket ticket={ticket} phase={phase} isWinner />
}
