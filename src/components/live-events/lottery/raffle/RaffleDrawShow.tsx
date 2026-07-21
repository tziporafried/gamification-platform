import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGroup, motion } from 'framer-motion'
import type { EligibleParticipant } from '../../types'
import { ConfettiOverlay } from '../ConfettiOverlay'
import { RaffleBox } from './RaffleBox'
import { RaffleParticles } from './RaffleParticles'
import { RaffleStatusText } from './RaffleStatusText'
import { useRaffleStateMachine } from './StateMachine'
import { TicketFlight } from './TicketCollector'
import { RaffleOrganizerControls, RaffleWinnerReveal } from './WinnerReveal'
import { WinnerTicket } from './WinnerTicket'
import {
  OPEN_BOX_SLOT_Y_FRACTION,
  RAFFLE_MAX_VISIBLE_TICKETS,
  RAFFLE_TIMING,
  boxKindForPhase,
  type RaffleTicketData,
} from './raffleTiming'
import { useRaffleDrawSfx } from './useRaffleDrawSfx'

export interface RaffleDrawShowProps {
  participants: EligibleParticipant[]
  winnerName: string
  prizeName: string
  prizeIcon: string
  onWinnerRevealed?: () => void
  onDrawAgain?: () => void
  onFinish?: () => void
  /** @deprecated Prefer onWinnerRevealed — kept for older callers. */
  onComplete?: () => void
}

function buildTickets(participants: EligibleParticipant[]): RaffleTicketData[] {
  const pool =
    participants.length <= RAFFLE_MAX_VISIBLE_TICKETS
      ? participants
      : participants
          .filter((_, i) => i % Math.ceil(participants.length / RAFFLE_MAX_VISIBLE_TICKETS) === 0)
          .slice(0, RAFFLE_MAX_VISIBLE_TICKETS)

  return pool.map((p, i) => {
    // 8 spawn zones — full viewport edges + corners.
    const zone = i % 8
    let startX = 50
    let startY = 40
    switch (zone) {
      case 0: // left
        startX = -6 + Math.random() * 10
        startY = 6 + Math.random() * 78
        break
      case 1: // right
        startX = 90 + Math.random() * 12
        startY = 6 + Math.random() * 78
        break
      case 2: // top
        startX = 4 + Math.random() * 92
        startY = -8 + Math.random() * 14
        break
      case 3: // bottom
        startX = 4 + Math.random() * 92
        startY = 86 + Math.random() * 16
        break
      case 4: // top-left
        startX = -4 + Math.random() * 22
        startY = -6 + Math.random() * 22
        break
      case 5: // top-right
        startX = 78 + Math.random() * 24
        startY = -6 + Math.random() * 22
        break
      case 6: // bottom-left
        startX = -4 + Math.random() * 24
        startY = 72 + Math.random() * 28
        break
      default: // bottom-right
        startX = 76 + Math.random() * 26
        startY = 72 + Math.random() * 28
        break
    }
    const enterDelay = (i / Math.max(pool.length - 1, 1)) * 3.2 + Math.random() * 0.55
    return {
      id: p.id,
      name: p.name,
      startX,
      startY,
      enterDelay,
      rotate: -42 + Math.random() * 84,
      drift: -40 + Math.random() * 80,
      scale: 1.15 + Math.random() * 0.35,
    }
  })
}

/**
 * Signature Gamify raffle ceremony — premium live-event state machine.
 */
export function RaffleDrawShow({
  participants,
  winnerName,
  prizeName,
  prizeIcon,
  onWinnerRevealed,
  onDrawAgain,
  onFinish,
  onComplete,
}: RaffleDrawShowProps) {
  const phase = useRaffleStateMachine(true)
  const tickets = useMemo(() => buildTickets(participants), [participants])
  const winnerTicket = useMemo<RaffleTicketData>(
    () => ({
      id: 'winner-ticket',
      name: winnerName,
      startX: 50,
      startY: 56,
      enterDelay: 0,
      rotate: -6,
      drift: 0,
      scale: 1,
    }),
    [winnerName],
  )

  const sfx = useRaffleDrawSfx()
  const insertTickRef = useRef(0)
  const revealedRef = useRef(false)
  const boxWrapRef = useRef<HTMLDivElement>(null)
  const [slot, setSlot] = useState({ left: '50%', top: '72%' })

  useEffect(() => {
    const measure = () => {
      const el = boxWrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const openingY = rect.top + rect.height * OPEN_BOX_SLOT_Y_FRACTION
      const left = ((rect.left + rect.width / 2) / window.innerWidth) * 100
      const top = (openingY / window.innerHeight) * 100
      setSlot({ left: `${left}%`, top: `${top}%` })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    if (phase === 'ticketRain') {
      const id = window.setInterval(() => sfx.playPaperFlutter(), 140)
      return () => window.clearInterval(id)
    }
    if (phase === 'collecting') {
      insertTickRef.current = 0
      const step = Math.max(90, RAFFLE_TIMING.collecting / Math.max(tickets.length, 1))
      const id = window.setInterval(() => {
        const i = insertTickRef.current++
        const last = i >= tickets.length - 1
        sfx.playTicketInsert(last)
        sfx.playMagneticWhoosh()
        if (last) window.clearInterval(id)
      }, step)
      return () => window.clearInterval(id)
    }
    if (phase === 'closeBox') sfx.playLidClick()
    if (phase === 'shake') {
      sfx.playBoxRumble()
      const id = window.setInterval(() => sfx.playBoxRumble(), 420)
      return () => window.clearInterval(id)
    }
    if (phase === 'winner') sfx.playSilenceShimmer()
    if (phase === 'open') {
      sfx.playTicketUnfold()
      sfx.playCinematicHit()
    }
  }, [phase, sfx, tickets.length])

  useEffect(() => {
    if (phase !== 'open' && phase !== 'finished') return
    if (revealedRef.current) return
    revealedRef.current = true
    onWinnerRevealed?.()
    onComplete?.()
  }, [phase, onWinnerRevealed, onComplete])

  const boxKind = boxKindForPhase(phase)
  const filling = phase === 'collecting'
  const closing = phase === 'closeBox'
  const shaking = phase === 'shake'
  const glowing =
    phase === 'collecting' ||
    phase === 'closeBox' ||
    phase === 'shake' ||
    phase === 'winner' ||
    phase === 'open'
  const idle = phase === 'ready'
  const energetic = phase === 'shake'
  const particlesOn = phase !== 'stop'
  const showFlight = phase === 'ticketRain' || phase === 'collecting'
  const showWinnerTicket = phase === 'winner' || phase === 'open' || phase === 'finished'
  const showBanner = phase === 'open' || phase === 'finished'
  const showControls = phase === 'finished'

  const statusText = (() => {
    switch (phase) {
      case 'ready':
        return ''
      case 'ticketRain':
        return 'כל הזכאים באוויר!'
      case 'collecting':
        return 'הפתקים נכנסים לקופסה…'
      case 'closeBox':
        return 'כל הפתקים בפנים!'
      case 'shake':
        return 'ההגרלה בעיצומה…'
      case 'stop':
        return 'והזוכה הוא…'
      case 'winner':
        return ''
      default:
        return ''
    }
  })()

  return (
    <LayoutGroup>
      <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(70,90,180,0.14),transparent_62%)]"
          aria-hidden="true"
        />

        {particlesOn && <RaffleParticles energetic={energetic} />}
        <ConfettiOverlay active={showBanner} count={72} />

        {showControls && (
          <RaffleOrganizerControls onDrawAgain={onDrawAgain} onFinish={onFinish} />
        )}

        {!showBanner && <RaffleStatusText phase={phase} text={statusText} />}

        {showBanner && (
          <RaffleWinnerReveal
            winnerName={winnerName}
            prizeName={prizeName}
            prizeIcon={prizeIcon}
          />
        )}

        {showFlight && (
          <TicketFlight
            tickets={tickets}
            phase={phase === 'ticketRain' ? 'rain' : 'collect'}
            slot={slot}
          />
        )}

        {showWinnerTicket && (
          <WinnerTicket
            ticket={winnerTicket}
            phase={phase === 'winner' ? 'winnerRise' : 'winnerHero'}
          />
        )}

        <div className="relative z-20 mt-auto flex flex-col items-center pb-4 pt-24 sm:pb-6 sm:pt-28">
          <motion.div
            ref={boxWrapRef}
            animate={{
              scale: showBanner ? 0.82 : 1,
              opacity: showBanner ? 0.72 : 1,
              y: showBanner ? 16 : 0,
            }}
            transition={{ type: 'spring', stiffness: 140, damping: 18 }}
          >
            <RaffleBox
              kind={filling ? 'open' : boxKind}
              filling={filling}
              closing={closing}
              shaking={shaking}
              glowing={glowing}
              idle={idle}
            />
          </motion.div>
        </div>
      </div>
    </LayoutGroup>
  )
}
