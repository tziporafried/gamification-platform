import { useCallback, useEffect, useState } from 'react'
import type { EligibleParticipant } from './types'
import {
  clearScanLottery,
  closeScanLottery,
  loadScanLottery,
  openScanLottery,
  statusOf,
  type ScanLotteryCollection,
  type ScanLotteryStatus,
} from './lottery/scanLotteryStore'

/**
 * The organizer's side of a scan lottery: open a collection, scan people in,
 * close it, then draw.
 *
 * The collection lives in localStorage (see scanLotteryStore), so every
 * operation here is synchronous - no loading, nothing in flight, no way for
 * two writers to disagree. The count stays live because this screen is the
 * only thing that can change it: its scanner recounts as each person lands.
 */

export interface ScanLotteryRoundState {
  round: ScanLotteryCollection | null
  status: ScanLotteryStatus
  participants: EligibleParticipant[]
  /** People in the hat. */
  count: number
  /** Tickets - the same number, since it is one each. */
  entries: number
  open: () => void
  close: () => void
  /** Throw the collection away and start again - "הגרלה חדשה". */
  reset: () => void
  /** Re-read after a scan has been added, so the count never lags the hand. */
  recount: () => void
}

const NOBODY: EligibleParticipant[] = []

export function useScanLotteryRound(eventId: string): ScanLotteryRoundState {
  const [round, setRound] = useState<ScanLotteryCollection | null>(null)

  // Read once for the game, not every time the toggle moves.
  //
  // The stored collection answers one question - what survived arriving at
  // this screen - and loadScanLottery decides it: an open one with people is
  // resumed, a closed one is history, an empty one is swept.
  //
  // What is held here is a different question: what this visit has done since.
  // Wiping it whenever another eligibility choice was selected meant that
  // closing the collection and then glancing at "לפי קבוצות" threw the pool
  // away, because a closed collection is exactly what the store will not hand
  // back. Leaving the toggle is not leaving the lottery.
  useEffect(() => {
    setRound(eventId ? loadScanLottery(eventId) : null)
  }, [eventId])

  const recount = useCallback(() => {
    if (!eventId) return
    // Read through the store rather than trusting what this screen last held:
    // a scan lands there before it lands here.
    setRound((current) => (current ? loadScanLottery(eventId) ?? current : current))
  }, [eventId])

  const open = useCallback(() => {
    if (!eventId) return
    setRound(openScanLottery(eventId))
  }, [eventId])

  const close = useCallback(() => {
    if (!eventId) return
    setRound(closeScanLottery(eventId))
  }, [eventId])

  const reset = useCallback(() => {
    if (!eventId) return
    clearScanLottery(eventId)
    setRound(null)
  }, [eventId])

  const participants = round?.participants ?? NOBODY

  return {
    round,
    status: statusOf(round),
    participants,
    count: participants.length,
    entries: participants.length,
    open,
    close,
    reset,
    recount,
  }
}
