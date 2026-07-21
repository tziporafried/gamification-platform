import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLotteryPresentationSound } from '@/hooks/useLotteryPresentationSound'
import type { EligibleParticipant, LotteryConfig } from '../types'
import { LotteryBroadcastLayout } from './LotteryBroadcastLayout'
import { LotteryIntroShow, type IntroBeat, type IntroRuleCard } from './LotteryIntroShow'
import { GiftBoxLotteryDraw } from './GiftBoxLotteryDraw'
import { pickRandomWinner } from './lotteryUtils'
import { recordLotteryWinner } from './lotteryWinners'
import { WinnerReveal } from './WinnerReveal'

type ShowStage = 'intro' | 'draw' | 'silence' | 'winner'

interface LotteryPresentationProps {
  config: LotteryConfig
  participants: EligibleParticipant[]
  onClose: () => void
}

const SILENCE_BEFORE_WINNER_MS = 250

function winnersLabel(count: number): string {
  if (count <= 1) return 'זוכה אחד'
  return `${count.toLocaleString('he-IL')} זוכים`
}

function eligibilityLabel(config: LotteryConfig): string {
  if (config.eligibilityMode === 'all') return 'כל המשתתפים'
  return `מי שהשיג מעל ${config.minPoints.toLocaleString('he-IL')} נקודות`
}

/**
 * Live lottery show: cinematic intro → draw → winner.
 * Dock stays visible but locked during the intro opening act.
 */
export function LotteryPresentation({
  config,
  participants,
  onClose,
}: LotteryPresentationProps) {
  const [stage, setStage] = useState<ShowStage>('intro')
  const [drawnIds, setDrawnIds] = useState<string[]>([])
  const [winner, setWinner] = useState<EligibleParticipant | null>(null)
  const recordedRef = useRef(false)
  const {
    play,
    playIntroBed,
    stop,
    fadeOut,
    playUiClick,
    playWhoosh,
    playShimmer,
    playCountdownHit,
    playGoRise,
    playWinnerFanfare,
  } = useLotteryPresentationSound()

  const pool = useMemo(() => {
    const excluded = new Set(drawnIds)
    const remaining = participants.filter((p) => !excluded.has(p.id))
    return remaining.length > 0 ? remaining : participants
  }, [participants, drawnIds])

  const winnerCount = Math.max(1, config.winnerCount ?? 1)

  const introCards = useMemo<IntroRuleCard[]>(
    () => [
      {
        id: 'prize',
        icon: config.prizeIcon || '🎁',
        label: 'פרס',
        value: config.prizeName,
      },
      {
        id: 'participants',
        icon: '👥',
        label: 'משתתפים',
        value: eligibilityLabel(config),
      },
      {
        id: 'winners',
        icon: '🏆',
        label: 'זוכים',
        value: winnersLabel(winnerCount),
      },
    ],
    [config, winnerCount],
  )

  // Opening act setup — bed starts after "הגרלה / הכל מוכן" exits (prize beat).
  useEffect(() => {
    if (stage !== 'intro') return
    setWinner(pickRandomWinner(pool))
    playUiClick()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pick winner once on intro entry
  }, [stage, playUiClick])

  useEffect(() => {
    if (stage !== 'draw') return
    let cancelled = false
    fadeOut(500, () => {
      if (cancelled) return
      play('draw', { loop: true, volume: 0.74 })
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [stage, fadeOut, play, stop])

  useEffect(() => {
    if (stage !== 'silence') return
    stop()
    const t = window.setTimeout(() => setStage('winner'), SILENCE_BEFORE_WINNER_MS)
    return () => window.clearTimeout(t)
  }, [stage, stop])

  useEffect(() => {
    if (stage !== 'winner' || !winner || recordedRef.current) return
    recordedRef.current = true
    playWinnerFanfare()
    recordLotteryWinner(config.eventId, {
      participantId: winner.id,
      participantName: winner.name,
      prizeName: config.prizeName,
      prizeIcon: config.prizeIcon,
      wonAt: new Date().toISOString(),
    })
    setDrawnIds((ids) => (ids.includes(winner.id) ? ids : [...ids, winner.id]))
  }, [stage, config, winner, playWinnerFanfare])

  const handleExit = useCallback(() => {
    stop()
    onClose()
  }, [stop, onClose])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleExit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleExit])

  const handleIntroBeat = useCallback(
    (beat: IntroBeat) => {
      switch (beat) {
        case 'prize':
          playIntroBed(0.64, () => setStage('draw'))
          playShimmer()
          playWhoosh()
          break
        case 'participants':
        case 'winners':
          playWhoosh()
          break
        case 'count3':
        case 'count2':
        case 'count1':
          playCountdownHit()
          break
        case 'flash':
          playGoRise()
          break
        case 'blast':
          playWhoosh()
          break
        default:
          break
      }
    },
    [playIntroBed, playShimmer, playWhoosh, playCountdownHit, playGoRise],
  )

  return (
    <LotteryBroadcastLayout
      hideDock
      stage={
        <AnimatePresence mode="wait">
          {stage === 'intro' && (
            <motion.div
              key="intro"
              className="flex min-h-0 w-full flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <LotteryIntroShow
                cards={introCards}
                onBeat={handleIntroBeat}
              />
            </motion.div>
          )}

          {stage === 'draw' && winner && (
            <motion.div
              key="draw"
              className="flex min-h-0 w-full flex-1"
              initial={{ opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <GiftBoxLotteryDraw
                participants={pool}
                winnerName={winner.name}
                prizeName={config.prizeName}
                prizeIcon={config.prizeIcon || '🎁'}
                onComplete={() => setStage('silence')}
              />
            </motion.div>
          )}

          {(stage === 'silence' || stage === 'winner') && (
            <motion.div
              key="winner"
              className="min-h-0 w-full flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: stage === 'silence' ? 0 : 1 }}
              transition={{ duration: stage === 'silence' ? 0 : 0.35 }}
            >
              {stage === 'winner' && winner && (
                <WinnerReveal
                  winnerName={winner.name}
                  prizeName={config.prizeName}
                  prizeIcon={config.prizeIcon}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      }
    />
  )
}
