import { useCallback, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { isTrialScanLimitError } from '@/lib/plans'
import { notifyScanBySms } from '@/lib/scanSms'
import { useSmsNotifications } from '@/lib/smsNotifications'
import { validateBonus, bonusErrorMessage, type BonusDraft } from '@/lib/bonusPoints'
import type { NewlyAwardedReward } from '@/types'

/**
 * Awarding points for something the game has no card for.
 *
 * The sibling of useScoreSubmit, and deliberately not a branch inside it: that
 * hook's whole body is about resolving two scanned codes into a task and asking
 * whether this participant may perform it. A bonus has no code, no task and no
 * limit to check - the operator standing there is the rule. What the two do
 * share is the tail, and it is repeated here rather than extracted: insert,
 * re-total, check the prizes, text the participant. Four calls, in an order
 * that matters, is less to keep straight than a shared function with a flag in
 * it deciding which half of itself to run.
 *
 * The row it writes has no action_id and a bonus_reason instead - see migration
 * 092 for why that is the shape.
 */

export interface BonusAwardResult {
  transactionId: string
  participantId: string
  participantName: string
  /** What the operator said it was for. Stands where a task name would. */
  reason: string
  points: number
  participantTotalPoints: number
  celebrationRewards: NewlyAwardedReward[]
  /** Total scores recorded for this event after this one, as useScoreSubmit counts them. */
  eventScanCount: number
}

export type BonusAwardErrorCode = 'TRIAL_SCAN_LIMIT_REACHED'

export type BonusAwardResponse =
  | { ok: true; result: BonusAwardResult }
  | { ok: false; error: string; code?: BonusAwardErrorCode }

/**
 * A database that has not run 092 still has action_id NOT NULL and no
 * bonus_reason column, and rejects the insert on one of those two grounds. The
 * operator can do nothing about either, so both are answered with the one
 * sentence that is actually true of the situation.
 */
function isMissingBonusSchema(message: string): boolean {
  return /bonus_reason/i.test(message) || /action_id/i.test(message)
}

const MISSING_SCHEMA_MESSAGE = 'נקודות בונוס עדיין לא זמינות במשחק הזה.'

export function useBonusAward(eventId: string) {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const smsNotifications = useSmsNotifications()

  const award = useCallback(async (draft: BonusDraft): Promise<BonusAwardResponse> => {
    const valid = validateBonus(draft)
    if (!valid.ok) return { ok: false, error: bonusErrorMessage(valid.error) }

    setSubmitting(true)

    try {
      // The picker only ever offers players of this game, so this is a
      // freshness check rather than a trust check - and it is where the name
      // that goes on the celebration and the text message comes from.
      const { data: participant, error: pError } = await supabase
        .from('participants')
        .select('id, name')
        .eq('event_id', eventId)
        .eq('id', valid.participantId)
        .maybeSingle()

      if (pError) throw pError
      if (!participant) {
        setSubmitting(false)
        return { ok: false, error: 'המשתתף לא נמצא במשחק הזה.' }
      }

      const { data: insertedTx, error: insertError } = await supabase
        .from('point_transactions')
        .insert({
          event_id: eventId,
          participant_id: participant.id,
          action_id: null,
          points: valid.points,
          bonus_reason: valid.reason,
          created_by: user!.id,
        })
        .select('id')
        .single()

      if (insertError) {
        // A bonus is a row in the same append-only log, so it is counted by the
        // same trial quota (055) and refused by the same trigger.
        if (isTrialScanLimitError(insertError.message)) {
          setSubmitting(false)
          return { ok: false, error: insertError.message, code: 'TRIAL_SCAN_LIMIT_REACHED' }
        }
        if (isMissingBonusSchema(insertError.message)) {
          setSubmitting(false)
          return { ok: false, error: MISSING_SCHEMA_MESSAGE }
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

      const { count: eventScanCountFallback } = await supabase
        .from('point_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)

      const { data: eventQuota } = await supabase
        .from('events')
        .select('plan, trial_scans_used')
        .eq('id', eventId)
        .maybeSingle()

      const eventScanCount =
        eventQuota?.plan === 'free' && typeof eventQuota.trial_scans_used === 'number'
          ? eventQuota.trial_scans_used
          : (eventScanCountFallback ?? 0)

      // A bonus can carry someone over a prize threshold exactly as a scan can,
      // and the kiosk celebrates it the same way.
      let celebrationRewards: NewlyAwardedReward[] = []
      try {
        const { data: newRewards, error: rewardError } = await supabase
          .rpc('check_and_award_rewards', { p_participant_id: participant.id })

        if (!rewardError && newRewards && newRewards.length > 0) {
          celebrationRewards = newRewards as NewlyAwardedReward[]
        }
      } catch {
        // Reward check failed silently - the points are already recorded.
      }

      // Not awaited, for the reason useScoreSubmit gives: the award is saved and
      // the celebration is what has to happen next. The reason goes in where the
      // task name goes, so `{{משימה}}` reads as "you got 30 points for helping
      // set up" rather than leaving a hole in the customer's sentence.
      if (smsNotifications) {
        void notifyScanBySms({
          eventId,
          participantId: participant.id,
          participantName: participant.name,
          actionName: valid.reason,
          points: valid.points,
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
          participantName: participant.name,
          reason: valid.reason,
          points: valid.points,
          participantTotalPoints,
          celebrationRewards,
          eventScanCount,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'משהו השתבש.'
      setSubmitting(false)
      if (isTrialScanLimitError(message)) {
        return { ok: false, error: message, code: 'TRIAL_SCAN_LIMIT_REACHED' }
      }
      if (isMissingBonusSchema(message)) {
        return { ok: false, error: MISSING_SCHEMA_MESSAGE }
      }
      return { ok: false, error: message }
    }
  }, [eventId, user, smsNotifications])

  return { award, submitting }
}
