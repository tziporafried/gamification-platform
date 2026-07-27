import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { EligibleParticipant } from './types'
import { totalEntries } from './lottery/lotteryMode'
import {
  closeScanLotteryRound,
  fetchOpenScanLotteryRound,
  fetchScanLotteryEntries,
  isMissingScanLotteryTableError,
  openScanLotteryRound,
  roundStatus,
  type ScanLotteryRound,
  type ScanLotteryRoundStatus,
} from './lottery/scanLotteryRounds'

/**
 * The organizer's side of a scan lottery: open a collection window, watch the
 * tickets arrive, close it, then draw.
 *
 * While the round is open the pool is live - the dock has to show the count
 * climbing as the floor scans, or the organizer has no way to judge when to
 * close. That comes from the same two mechanisms the kiosk leaderboard uses: a
 * realtime subscription on point_transactions inserts for this game, and a
 * slow poll behind it so a dropped socket costs a few seconds rather than the
 * whole round.
 *
 * Once closed, nothing can change the answer again (a round is never
 * reopened), so the polling and the subscription both stop.
 *
 * Which round the screen picks up when it opens is the fiddly part, and the
 * rule is: resume what is worth resuming, sweep away what is not.
 *
 *   closed          history. Never fetched back, so setting up a lottery
 *                   always starts from nothing rather than from yesterday's
 *                   finished pool. One closed during this session stays on
 *                   screen because this hook still holds it.
 *   open, has people  resumed. A refresh mid-collection must not lose them.
 *   open, empty       swept. Only this screen can add a ticket, so a window
 *                   left open by an earlier visit was never collecting - it
 *                   was just making every later visit offer to "resume" it.
 */

/** How often to re-count while collecting, if realtime never fires. */
const POLL_MS = 10_000

export interface ScanLotteryRoundState {
  round: ScanLotteryRound | null
  status: ScanLotteryRoundStatus
  participants: EligibleParticipant[]
  /** People who have scanned at least once inside the window. */
  count: number
  /** Tickets in the hat - the number the draw is weighted by. */
  entries: number
  /** True until the game's current round (if any) has been resolved. */
  loading: boolean
  /** True while an open/close is in flight, so the dock can disable itself. */
  busy: boolean
  error: string | null
  open: () => Promise<void>
  close: () => Promise<void>
  /** Abandon this round and start collecting again from zero. */
  reset: () => Promise<void>
  /** Re-count the pool now, without waiting for realtime or the poll. */
  recount: () => void
  refresh: () => void
}

const IDLE: EligibleParticipant[] = []

export function useScanLotteryRound(eventId: string, enabled: boolean): ScanLotteryRoundState {
  const { user } = useAuth()
  const [round, setRound] = useState<ScanLotteryRound | null>(null)
  const [participants, setParticipants] = useState<EligibleParticipant[]>(IDLE)
  const [loading, setLoading] = useState(enabled)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  const failWith = useCallback((message: string, fallback: string) => {
    setError(isMissingScanLotteryTableError(message) ? 'הגרלת הסריקות עדיין לא הופעלה במסד הנתונים.' : fallback)
  }, [])

  // Pick up a round that is still collecting, if the game has one. A closed
  // round is not fetched back: setting up a lottery starts from nothing, and
  // one closed during this session stays on screen because this hook is still
  // holding it in state.
  useEffect(() => {
    if (!enabled || !eventId) {
      setRound(null)
      setParticipants(IDLE)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetchOpenScanLotteryRound(eventId)
      .then((open) => {
        if (cancelled) return
        setRound(open)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setRound(null)
        failWith(err instanceof Error ? err.message : '', 'לא ניתן לטעון את מצב ההגרלה כרגע.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [eventId, enabled, tick, failWith])

  const roundId = round?.id ?? null
  const isOpen = round != null && round.closedAt == null

  // The round this screen opened, if any. What separates "I am collecting"
  // from "somebody left a window open here once" - see the empty-round sweep
  // in the entries effect below.
  const openedHereRef = useRef<string | null>(null)

  // Count the pool. Re-runs on every realtime insert while open, and once more
  // on close so the frozen answer is the one the draw uses.
  const [entriesTick, setEntriesTick] = useState(0)
  const recount = useCallback(() => setEntriesTick((t) => t + 1), [])

  useEffect(() => {
    if (!roundId) {
      setParticipants(IDLE)
      return
    }
    let cancelled = false
    fetchScanLotteryEntries(roundId)
      .then((rows) => {
        if (cancelled) return
        setParticipants(rows)
        setError(null)

        // Litter, not a collection in progress.
        //
        // Only this screen can add a ticket, so a round left open by an
        // earlier visit collects nothing while nobody is looking at it - it
        // just sits there, and every later visit was offering to "resume" it.
        // One with nobody in it has nothing to preserve, so it is closed on
        // sight and the organizer gets a clean start. A round that does hold
        // people is left alone: that one is worth resuming, and losing it to
        // a refresh would be the worse mistake.
        if (rows.length === 0 && isOpen && openedHereRef.current !== roundId) {
          void closeScanLotteryRound(roundId)
            .then(() => {
              if (!cancelled) setRound(null)
            })
            .catch(() => {
              // Leave it be: an empty round the organizer can close by hand is
              // a smaller problem than an error over housekeeping.
            })
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        failWith(err instanceof Error ? err.message : '', 'לא ניתן לספור את הכרטיסים כרגע.')
      })
    return () => {
      cancelled = true
    }
  }, [roundId, isOpen, entriesTick, failWith])

  // Live while collecting: realtime first, slow poll as the safety net. Both
  // stop the moment the round closes - the count cannot move after that.
  const recountRef = useRef(recount)
  recountRef.current = recount

  useEffect(() => {
    if (!isOpen || !eventId) return
    const channel = supabase
      .channel(`scan_lottery_${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'point_transactions', filter: `event_id=eq.${eventId}` },
        () => recountRef.current(),
      )
      .subscribe()
    const poll = window.setInterval(() => recountRef.current(), POLL_MS)
    return () => {
      window.clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [isOpen, eventId])

  const open = useCallback(async () => {
    if (!eventId || busy) return
    setBusy(true)
    setError(null)
    try {
      const opened = await openScanLotteryRound(eventId, user?.id)
      openedHereRef.current = opened.id
      setRound(opened)
      setParticipants(IDLE)
      recount()
    } catch (err: unknown) {
      failWith(err instanceof Error ? err.message : '', 'לא ניתן לפתוח את ההגרלה כרגע.')
    } finally {
      setBusy(false)
    }
  }, [eventId, busy, user, recount, failWith])

  const close = useCallback(async () => {
    if (!round || round.closedAt || busy) return
    setBusy(true)
    setError(null)
    try {
      const closed = await closeScanLotteryRound(round.id)
      setRound(closed)
      recount()
    } catch (err: unknown) {
      failWith(err instanceof Error ? err.message : '', 'לא ניתן לסגור את ההגרלה כרגע.')
    } finally {
      setBusy(false)
    }
  }, [round, busy, recount, failWith])

  const reset = useCallback(async () => {
    if (!round || busy) return
    // A round that is still open has to be closed before a new one can exist:
    // the one-open-round index in 080 would otherwise hand this very round
    // back on the next open(), and "סבב חדש" would look like it did nothing.
    if (!round.closedAt) {
      setBusy(true)
      try {
        await closeScanLotteryRound(round.id)
      } catch (err: unknown) {
        failWith(err instanceof Error ? err.message : '', 'לא ניתן לסגור את הסבב הקודם כרגע.')
        setBusy(false)
        return
      }
      setBusy(false)
    }
    setRound(null)
    setParticipants(IDLE)
    setError(null)
  }, [round, busy, failWith])

  const entries = useMemo(() => totalEntries(participants), [participants])

  return {
    round,
    status: roundStatus(round),
    participants,
    count: participants.length,
    entries,
    loading,
    busy,
    error,
    open,
    close,
    reset,
    recount,
    refresh,
  }
}
