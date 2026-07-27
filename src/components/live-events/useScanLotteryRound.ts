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

export function useScanLotteryRound(eventId: string, enabled: boolean): ScanLotteryRoundState {
  const [round, setRound] = useState<ScanLotteryCollection | null>(null)

  // Picks up a collection still open from a refresh. A closed one is history
  // and an empty one is swept - both decided by loadScanLottery.
  useEffect(() => {
    setRound(enabled && eventId ? loadScanLottery(eventId) : null)
  }, [eventId, enabled])

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
