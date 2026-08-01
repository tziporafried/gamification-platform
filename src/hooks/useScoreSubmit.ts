import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { canPerformAction } from '@/lib/canPerformAction'
import { countCompletionsOnIsraelDate } from '@/lib/israelTime'
import { isTrialScanLimitError } from '@/lib/plans'
import { notifyScanBySms } from '@/lib/scanSms'
import { useSmsNotifications } from '@/lib/smsNotifications'
import { isCorrectScan, isTriviaAction, scanPoints, TRIVIA_ANSWER_REQUIRED_MESSAGE, type ScannedOption } from '@/lib/tasks/triviaScan'
import type { Action, NewlyAwardedReward } from '@/types'

export interface ScoreSubmitResult {
  transactionId: string
  participantId: string
  participantExternalId: string
  participantGroupIds: string[]
  actionId: string
  actionCode: string
  participantName: string
  actionName: string
  points: number
  participantTotalPoints: number
  celebrationRewards: NewlyAwardedReward[]
  /** Total successful scans for this event after this insert (1-based for the new scan). */
  eventScanCount: number
  /**
   * Was the right answer scanned? Always true for a standard task, which has
   * nothing to be wrong about - so a caller that ignores this field behaves
   * exactly as it did before trivia existed.
   *
   * A wrong answer is a scan that succeeded and scored 0, NOT `ok: false`. That
   * distinction is what lets the kiosk show an answer screen where an actual
   * failure would only get a toast.
   */
  isCorrect: boolean
  /** The answer that was scanned, for a trivia task. Null for a standard one. */
  optionId: string | null
  optionLabel: string | null
}

export type ScoreSubmitErrorCode = 'TRIAL_SCAN_LIMIT_REACHED'

export type ScoreSubmitResponse =
  | { ok: true; result: ScoreSubmitResult }
  | { ok: false; error: string; code?: ScoreSubmitErrorCode }

interface UseScoreSubmitReturn {
  submit: (participantCode: string, actionCode: string) => Promise<ScoreSubmitResponse>
  submitting: boolean
  lastError: string | null
}

export function useScoreSubmit(eventId: string): UseScoreSubmitReturn {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  // Every scanning station in the app scores through this hook, so texting the
  // participant belongs here and not in each of them - the kiosk and the lottery
  // screen both get it without knowing the feature exists. Off outside a game.
  const smsNotifications = useSmsNotifications()

  const submit = useCallback(async (participantCode: string, actionCode: string): Promise<ScoreSubmitResponse> => {
    setLastError(null)

    const pCode = participantCode.trim()
    const aCode = actionCode.trim()

    if (!pCode) {
      const error = 'קוד משתתף הוא שדה חובה.'
      setLastError(error)
      return { ok: false, error }
    }
    if (!aCode) {
      const error = 'קוד משימה הוא שדה חובה.'
      setLastError(error)
      return { ok: false, error }
    }

    setSubmitting(true)

    try {
      const { data: participant, error: pError } = await supabase
        .from('participants')
        .select('id, name')
        .eq('event_id', eventId)
        .eq('external_id', pCode)
        .maybeSingle()

      if (pError) throw pError
      if (!participant) {
        const error = 'קוד לא תקין'
        setLastError(error)
        setSubmitting(false)
        return { ok: false, error }
      }

      // `select('*')` rather than a column list: `kind` (088) has to come back
      // when the database has it, and naming it explicitly would break every
      // scan on a database that has not run the migration yet. An action row is
      // small enough that asking for all of it costs nothing.
      const { data: scannedAction, error: aError } = await supabase
        .from('actions')
        .select('*')
        .eq('event_id', eventId)
        .eq('code', aCode)
        .maybeSingle()

      if (aError) throw aError

      let action = scannedAction as Action | null
      let option: ScannedOption | null = null

      // Not a task code - so it may be one of a trivia task's answer cards.
      // Only reached when the lookup above found nothing, which is why a game
      // with no trivia never pays for this query.
      if (!action) {
        const { data: optionRow, error: oError } = await supabase
          .from('action_options')
          .select('id, label, is_correct, actions(*)')
          .eq('event_id', eventId)
          .eq('code', aCode)
          .maybeSingle()

        // A database without 088 has no such table. That is not an error worth
        // showing anybody: the code simply does not exist here, which is what
        // the message below already says.
        if (!oError && optionRow) {
          const parent = (optionRow as unknown as { actions: Action | null }).actions
          if (parent) {
            action = parent
            option = {
              id: optionRow.id as string,
              label: optionRow.label as string,
              is_correct: optionRow.is_correct as boolean,
            }
          }
        }
      }

      if (!action) {
        const error = `משימה "${aCode}" לא נמצאה.`
        setLastError(error)
        setSubmitting(false)
        return { ok: false, error }
      }

      // The question's own code, not one of its answers. Nothing prints it, so
      // this comes from manual entry - where scoring it would award the full
      // points for answering nothing.
      if (!option && isTriviaAction(action)) {
        setLastError(TRIVIA_ANSWER_REQUIRED_MESSAGE)
        setSubmitting(false)
        return { ok: false, error: TRIVIA_ANSWER_REQUIRED_MESSAGE }
      }

      const completionsPromise = action.daily_limit
        ? supabase
            .from('point_transactions')
            .select('created_at')
            .eq('participant_id', participant.id)
            .eq('action_id', action.id)
        : supabase
            .from('point_transactions')
            .select('id', { count: 'exact', head: true })
            .eq('participant_id', participant.id)
            .eq('action_id', action.id)

      const [completionsRes, actionGroupsRes, participantGroupsRes] = await Promise.all([
        completionsPromise,
        supabase
          .from('action_groups')
          .select('group_id')
          .eq('action_id', action.id),
        supabase
          .from('participant_groups')
          .select('group_id')
          .eq('participant_id', participant.id),
      ])

      if (completionsRes.error) throw completionsRes.error
      if (actionGroupsRes.error) throw actionGroupsRes.error
      if (participantGroupsRes.error) throw participantGroupsRes.error

      const now = new Date()
      let previousCompletions = 0
      let previousCompletionsToday = 0

      if (action.daily_limit) {
        const timestamps = ((completionsRes.data ?? []) as { created_at: string }[]).map((tx) => tx.created_at)
        previousCompletions = timestamps.length
        previousCompletionsToday = countCompletionsOnIsraelDate(timestamps, now)
      } else {
        previousCompletions = completionsRes.count ?? 0
      }
      const allowedGroupIds = (actionGroupsRes.data ?? []).map((r) => r.group_id)
      const participantGroupIds = (participantGroupsRes.data ?? []).map((r) => r.group_id)

      const check = canPerformAction({
        action: {
          is_active: action.is_active,
          max_completions: action.max_completions,
          daily_limit: action.daily_limit,
          daily_start_hour: action.daily_start_hour,
          daily_start_minute: action.daily_start_minute,
          daily_end_hour: action.daily_end_hour,
          daily_end_minute: action.daily_end_minute,
          allowedGroupIds,
        },
        participantGroupIds,
        previousCompletions,
        previousCompletionsToday,
        now,
      })

      if (!check.allowed) {
        setLastError(check.message)
        setSubmitting(false)
        return { ok: false, error: check.message }
      }

      const isCorrect = isCorrectScan(option)
      const awardedPoints = scanPoints(action.points, option)

      const { data: insertedTx, error: insertError } = await supabase
        .from('point_transactions')
        .insert({
          event_id: eventId,
          participant_id: participant.id,
          action_id: action.id,
          points: awardedPoints,
          created_by: user!.id,
          // Only sent when an answer was actually scanned, so a database
          // without 088 is never asked to store a column it does not have.
          ...(option ? { action_option_id: option.id } : {}),
        })
        .select('id')
        .single()

      if (insertError) {
        if (isTrialScanLimitError(insertError.message)) {
          setSubmitting(false)
          return { ok: false, error: insertError.message, code: 'TRIAL_SCAN_LIMIT_REACHED' }
        }
        throw insertError
      }

      const { data: participantTransactions, error: totalError } = await supabase
        .from('point_transactions')
        .select('points')
        .eq('event_id', eventId)
        .eq('participant_id', participant.id)

      if (totalError) throw totalError

      const participantTotalPoints = (participantTransactions ?? []).reduce(
        (sum, tx) => sum + (tx.points ?? 0),
        0,
      )

      const { count: eventScanCountFallback, error: scanCountError } = await supabase
        .from('point_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)

      if (scanCountError) throw scanCountError

      const { data: eventQuota } = await supabase
        .from('events')
        .select('plan, trial_scans_used')
        .eq('id', eventId)
        .maybeSingle()

      const eventScanCount =
        eventQuota?.plan === 'free' && typeof eventQuota.trial_scans_used === 'number'
          ? eventQuota.trial_scans_used
          : (eventScanCountFallback ?? 0)

      let celebrationRewards: NewlyAwardedReward[] = []
      try {
        const { data: newRewards, error: rewardError } = await supabase
          .rpc('check_and_award_rewards', { p_participant_id: participant.id })

        if (!rewardError && newRewards && newRewards.length > 0) {
          celebrationRewards = newRewards as NewlyAwardedReward[]
        }
      } catch {
        // Reward check failed silently
      }

      // Deliberately not awaited: the scan is saved and the celebration is the
      // next thing that must happen. notifyScanBySms never rejects, and a text
      // that does not go out is not a scan that failed.
      //
      // Nothing is sent for a wrong answer. The customer's template is built
      // around "you earned X points for Y" (src/lib/smsTemplate.ts), and a text
      // saying 0 is not the message they wrote.
      if (smsNotifications && isCorrect) {
        void notifyScanBySms({
          eventId,
          participantId: participant.id,
          participantName: participant.name,
          actionName: action.name,
          points: awardedPoints,
          totalPoints: participantTotalPoints,
          transactionId: insertedTx.id,
        })
      }

      setSubmitting(false)
      return {
        ok: true,
        result: {
          transactionId: insertedTx.id,
          participantId: participant.id,
          participantExternalId: pCode,
          participantGroupIds,
          actionId: action.id,
          actionCode: action.code,
          participantName: participant.name,
          actionName: action.name,
          points: awardedPoints,
          participantTotalPoints,
          celebrationRewards,
          eventScanCount,
          isCorrect,
          optionId: option?.id ?? null,
          optionLabel: option?.label ?? null,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'משהו השתבש.'
      if (isTrialScanLimitError(message)) {
        setSubmitting(false)
        return { ok: false, error: message, code: 'TRIAL_SCAN_LIMIT_REACHED' }
      }
      setLastError(message)
      setSubmitting(false)
      return { ok: false, error: message }
    }
  }, [eventId, user, smsNotifications])

  return { submit, submitting, lastError }
}
