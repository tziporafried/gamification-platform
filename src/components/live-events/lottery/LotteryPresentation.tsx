import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLotteryPresentationSound } from '@/hooks/useLotteryPresentationSound'
import type { EligibleParticipant, LotteryConfig } from '../types'
import { pickRandomWinner } from './lotteryUtils'
import { recordLotteryWinner } from './lotteryWinners'
import { PresentationLayout } from './PresentationLayout'
import { ParticipantCounter } from './ParticipantCounter'
import { NameCloud } from './NameCloud'
import { LotteryEliminationAnimation } from './LotteryEliminationAnimation'
import { WinnerReveal } from './WinnerReveal'

type Stage =
  | 'title'
  | 'eligibility'
  | 'prize'
  | 'counter'
  | 'cloud'
  | 'elimination'
  | 'winner'

interface LotteryPresentationProps {
  config: LotteryConfig
  participants: EligibleParticipant[]
  /** ESC / close tab. */
  onClose: () => void
}

/** Timed beats during the intro soundtrack (settings reveal). */
const INTRO_STAGE_DURATIONS: Partial<Record<Stage, number>> = {
  title: 2200,
  eligibility: 3200,
  prize: 3200,
  counter: 2800,
}

/** How long the name cloud runs before elimination (draw soundtrack continues). */
const CLOUD_DURATION_MS = 5000

/** Fallback if intro audio fails to load/play. */
const INTRO_FALLBACK_MS = 12_000

export function LotteryPresentation({
  config,
  participants,
  onClose,
}: LotteryPresentationProps) {
  const [stage, setStage] = useState<Stage>('title')
  const { play, stop } = useLotteryPresentationSound()
  const recordedRef = useRef(false)

  const winner = useMemo(() => pickRandomWinner(participants), [participants])

  const startDraw = useCallback(() => {
    setStage('cloud')
    play('draw', { loop: true, volume: 0.8 })
  }, [play])

  // Intro soundtrack — when it ends, the draw begins with a new track.
  useEffect(() => {
    let fallbackTimer = 0
    let finished = false

    function finishIntro() {
      if (finished) return
      finished = true
      window.clearTimeout(fallbackTimer)
      startDraw()
    }

    play('intro', { onEnded: finishIntro, volume: 0.9 })
    fallbackTimer = window.setTimeout(finishIntro, INTRO_FALLBACK_MS)

    return () => {
      finished = true
      window.clearTimeout(fallbackTimer)
      stop()
    }
  }, [play, stop, startDraw])

  // Advance settings stages while intro music plays.
  useEffect(() => {
    const introOrder: Stage[] = ['title', 'eligibility', 'prize', 'counter']
    if (!introOrder.includes(stage)) return

    const duration = INTRO_STAGE_DURATIONS[stage]
    if (duration == null) return

    const index = introOrder.indexOf(stage)
    const next = introOrder[index + 1]
    if (!next) return

    const timer = window.setTimeout(() => setStage(next), duration)
    return () => window.clearTimeout(timer)
  }, [stage])

  // After the name cloud, run elimination.
  useEffect(() => {
    if (stage !== 'cloud') return
    const timer = window.setTimeout(() => setStage('elimination'), CLOUD_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [stage])

  // Persist winner once revealed; soundtrack keeps playing until the tab closes.
  useEffect(() => {
    if (stage !== 'winner' || recordedRef.current) return
    recordedRef.current = true
    recordLotteryWinner(config.eventId, {
      participantId: winner.id,
      participantName: winner.name,
      prizeName: config.prizeName,
      prizeIcon: config.prizeIcon,
      wonAt: new Date().toISOString(),
    })
  }, [stage, config, winner])

  const handleExit = useCallback(() => {
    stop()
    onClose()
  }, [stop, onClose])

  const eligibilityLines =
    config.eligibilityMode === 'all'
      ? ['כל המשתתפים', 'נכנסים להגרלה.']
      : [
          'כל משתתף שצבר לפחות',
          `${config.minPoints.toLocaleString('he-IL')} נקודות`,
          'נכנס להגרלה.',
        ]

  return (
    <PresentationLayout onExit={handleExit}>
      <AnimatePresence mode="wait">
        {stage === 'title' && (
          <StageCenter key="title">
            <motion.h1
              className="text-5xl font-black text-foreground sm:text-7xl md:text-8xl"
              style={{ textShadow: '0 0 28px rgba(255, 184, 0, 0.35)' }}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
            >
              🎁 הגרלה
            </motion.h1>
          </StageCenter>
        )}

        {stage === 'eligibility' && (
          <StageCenter key="eligibility">
            <motion.div
              className="max-w-xl space-y-2 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              {eligibilityLines.map((line) => (
                <p
                  key={line}
                  className="text-2xl font-bold leading-relaxed text-foreground sm:text-3xl md:text-4xl"
                >
                  {line}
                </p>
              ))}
            </motion.div>
          </StageCenter>
        )}

        {stage === 'prize' && (
          <StageCenter key="prize">
            <motion.div
              className="max-w-xl space-y-4 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-xl font-bold text-muted sm:text-2xl">הפרס</p>
              <p
                className="text-4xl font-black text-foreground sm:text-5xl md:text-6xl"
                style={{ textShadow: '0 0 24px rgba(255, 184, 0, 0.3)' }}
              >
                <span className="me-2" aria-hidden>
                  {config.prizeIcon}
                </span>
                {config.prizeName}
              </p>
            </motion.div>
          </StageCenter>
        )}

        {stage === 'counter' && (
          <StageCenter key="counter">
            <ParticipantCounter count={participants.length} duration={1600} />
          </StageCenter>
        )}

        {stage === 'cloud' && (
          <motion.div
            key="cloud"
            className="relative min-h-0 flex-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <NameCloud participants={participants} />
            <div className="pointer-events-none absolute inset-x-0 top-8 text-center">
              <p className="text-lg font-bold text-muted sm:text-xl">המשתתפים בהגרלה…</p>
            </div>
          </motion.div>
        )}

        {stage === 'elimination' && (
          <motion.div
            key="elimination"
            className="relative min-h-0 flex-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <LotteryEliminationAnimation
              participants={participants}
              winnerId={winner.id}
              onComplete={() => setStage('winner')}
            />
          </motion.div>
        )}

        {stage === 'winner' && (
          <motion.div
            key="winner"
            className="min-h-0 flex-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <WinnerReveal
              winnerName={winner.name}
              prizeName={config.prizeName}
              prizeIcon={config.prizeIcon}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </PresentationLayout>
  )
}

function StageCenter({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="flex min-h-0 flex-1 items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  )
}
