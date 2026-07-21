import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { RAFFLE_SPRINGS, type RaffleTicketData } from './raffleTiming'

interface TicketProps {
  ticket: RaffleTicketData
  phase: 'rain' | 'collect' | 'hidden' | 'winnerRise' | 'winnerHero'
  isWinner?: boolean
  onEntered?: () => void
  /** Real on-screen position of the box's opening — where tickets converge. */
  slot?: { left: string; top: string }
}

/** Brand-palette tones cycled across floating tickets for a lively, varied stage. */
const TICKET_TONES = {
  orange: {
    bg: 'linear-gradient(155deg,#FFF3EA 0%,#FFD3AE 100%)',
    border: '#FFB37A',
    ink: '#7A2E00',
    ring: 'rgba(252,96,36,0.6)',
    glow: 'rgba(252,96,36,0.5)',
  },
  teal: {
    bg: 'linear-gradient(155deg,#E9FBFB 0%,#B9ECEC 100%)',
    border: '#7BD6D6',
    ink: '#004F4F',
    ring: 'rgba(0,144,144,0.6)',
    glow: 'rgba(0,144,144,0.45)',
  },
  gold: {
    bg: 'linear-gradient(155deg,#FFF9E8 0%,#FFE49A 100%)',
    border: '#F2C766',
    ink: '#7A4B00',
    ring: 'rgba(242,179,60,0.65)',
    glow: 'rgba(242,179,60,0.5)',
  },
} as const

type TicketTone = keyof typeof TICKET_TONES
const TONE_KEYS = Object.keys(TICKET_TONES) as TicketTone[]

function toneForId(id: string): TicketTone {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return TONE_KEYS[sum % TONE_KEYS.length]
}

/**
 * Folded paper raffle ticket — no Gamify branding; spring physics only.
 */
export function Ticket({
  ticket,
  phase,
  isWinner = false,
  onEntered,
  slot = { left: '50%', top: '72%' },
}: TicketProps) {
  if (phase === 'hidden') return null

  if (phase === 'winnerRise' || phase === 'winnerHero') {
    return (
      <motion.div
        layoutId={`raffle-ticket-${ticket.id}`}
        className="absolute left-1/2 z-40"
        style={{ x: '-50%', y: '-50%' }}
        initial={{
          top: '62%',
          scale: 0.72,
          rotateZ: -14,
          rotateY: 28,
          opacity: 0.9,
        }}
        animate={
          phase === 'winnerRise'
            ? {
                top: ['62%', '48%', '52%'],
                scale: [0.72, 1.4, 1.5],
                rotateZ: [-14, 8, 0],
                rotateY: [28, -8, 0],
                opacity: 1,
                filter: ['brightness(1)', 'brightness(1.35)', 'brightness(1.25)'],
              }
            : {
                top: '48%',
                scale: [1.55, 1.62, 1.55],
                rotateZ: [0, -3, 3, 0],
                rotateY: 0,
                opacity: 1,
                filter: 'brightness(1.28)',
              }
        }
        transition={
          phase === 'winnerRise'
            ? { duration: 1.65, ease: [0.22, 1, 0.36, 1] }
            : {
                top: { ...RAFFLE_SPRINGS.winnerHero },
                scale: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
                rotateZ: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
                filter: { duration: 0.4 },
              }
        }
      >
        <TicketFace name={ticket.name} hero glowing unfolded={phase === 'winnerHero'} />
      </motion.div>
    )
  }

  const collectDuration = RAFFLE_SPRINGS.ticketCollect.duration + (ticket.enterDelay % 0.55)
  const tone = toneForId(ticket.id)
  const toneColors = TICKET_TONES[tone]
  const anchorX = ticket.anchorX ?? 'left'
  const anchorY = ticket.anchorY ?? 'top'

  return (
    <motion.div
      className="absolute z-30 will-change-transform"
      style={{
        // Anchored from whichever side the ticket spawns nearest, so the box
        // always grows back toward the center instead of past the edge.
        ...(anchorX === 'right' ? { right: `${ticket.startX}%` } : { left: `${ticket.startX}%` }),
        ...(anchorY === 'bottom' ? { bottom: `${ticket.startY}%` } : { top: `${ticket.startY}%` }),
        scale: ticket.scale,
      }}
      initial={{
        opacity: 0,
        scale: ticket.scale * 0.55,
        rotate: ticket.rotate,
        x: ticket.drift,
        y: anchorY === 'top' && ticket.startY < 20 ? -40 : 18,
        filter: 'blur(4px)',
      }}
      animate={
        phase === 'rain'
          ? {
              opacity: 1,
              scale: [ticket.scale, ticket.scale * 1.08, ticket.scale],
              rotate: [ticket.rotate * 0.5, ticket.rotate * -0.4, ticket.rotate * 0.45],
              x: [0, ticket.drift * 0.55, ticket.drift * -0.4, 0],
              y: [0, -30, 12, 0],
              filter: 'blur(0px)',
            }
          : {
              opacity: [1, 1, 0],
              // Collecting always converges via left/top - clear any right/bottom
              // anchor from the rain phase so the box doesn't get width/height-
              // stretched by having opposite edges pinned at the same time.
              left: slot.left,
              top: slot.top,
              right: 'auto',
              bottom: 'auto',
              x: '-50%',
              y: 0,
              rotate: [ticket.rotate, ticket.rotate * 0.2, 16],
              scale: [ticket.scale, ticket.scale * 0.7, 0.16],
              filter: 'blur(0px)',
            }
      }
      transition={
        phase === 'rain'
          ? {
              ...RAFFLE_SPRINGS.ticketAppear,
              delay: ticket.enterDelay * 0.45,
              rotate: {
                duration: 2.6 + (ticket.enterDelay % 1.2),
                repeat: Infinity,
                ease: 'easeInOut',
                delay: ticket.enterDelay,
              },
              x: {
                duration: 2.4 + (ticket.enterDelay % 0.8),
                repeat: Infinity,
                ease: 'easeInOut',
                delay: ticket.enterDelay,
              },
              y: {
                duration: 2.1,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: ticket.enterDelay,
              },
              scale: {
                duration: 2.1,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: ticket.enterDelay,
              },
            }
          : {
              duration: collectDuration,
              delay: ticket.enterDelay,
              ease: RAFFLE_SPRINGS.ticketCollect.ease,
            }
      }
      onAnimationComplete={() => {
        if (phase === 'collect') onEntered?.()
      }}
    >
      {phase === 'rain' && (
        <motion.span
          className="pointer-events-none absolute inset-[-55%] -z-10 rounded-full blur-lg"
          style={{ background: `radial-gradient(circle, ${toneColors.glow}, transparent 70%)` }}
          animate={{ opacity: [0.35, 0.75, 0.35], scale: [0.9, 1.12, 0.9] }}
          transition={{
            duration: 2.4 + (ticket.enterDelay % 1),
            repeat: Infinity,
            ease: 'easeInOut',
            delay: ticket.enterDelay,
          }}
        />
      )}
      <TicketFace name={ticket.name} tone={tone} glowing={isWinner} />
    </motion.div>
  )
}

function TicketFace({
  name,
  tone,
  glowing = false,
  hero = false,
  unfolded = false,
}: {
  name: string
  tone?: TicketTone
  glowing?: boolean
  hero?: boolean
  unfolded?: boolean
}) {
  const palette = tone ? TICKET_TONES[tone] : null
  return (
    <motion.div
      className={cn(
        'relative overflow-hidden border font-black',
        !palette && 'border-[#E8DFD4] bg-[#FFFDF9] text-[#2E221E]',
        'shadow-[0_8px_18px_rgba(46,34,30,0.18)]',
        hero
          ? 'px-7 py-4 text-xl sm:px-9 sm:py-5 sm:text-2xl'
          : 'px-4 py-2.5 text-base sm:px-5 sm:py-3 sm:text-lg',
        glowing && 'ring-2 ring-[#8B7CFF]/70 shadow-[0_0_28px_rgba(120,90,255,0.5)]',
      )}
      style={{
        backgroundImage: palette
          ? palette.bg
          : 'linear-gradient(155deg,#FFFDF9 0%,#F7F1E8 100%), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(46,34,30,0.02) 2px, rgba(46,34,30,0.02) 3px)',
        borderColor: palette?.border,
        color: palette?.ink,
        boxShadow: palette
          ? `0 8px 20px rgba(46,34,30,0.2), 0 0 20px ${palette.ring}`
          : undefined,
        clipPath:
          'polygon(0 12%, 4% 12%, 4% 0, 96% 0, 96% 12%, 100% 12%, 100% 88%, 96% 88%, 96% 100%, 4% 100%, 4% 88%, 0 88%)',
      }}
      animate={
        unfolded
          ? {
              rotateY: [72, 0],
              scaleX: [0.52, 1],
              boxShadow:
                hero && glowing
                  ? [
                      '0 8px 20px rgba(46,34,30,0.2), 0 0 22px rgba(139,124,255,0.55)',
                      '0 8px 20px rgba(46,34,30,0.2), 0 0 48px rgba(139,124,255,0.9)',
                      '0 8px 20px rgba(46,34,30,0.2), 0 0 22px rgba(139,124,255,0.55)',
                    ]
                  : undefined,
            }
          : undefined
      }
      transition={
        unfolded
          ? {
              rotateY: { ...RAFFLE_SPRINGS.unfold, delay: 0.06 },
              scaleX: { ...RAFFLE_SPRINGS.unfold, delay: 0.06 },
              boxShadow: { duration: 1.9, repeat: Infinity, ease: 'easeInOut', delay: 0.4 },
            }
          : undefined
      }
    >
      {palette && (
        <motion.span
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/60"
          animate={{ left: ['-60%', '130%'] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
        />
      )}
      <span className="relative align-middle">{name}</span>
    </motion.div>
  )
}
