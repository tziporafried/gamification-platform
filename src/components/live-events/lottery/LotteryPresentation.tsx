import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLotteryPresentationSound } from '@/hooks/useLotteryPresentationSound'
import type { EligibleParticipant, LotteryConfig } from '../types'
import { pickRandomWinner } from './lotteryUtils'
import { recordLotteryWinner } from './lotteryWinners'
import { PresentationLayout } from './PresentationLayout'
import { ParticipantCounter } from './ParticipantCounter'
import { GiftBoxLotteryDraw } from './GiftBoxLotteryDraw'
import { WinnerReveal } from './WinnerReveal'
import { LotterySettingStage } from './LotterySettingStage'

type Stage =
  | 'title'
  | 'eligibility'
  | 'prize'
  | 'counter'
  | 'draw'
  | 'winner'

interface LotteryPresentationProps {
  config: LotteryConfig
  participants: EligibleParticipant[]
  onClose: () => void
}

const SETTING_STAGES = ['title', 'eligibility', 'prize', 'counter'] as const

/** How long the audience sees each beat before the sting + advance. */
const SETTING_HOLD_MS: Record<(typeof SETTING_STAGES)[number], number> = {
  title: 3200,
  eligibility: 4200,
  prize: 4200,
  counter: 3800,
}

const CHIME_THEN_ADVANCE_MS = 550

function isSettingStage(stage: Stage): stage is (typeof SETTING_STAGES)[number] {
  return (SETTING_STAGES as readonly Stage[]).includes(stage)
}

export function LotteryPresentation({
  config,
  participants,
  onClose,
}: LotteryPresentationProps) {
  const [stage, setStage] = useState<Stage>('title')
  const { play, stop, playStepChime, playReadySting, playWinnerFanfare } =
    useLotteryPresentationSound()
  const recordedRef = useRef(false)

  const winner = useMemo(() => pickRandomWinner(participants), [participants])

  const startDraw = useCallback(() => {
    setStage('draw')
    play('draw', { loop: true, volume: 0.88 })
  }, [play])

  // Opening soundtrack while the audience sees the title card.
  useEffect(() => {
    if (stage !== 'title') return
    playReadySting()
    play('intro', { volume: 0.82 })
    return () => stop()
  }, [stage, play, playReadySting, stop])

  // Audience beats: hold → sting → next beat / draw.
  useEffect(() => {
    if (!isSettingStage(stage)) return

    const hold = SETTING_HOLD_MS[stage]
    const index = SETTING_STAGES.indexOf(stage)
    const next = SETTING_STAGES[index + 1]

    const chimeTimer = window.setTimeout(() => {
      if (stage === 'counter') playReadySting()
      else playStepChime()
    }, hold)

    const advanceTimer = window.setTimeout(() => {
      if (next) {
        setStage(next)
      } else {
        stop()
        startDraw()
      }
    }, hold + CHIME_THEN_ADVANCE_MS)

    return () => {
      window.clearTimeout(chimeTimer)
      window.clearTimeout(advanceTimer)
    }
  }, [stage, playStepChime, playReadySting, startDraw, stop])

  useEffect(() => {
    if (stage !== 'winner' || recordedRef.current) return
    recordedRef.current = true
    stop()
    playWinnerFanfare()
    recordLotteryWinner(config.eventId, {
      participantId: winner.id,
      participantName: winner.name,
      prizeName: config.prizeName,
      prizeIcon: config.prizeIcon,
      wonAt: new Date().toISOString(),
    })
  }, [stage, config, winner, stop, playWinnerFanfare])

  const handleExit = useCallback(() => {
    stop()
    onClose()
  }, [stop, onClose])

  const handleDrawComplete = useCallback(() => {
    setStage('winner')
  }, [])

  const eligibilityLines =
    config.eligibilityMode === 'all'
      ? ['כולם במשחק!', 'כל המשתתפים בהגרלה']
      : [
          'מי שצבר לפחות',
          `${config.minPoints.toLocaleString('he-IL')} נקודות`,
          'במשחק!',
        ]

  const settingStep = isSettingStage(stage) ? SETTING_STAGES.indexOf(stage) + 1 : 0

  return (
    <PresentationLayout onExit={handleExit}>
      <AnimatePresence mode="wait">
        {stage === 'title' && (
          <StageCenter key="title">
            <LotterySettingStage eyebrow="מוכנים??" step={1} totalSteps={4}>
              <motion.h1
                className="text-5xl font-black text-foreground sm:text-6xl md:text-7xl"
                style={{ textShadow: '0 0 28px rgba(255, 184, 0, 0.35)' }}
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                🎁 הגרלה
              </motion.h1>
              <p className="mt-4 text-base font-semibold text-muted sm:text-lg">
                יאללה… בוחרים זוכה!
              </p>
            </LotterySettingStage>
          </StageCenter>
        )}

        {stage === 'eligibility' && (
          <StageCenter key="eligibility">
            <LotterySettingStage eyebrow="מי במשחק??" step={2} totalSteps={4}>
              <div className="space-y-2">
                {eligibilityLines.map((line) => (
                  <p
                    key={line}
                    className="text-3xl font-black leading-snug text-foreground sm:text-4xl md:text-5xl"
                  >
                    {line}
                  </p>
                ))}
              </div>
            </LotterySettingStage>
          </StageCenter>
        )}

        {stage === 'prize' && (
          <StageCenter key="prize">
            <LotterySettingStage eyebrow="ומה מרוויחים??" step={3} totalSteps={4}>
              <motion.div
                className="mx-auto inline-flex flex-col items-center gap-3 rounded-3xl border border-warning/35 bg-white/75 px-8 py-6 shadow-sm"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="text-5xl sm:text-6xl" aria-hidden>
                  {config.prizeIcon}
                </span>
                <p className="text-3xl font-black text-foreground sm:text-4xl md:text-5xl">
                  {config.prizeName}
                </p>
              </motion.div>
            </LotterySettingStage>
          </StageCenter>
        )}

        {stage === 'counter' && (
          <StageCenter key="counter">
            <LotterySettingStage eyebrow="כמה פתקים בקופסה??" step={4} totalSteps={4}>
              <ParticipantCounter count={participants.length} duration={1800} />
              <p className="mt-4 text-base font-semibold text-muted sm:text-lg">
                מוכנים?? יאללה הגרלה!
              </p>
            </LotterySettingStage>
          </StageCenter>
        )}

        {stage === 'draw' && (
          <motion.div
            key="draw"
            className="relative min-h-0 flex-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <GiftBoxLotteryDraw
              participants={participants}
              winnerName={winner.name}
              prizeName={config.prizeName}
              prizeIcon={config.prizeIcon}
              onComplete={handleDrawComplete}
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

      {settingStep > 0 && (
        <span className="sr-only">רגע {settingStep} מתוך 4</span>
      )}
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
      transition={{ duration: 0.35 }}
    >
      {children}
    </motion.div>
  )
}
