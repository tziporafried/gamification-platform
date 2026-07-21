import { Ticket } from './Ticket'
import type { RaffleTicketData } from './raffleTiming'

interface TicketRainProps {
  tickets: RaffleTicketData[]
}

/** Tickets appear from screen edges with unsynchronized spring motion. */
export function TicketRain({ tickets }: TicketRainProps) {
  return (
    <div className="absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
      {tickets.map((ticket) => (
        <Ticket key={ticket.id} ticket={ticket} phase="rain" />
      ))}
    </div>
  )
}
