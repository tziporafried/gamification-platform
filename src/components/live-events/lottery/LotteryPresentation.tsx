import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  trackLotteryDrawStart,
  trackLotteryExit,
  trackLotteryIntroStart,
  trackLotteryRedraw,
  trackLotteryWinnerRevealed,
} from '@/lib/analytics'
import { useLotteryPresentationSound } from '@/hooks/useLotteryPresentationSound'
import type { EligibleParticipant, LotteryConfig } from '../types'
import { LotteryBroadcastLayout } from './LotteryBroadcastLayout'
import { LotteryIntroShow, type IntroBeat, type IntroRuleCard } from './LotteryIntroShow'
import { GiftBoxLotteryDraw } from './GiftBoxLotteryDraw'
import { pickRandomWinner } from './lotteryUtils'
import { recordLotteryWinner } from './lotteryWinners'

type ShowStage = 'intro' | 'draw'

interface LotteryPresentationProps {
  config: LotteryConfig
  participants: EligibleParticipant[]
  onClose: () => void
}

function eligibilityLabel(config: LotteryConfig): string {
  if (config.eligibilityMode === 'all') return 'כל המשתתפים'
  return `מי שהשיג מעל ${config.minPoints.toLocaleString('he-IL')} נקודות`
}

/**
 * Live lottery show: cinematic intro → raffle ceremony (through finished controls).
 * «הגרל שוב» replays intro + draw from the start (previous winners stay excluded).
 */
export function LotteryPresentation({
  config,
  participants,
  onClose,
}: LotteryPresentationProps) {
  const [stage, setStage] = useState<ShowStage>('intro')
  const [drawnIds, setDrawnIds] = useState<string[]>([])
  const [winner, setWinner] = useState<EligibleParticipant | null>(null)
  const [drawIndex, setDrawIndex] = useState(0)
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
    ],
    [config],
  )

  useEffect(() => {
    if (stage !== 'intro') return
    setWinner(pickRandomWinner(pool))
    playUiClick()
    trackLotteryIntroStart(config.eventId, pool.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pick winner once on intro entry
  }, [stage, playUiClick])

  useEffect(() => {
    if (stage !== 'draw') return
    trackLotteryDrawStart(config.eventId, pool.length)
    let cancelled = false
    fadeOut(500, () => {
      if (cancelled) return
      play('draw', { loop: true, volume: 0.74 })
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [stage, drawIndex, fadeOut, play, stop, config.eventId, pool.length])

  const handleWinnerRevealed = useCallback(() => {
    if (!winner || recordedRef.current) return
    recordedRef.current = true
    stop()
    playWinnerFanfare()
    trackLotteryWinnerRevealed({
      eventId: config.eventId,
      eligibleCount: participants.length,
      drawIndex,
    })
    recordLotteryWinner(config.eventId, {
      participantId: winner.id,
      participantName: winner.name,
      prizeName: config.prizeName,
      prizeIcon: config.prizeIcon,
      wonAt: new Date().toISOString(),
    })
    setDrawnIds((ids) => (ids.includes(winner.id) ? ids : [...ids, winner.id]))
  }, [winner, stop, playWinnerFanfare, config, participants.length, drawIndex])

  const handleExit = useCallback(() => {
    trackLotteryExit({ eventId: config.eventId, stage })
    stop()
    onClose()
  }, [stop, onClose, config.eventId, stage])

  const handleDrawAgain = useCallback(() => {
    const nextPool = (() => {
      const excluded = new Set(drawnIds)
      if (winner) excluded.add(winner.id)
      const remaining = participants.filter((p) => !excluded.has(p.id))
      return remaining.length > 0 ? remaining : participants
    })()

    playUiClick()
    stop()
    recordedRef.current = false
    setWinner(pickRandomWinner(nextPool))
    setDrawIndex((i) => i + 1)
    trackLotteryRedraw(config.eventId, nextPool.length)
    setStage('intro')
  }, [drawnIds, winner, participants, playUiClick, stop, config.eventId])

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
              key={`intro-${drawIndex}`}
              className="flex min-h-0 w-full min-w-0 flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <LotteryIntroShow cards={introCards} onBeat={handleIntroBeat} />
            </motion.div>
          )}

          {stage === 'draw' && winner && (
            <motion.div
              key={`draw-${drawIndex}`}
              className="flex min-h-0 w-full min-w-0 flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <GiftBoxLotteryDraw
                participants={pool}
                winnerName={winner.name}
                prizeName={config.prizeName}
                prizeIcon={config.prizeIcon || '🎁'}
                onWinnerRevealed={handleWinnerRevealed}
                onDrawAgain={handleDrawAgain}
                onFinish={handleExit}
              />
            </motion.div>
          )}
        </AnimatePresence>
      }
    />
  )
}
