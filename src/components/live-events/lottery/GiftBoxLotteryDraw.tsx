import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { EligibleParticipant } from '../types'
import { ConfettiOverlay } from './ConfettiOverlay'

type DrawPhase = 'scatter' | 'collect' | 'shake' | 'pull' | 'reveal'

interface GiftBoxLotteryDrawProps {
  participants: EligibleParticipant[]
  winnerName: string
  prizeName: string
  prizeIcon: string
  onComplete: () => void
}

interface FlyingName {
  id: string
  name: string
  startX: number
  startY: number
  driftX: number
  driftY: number
  rotate: number
  delay: number
  size: number
  color: string
}

const NAME_COLORS = ['#2E221E', '#AB3500', '#007D7D', '#916900', '#D42F00', '#388882']
const SCATTER_MS = 2800
const COLLECT_MS = 4500
const SHAKE_MS = 3400
const PULL_MS = 3000
const REVEAL_HOLD_MS = 2400

function buildFlyingNames(participants: EligibleParticipant[]): FlyingName[] {
  const pool =
    participants.length <= 60
      ? participants
      : participants
          .filter((_, i) => i % Math.ceil(participants.length / 60) === 0)
          .slice(0, 60)

  return pool.map((p, i) => ({
    id: p.id,
    name: p.name,
    startX: 4 + Math.random() * 92,
    startY: 6 + Math.random() * 48,
    driftX: -10 + Math.random() * 20,
    driftY: -8 + Math.random() * 16,
    rotate: -28 + Math.random() * 56,
    delay: (i % 18) * 0.09 + Math.random() * 0.4,
    size: 0.72 + Math.random() * 0.5,
    color: NAME_COLORS[i % NAME_COLORS.length]!,
  }))
}

function GiftBox({ shaking, open }: { shaking: boolean; open: boolean }) {
  return (
    <motion.div
      className="relative h-36 w-44 sm:h-44 sm:w-56"
      style={{ perspective: 800 }}
      animate={
        shaking
          ? {
              x: [0, -12, 14, -16, 12, -8, 6, 0],
              y: [0, -5, 3, -7, 4, -3, 0],
              rotate: [0, -7, 8, -9, 6, -4, 0],
            }
          : { x: 0, y: 0, rotate: 0 }
      }
      transition={
        shaking
          ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 200, damping: 18 }
      }
    >
      <div
        className="absolute inset-x-2 bottom-0 top-10 overflow-hidden rounded-b-2xl rounded-t-md border-2 border-[#C45A00] shadow-[0_16px_36px_rgba(46,34,30,0.28)]"
        style={{
          background: 'linear-gradient(160deg, #FC6024 0%, #D83000 55%, #AB3500 100%)',
        }}
      >
        <div className="absolute inset-y-0 left-1/2 w-7 -translate-x-1/2 bg-[#FFB800]" />
        <div className="absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 bg-[#FFB800]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        {/* Tickets peeking while shaking */}
        {shaking && (
          <>
            <motion.div
              className="absolute left-[18%] top-2 h-3 w-8 rounded-sm bg-[#FFF1D2]"
              animate={{ y: [0, -6, 2, -4, 0], rotate: [-8, 6, -4, 0] }}
              transition={{ duration: 0.45, repeat: Infinity }}
            />
            <motion.div
              className="absolute right-[22%] top-3 h-3 w-7 rounded-sm bg-[#FFFDF7]"
              animate={{ y: [0, -5, 1, -3, 0], rotate: [6, -8, 3, 0] }}
              transition={{ duration: 0.4, repeat: Infinity, delay: 0.08 }}
            />
          </>
        )}
      </div>

      <motion.div
        className="absolute inset-x-0 top-0 h-12 origin-bottom rounded-xl border-2 border-[#C45A00] shadow-md"
        style={{
          background: 'linear-gradient(180deg, #FF8A3D 0%, #FC6024 100%)',
          transformStyle: 'preserve-3d',
        }}
        animate={open ? { rotateX: -52, y: -20 } : { rotateX: 0, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        <div className="absolute inset-y-0 left-1/2 w-7 -translate-x-1/2 bg-[#FFB800]" />
        <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFD68A] shadow-inner" />
      </motion.div>

      <div className="absolute -bottom-3 left-1/2 h-6 w-36 -translate-x-1/2 rounded-full bg-warning/35 blur-md" />
    </motion.div>
  )
}

export function GiftBoxLotteryDraw({
  participants,
  winnerName,
  prizeName,
  prizeIcon,
  onComplete,
}: GiftBoxLotteryDrawProps) {
  const [phase, setPhase] = useState<DrawPhase>('scatter')
  const names = useMemo(() => buildFlyingNames(participants), [participants])

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase('collect'), SCATTER_MS),
      window.setTimeout(() => setPhase('shake'), SCATTER_MS + COLLECT_MS),
      window.setTimeout(() => setPhase('pull'), SCATTER_MS + COLLECT_MS + SHAKE_MS),
      window.setTimeout(
        () => setPhase('reveal'),
        SCATTER_MS + COLLECT_MS + SHAKE_MS + PULL_MS,
      ),
      window.setTimeout(
        () => onComplete(),
        SCATTER_MS + COLLECT_MS + SHAKE_MS + PULL_MS + REVEAL_HOLD_MS,
      ),
    ]
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [onComplete])

  const shaking = phase === 'shake'
  const lidOpen = phase === 'pull' || phase === 'reveal'
  const collecting =
    phase === 'collect' || phase === 'shake' || phase === 'pull' || phase === 'reveal'

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ConfettiOverlay active={phase === 'reveal'} count={48} />

      <div className="pointer-events-none absolute inset-x-0 top-6 z-20 text-center">
        <AnimatePresence mode="wait">
          {phase === 'scatter' && (
            <motion.p
              key="scatter"
              className="text-lg font-bold text-muted sm:text-xl"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              כל המשתתפים בהגרלה!!
            </motion.p>
          )}
          {phase === 'collect' && (
            <motion.p
              key="collect"
              className="text-lg font-bold text-primary-text sm:text-xl"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              הפתקים עפים לקופסה…
            </motion.p>
          )}
          {phase === 'shake' && (
            <motion.p
              key="shake"
              className="text-lg font-bold text-primary-text sm:text-xl"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              מערבבים… מי יזכה??
            </motion.p>
          )}
          {(phase === 'pull' || phase === 'reveal') && (
            <motion.p
              key="pull"
              className="text-lg font-bold text-primary-text sm:text-xl"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              ו… שולפים!!
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute inset-0 z-10 overflow-hidden" aria-hidden>
        {names.map((n) => (
          <motion.span
            key={n.id}
            className="absolute whitespace-nowrap rounded-md border border-border/70 bg-white/90 px-2.5 py-1 font-bold shadow-sm"
            style={{
              fontSize: `${n.size}rem`,
              color: n.color,
              left: `${n.startX}%`,
              top: `${n.startY}%`,
            }}
            initial={{ opacity: 0, scale: 0.65, rotate: n.rotate }}
            animate={
              collecting
                ? {
                    opacity: [1, 1, 0],
                    left: '50%',
                    top: '82%',
                    x: '-50%',
                    y: 0,
                    rotate: [n.rotate, n.rotate * 0.3, 20],
                    scale: [1, 0.55, 0.12],
                  }
                : {
                    opacity: [0, 1, 0.9, 1],
                    x: [0, n.driftX, 0],
                    y: [0, n.driftY, 0],
                    rotate: [n.rotate, n.rotate + 6, n.rotate],
                    scale: 1,
                  }
            }
            transition={
              collecting
                ? {
                    duration: 1.15 + Math.random() * 0.85,
                    delay: n.delay,
                    ease: [0.4, 0, 0.85, 0.35],
                  }
                : {
                    duration: 2.6 + Math.random(),
                    delay: n.delay * 0.25,
                    ease: 'easeInOut',
                  }
            }
          >
            {n.name}
          </motion.span>
        ))}
      </div>

      <div className="relative z-20 mt-auto flex flex-col items-center pb-6 pt-10 sm:pb-10">
        {/* Hand reaching into the box */}
        <AnimatePresence>
          {(phase === 'pull' || phase === 'reveal') && (
            <motion.div
              className="pointer-events-none absolute bottom-[8.5rem] z-30 sm:bottom-40"
              initial={{ opacity: 0, x: 80, y: 50, rotate: 24 }}
              animate={{
                opacity: 1,
                x: [80, 20, 0, 0],
                y: [50, 10, -8, phase === 'reveal' ? -90 : -55],
                rotate: [24, 10, 0, -6],
              }}
              transition={{ duration: 2.5, times: [0, 0.35, 0.55, 1], ease: 'easeInOut' }}
            >
              <span className="block scale-x-[-1] text-6xl drop-shadow-lg sm:text-7xl" aria-hidden>
                🤚
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulled ticket */}
        <AnimatePresence>
          {(phase === 'pull' || phase === 'reveal') && (
            <motion.div
              className="absolute bottom-[12rem] z-40 w-[min(92vw,24rem)] sm:bottom-[14.5rem]"
              initial={{ opacity: 0, y: 70, scale: 0.55, rotate: -16 }}
              animate={{
                opacity: 1,
                y: phase === 'reveal' ? -28 : 8,
                scale: phase === 'reveal' ? 1.06 : 1,
                rotate: 0,
              }}
              transition={{ delay: 1.15, type: 'spring', stiffness: 150, damping: 14 }}
            >
              <div className="rounded-2xl border-2 border-warning/50 bg-[linear-gradient(150deg,#FFFDF7,#FFF1D2)] px-6 py-6 text-center shadow-[0_18px_44px_rgba(46,34,30,0.2)]">
                <p className="text-sm font-bold text-primary-text">🎉 יש לנו זוכה!!</p>
                <p className="mt-2 text-3xl font-black leading-tight text-foreground sm:text-4xl">
                  {winnerName}
                </p>
                <p className="mt-4 text-base font-semibold text-muted">
                  <span className="me-1" aria-hidden>
                    {prizeIcon}
                  </span>
                  {prizeName}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <GiftBox shaking={shaking} open={lidOpen} />
      </div>
    </div>
  )
}
