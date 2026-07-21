import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { Ticket } from './Ticket'
import type { RaffleTicketData } from './raffleTiming'

interface TicketCollectorProps {
  tickets: RaffleTicketData[]
  onTicketEntered?: (ticketId: string) => void
}

/** Magnetic pull — every ticket accelerates into the raffle slot. */
export function TicketCollector({ tickets, onTicketEntered }: TicketCollectorProps) {
  return (
    <TicketFlightLayer>
      {tickets.map((ticket) => (
        <Ticket
          key={ticket.id}
          ticket={ticket}
          phase="collect"
          onEntered={() => onTicketEntered?.(ticket.id)}
        />
      ))}
    </TicketFlightLayer>
  )
}

/**
 * Full-viewport rain→collect layer via portal — escapes any parent
 * max-width / transform / filter that would crop tickets to a square.
 */
export function TicketFlight({
  tickets,
  phase,
  onTicketEntered,
}: {
  tickets: RaffleTicketData[]
  phase: 'rain' | 'collect'
  onTicketEntered?: (ticketId: string) => void
}) {
  return (
    <TicketFlightLayer>
      {tickets.map((ticket) => (
        <Ticket
          key={ticket.id}
          ticket={ticket}
          phase={phase}
          onEntered={phase === 'collect' ? () => onTicketEntered?.(ticket.id) : undefined}
        />
      ))}
    </TicketFlightLayer>
  )
}

function TicketFlightLayer({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[80] overflow-hidden"
      aria-hidden="true"
    >
      {children}
    </div>,
    document.body,
  )
}
