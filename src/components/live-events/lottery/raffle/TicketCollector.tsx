import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { Ticket } from './Ticket'
import type { RaffleTicketData } from './raffleTiming'

interface TicketSlot {
  left: string
  top: string
}

interface TicketCollectorProps {
  tickets: RaffleTicketData[]
  onTicketEntered?: (ticketId: string) => void
  /** Real on-screen position of the box's opening — where tickets converge. */
  slot?: TicketSlot
}

/** Magnetic pull — every ticket accelerates into the raffle slot. */
export function TicketCollector({ tickets, onTicketEntered, slot }: TicketCollectorProps) {
  return (
    <TicketFlightLayer>
      {tickets.map((ticket) => (
        <Ticket
          key={ticket.id}
          ticket={ticket}
          phase="collect"
          slot={slot}
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
  slot,
}: {
  tickets: RaffleTicketData[]
  phase: 'rain' | 'collect'
  onTicketEntered?: (ticketId: string) => void
  slot?: TicketSlot
}) {
  return (
    <TicketFlightLayer>
      {tickets.map((ticket) => (
        <Ticket
          key={ticket.id}
          ticket={ticket}
          phase={phase}
          slot={slot}
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
