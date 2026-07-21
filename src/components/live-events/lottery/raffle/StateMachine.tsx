import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { buildPhaseSchedule, type RafflePhase } from './raffleTiming'

/**
 * Linear raffle ceremony state machine.
 * ready → ticketRain → collecting → closeBox → shake → stop → winner → open → finished
 */
export function useRaffleStateMachine(enabled = true) {
  const [phase, setPhase] = useState<RafflePhase>('ready')
  const scheduleRef = useRef(buildPhaseSchedule())

  useEffect(() => {
    if (!enabled) return
    const schedule = buildPhaseSchedule()
    scheduleRef.current = schedule
    setPhase('ready')
    const order: RafflePhase[] = [
      'ticketRain',
      'collecting',
      'closeBox',
      'shake',
      'stop',
      'winner',
      'open',
      'finished',
    ]
    const timers = order.map((next) =>
      window.setTimeout(() => setPhase(next), schedule[next]),
    )
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [enabled])

  return phase
}

/** Presentational alias matching the architecture brief. */
export function StateMachine({
  children,
}: {
  children: (phase: RafflePhase) => ReactNode
}) {
  const phase = useRaffleStateMachine()
  return <>{children(phase)}</>
}
