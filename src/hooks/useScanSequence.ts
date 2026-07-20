import { useCallback, useEffect, useRef, useState } from 'react'
import {
  resolveScan,
  expirePending,
  SPLIT_SCAN_TIMEOUT_MS,
  type PendingParticipant,
} from '@/lib/scanSequence'

export { SPLIT_SCAN_TIMEOUT_MS, SCAN_SEQUENCE_MESSAGES, type PendingParticipant } from '@/lib/scanSequence'

interface UseScanSequenceOptions {
  /** Called once both codes are known. */
  onPair: (participantCode: string, actionCode: string) => void | Promise<void>
  onError: (message: string) => void
}

interface UseScanSequenceReturn {
  handleScan: (raw: string) => void
  /** Participant card already scanned, waiting on its action card; null when idle. */
  pending: PendingParticipant | null
  /** Whole seconds left to scan the action card. 0 when idle. */
  remainingSeconds: number
  /** 0→1 progress through the waiting window, for the countdown visual. */
  waitProgress: number
  /** Drops any half-finished sequence (e.g. when leaving the scan surface). */
  reset: () => void
}

/**
 * Turns raw scanner reads into (participant, action) pairs.
 *
 * A combined card scores immediately; a participant card arms the sequence
 * until its action card is scanned. The ordering rules live in
 * `@/lib/scanSequence` - this owns only React state and the countdown tick.
 */
export function useScanSequence({ onPair, onError }: UseScanSequenceOptions): UseScanSequenceReturn {
  const [pending, setPending] = useState<PendingParticipant | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)

  // Held in refs so handleScan keeps a stable identity across parent renders -
  // callers pass inline closures that would otherwise change every render.
  const onPairRef = useRef(onPair)
  const onErrorRef = useRef(onError)
  const pendingRef = useRef(pending)
  onPairRef.current = onPair
  onErrorRef.current = onError
  pendingRef.current = pending

  const applyPending = useCallback((next: PendingParticipant | null) => {
    pendingRef.current = next
    setPending(next)
    setRemainingMs(next ? Math.max(0, next.expiresAt - Date.now()) : 0)
  }, [])

  const reset = useCallback(() => applyPending(null), [applyPending])

  // Countdown + expiry. Runs only while a participant is armed. The 100ms tick keeps
  // the draining ring smooth without leaning on requestAnimationFrame.
  useEffect(() => {
    if (!pending) return
    const tick = () => {
      const now = Date.now()
      if (!expirePending(pending, now)) {
        applyPending(null)
        return
      }
      setRemainingMs(pending.expiresAt - now)
    }
    tick()
    const timer = setInterval(tick, 100)
    return () => clearInterval(timer)
  }, [pending, applyPending])

  const handleScan = useCallback(
    (raw: string) => {
      const outcome = resolveScan({ raw, pending: pendingRef.current, now: Date.now() })

      switch (outcome.kind) {
        case 'pair':
          applyPending(null)
          onPairRef.current(outcome.participantCode, outcome.actionCode)
          return
        case 'armed':
          applyPending(outcome.pending)
          return
        case 'error':
          applyPending(outcome.pending)
          onErrorRef.current(outcome.message)
          return
      }
    },
    [applyPending],
  )

  return {
    handleScan,
    pending,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    waitProgress: pending ? remainingMs / SPLIT_SCAN_TIMEOUT_MS : 0,
    reset,
  }
}
