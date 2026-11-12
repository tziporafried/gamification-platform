import { useCallback, useEffect, useRef, useState } from 'react'
import { FLASH_EXTEND_SECONDS } from '@/lib/flashChallenge/flashChallenge'
import {
  clearFlashChallenge,
  closeFlashChallenge,
  extendFlashChallenge,
  loadFlashChallenge,
  openFlashChallenge,
  remainingMs,
  statusOf,
  type FlashChallenge,
  type FlashChallengeDraft,
} from './flashChallengeStore'
import { playFlashGo, playFlashTick } from './flashSfx'
import { useFlashChallengeScanner, type FlashScanFeedback } from './useFlashChallengeScanner'

/** How often the countdown redraws. A quarter second keeps the ring smooth. */
const TICK_MS = 250

/**
 * Where the scan screen is in a flash challenge:
 *
 *   idle      no challenge - the scan screen is itself
 *   setup     the form is open over the scan screen
 *   intro     the "⚡ אתגר בזק!" takeover
 *   live      the clock runs; the scanner in the middle reads for the challenge
 *   timesup   the "⏱️ הזמן נגמר!" beat
 *   summary   the podium, over the scan screen, until the operator dismisses it
 */
export type FlashPhase = 'idle' | 'setup' | 'intro' | 'live' | 'timesup' | 'summary'

export interface FlashChallengeController {
  phase: FlashPhase
  challenge: FlashChallenge | null
  /** The title shown during the intro, before the challenge exists. */
  introTitle: string | null
  remainingMs: number
  /** The summary arrived from the clock, not from a reload - play the fanfare. */
  celebrate: boolean
  feedback: FlashScanFeedback | null
  feedbackId: number
  /** A card is being looked up or awarded. */
  busy: boolean
  /**
   * Scans belong to the challenge rather than to task scoring - from the intro
   * until the summary is dismissed, so a late card is told "האתגר נסגר"
   * instead of scoring a task in the middle of the podium.
   */
  ownsScanner: boolean
  handleScan: (raw: string) => void
  /** The manual fallback - a participant picked from the roster. */
  handleManual: (participant: { id: string; name: string }) => Promise<void>
  openSetup: () => void
  closeSetup: () => void
  launch: (draft: FlashChallengeDraft) => void
  introDone: () => void
  extend: () => void
  finish: () => void
  timesUpDone: () => void
  /** "חזרה לסריקה" - back to plain scanning. */
  dismiss: () => void
}

interface UseFlashChallengeOptions {
  eventId: string
  scanMode: string | null
  /** A completion was recorded - the host refreshes its feeds. */
  onCompleted?: () => void
}

export function useFlashChallenge({ eventId, scanMode, onCompleted }: UseFlashChallengeOptions): FlashChallengeController {
  const [challenge, setChallenge] = useState<FlashChallenge | null>(() => {
    const stored = loadFlashChallenge(eventId)
    if (!stored) return null
    // One that ran out while nobody was looking is written closed now, so it
    // reads the same way from here on.
    return statusOf(stored) === 'open' ? stored : (closeFlashChallenge(eventId) ?? stored)
  })
  const [phase, setPhase] = useState<FlashPhase>(() =>
    challenge ? (statusOf(challenge) === 'open' ? 'live' : 'summary') : 'idle',
  )
  const [introDraft, setIntroDraft] = useState<FlashChallengeDraft | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [celebrate, setCelebrate] = useState(false)
  const onCompletedRef = useRef(onCompleted)
  onCompletedRef.current = onCompleted

  const scanner = useFlashChallengeScanner({
    eventId,
    challenge,
    scanMode,
    onCompleted: (next) => {
      setChallenge(next)
      onCompletedRef.current?.()
    },
  })

  const finish = useCallback(() => {
    const closed = closeFlashChallenge(eventId)
    if (closed) setChallenge(closed)
    setPhase('timesup')
  }, [eventId])

  // The clock. It reads storage for the cutoff, so a close written elsewhere
  // (a second tab) is honoured too.
  const challengeId = challenge?.id
  useEffect(() => {
    if (phase !== 'live' || !challengeId) return
    const tick = () => {
      const t = Date.now()
      setNow(t)
      const latest = loadFlashChallenge(eventId)
      if (latest && latest.id === challengeId && statusOf(latest, t) === 'closed') finish()
    }
    tick()
    const id = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(id)
  }, [phase, eventId, challengeId, finish])

  const left = phase === 'live' && challenge ? remainingMs(challenge, now) : 0
  const secondsLeft = Math.ceil(left / 1000)

  // A tick every second the clock runs - the cue turns urgent in the last ten.
  useEffect(() => {
    if (phase === 'live' && secondsLeft > 0) playFlashTick(secondsLeft)
  }, [phase, secondsLeft])

  const launch = useCallback((draft: FlashChallengeDraft) => {
    setIntroDraft(draft)
    setPhase('intro')
  }, [])

  // The challenge is only written when the intro ends, so the clock starts
  // when the room can see it - and a reload mid-intro lands on plain scanning.
  const introDone = useCallback(() => {
    if (!introDraft) return
    setChallenge(openFlashChallenge(eventId, introDraft))
    setIntroDraft(null)
    setCelebrate(false)
    setPhase('live')
    playFlashGo()
  }, [eventId, introDraft])

  const extend = useCallback(() => {
    const next = extendFlashChallenge(eventId, FLASH_EXTEND_SECONDS)
    if (next) setChallenge(next)
  }, [eventId])

  const timesUpDone = useCallback(() => {
    setCelebrate(true)
    setPhase('summary')
  }, [])

  const reset = useCallback((next: FlashPhase) => {
    clearFlashChallenge(eventId)
    setChallenge(null)
    setIntroDraft(null)
    setPhase(next)
  }, [eventId])

  const ownsScanner = phase === 'intro' || phase === 'live' || phase === 'timesup' || phase === 'summary'

  return {
    phase,
    challenge,
    introTitle: introDraft?.title ?? null,
    remainingMs: left,
    celebrate,
    feedback: scanner.feedback,
    feedbackId: scanner.feedbackId,
    busy: scanner.busy,
    ownsScanner,
    handleScan: scanner.handleScan,
    handleManual: scanner.handleManual,
    // Opening the form never interrupts a running challenge.
    openSetup: () => setPhase((p) => (p === 'idle' ? 'setup' : p)),
    closeSetup: () => setPhase((p) => (p === 'setup' ? 'idle' : p)),
    launch,
    introDone,
    extend,
    finish,
    timesUpDone,
    dismiss: () => reset('idle'),
  }
}
