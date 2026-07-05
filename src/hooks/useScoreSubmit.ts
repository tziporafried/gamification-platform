import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { canPerformAction } from '@/lib/canPerformAction'
import { countCompletionsOnIsraelDate } from '@/lib/israelTime'
import type { NewlyAwardedReward } from '@/types'

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
}

export type ScoreSubmitResponse =
  | { ok: true; result: ScoreSubmitResult }
  | { ok: false; error: string }

interface UseScoreSubmitReturn {
  submit: (participantCode: string, actionCode: string) => Promise<ScoreSubmitResponse>
  submitting: boolean
  lastError: string | null
}

export function useScoreSubmit(eventId: string): UseScoreSubmitReturn {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

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

      const { data: action, error: aError } = await supabase
        .from('actions')
        .select('id, name, code, points, is_active, max_completions, daily_limit, daily_start_hour, daily_start_minute, daily_end_hour, daily_end_minute')
        .eq('event_id', eventId)
        .eq('code', aCode)
        .maybeSingle()

      if (aError) throw aError
      if (!action) {
        const error = `משימה "${aCode}" לא נמצאה.`
        setLastError(error)
        setSubmitting(false)
        return { ok: false, error }
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

      const { data: insertedTx, error: insertError } = await supabase
        .from('point_transactions')
        .insert({
          event_id: eventId,
          participant_id: participant.id,
          action_id: action.id,
          points: action.points,
          created_by: user!.id,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

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
          points: action.points,
          participantTotalPoints,
          celebrationRewards,
        },
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'משהו השתבש.'
      setLastError(error)
      setSubmitting(false)
      return { ok: false, error }
    }
  }, [eventId, user])

  return { submit, submitting, lastError }
}
