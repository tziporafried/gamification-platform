import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { canPerformAction } from '@/lib/canPerformAction'
import type { NewlyAwardedReward } from '@/types'

export interface ScoreSubmitResult {
  participantId: string
  participantExternalId: string
  participantGroupIds: string[]
  actionId: string
  actionCode: string
  participantName: string
  actionName: string
  points: number
  celebrationRewards: NewlyAwardedReward[]
}

interface UseScoreSubmitReturn {
  submit: (participantCode: string, actionCode: string) => Promise<ScoreSubmitResult | null>
  submitting: boolean
  lastError: string | null
}

export function useScoreSubmit(eventId: string): UseScoreSubmitReturn {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const submit = useCallback(async (participantCode: string, actionCode: string): Promise<ScoreSubmitResult | null> => {
    setLastError(null)

    const pCode = participantCode.trim()
    const aCode = actionCode.trim()

    if (!pCode) {
      setLastError('קוד משתתף הוא שדה חובה.')
      return null
    }
    if (!aCode) {
      setLastError('קוד משימה הוא שדה חובה.')
      return null
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
        setLastError('קוד לא תקין')
        setSubmitting(false)
        return null
      }

      const { data: action, error: aError } = await supabase
        .from('actions')
        .select('id, name, code, points, is_active, max_completions')
        .eq('event_id', eventId)
        .eq('code', aCode)
        .maybeSingle()

      if (aError) throw aError
      if (!action) {
        setLastError(`משימה "${aCode}" לא נמצאה.`)
        setSubmitting(false)
        return null
      }

      // Fetch validation data in parallel: previous completions, action groups, participant groups
      const [completionsRes, actionGroupsRes, participantGroupsRes] = await Promise.all([
        supabase
          .from('point_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('participant_id', participant.id)
          .eq('action_id', action.id),
        supabase
          .from('action_groups')
          .select('group_id')
          .eq('action_id', action.id),
        supabase
          .from('participant_groups')
          .select('group_id')
          .eq('participant_id', participant.id),
      ])

      const previousCompletions = completionsRes.count ?? 0
      const allowedGroupIds = (actionGroupsRes.data ?? []).map((r) => r.group_id)
      const participantGroupIds = (participantGroupsRes.data ?? []).map((r) => r.group_id)

      const check = canPerformAction({
        action: {
          is_active: action.is_active,
          max_completions: action.max_completions,
          allowedGroupIds,
        },
        participantGroupIds,
        previousCompletions,
      })

      if (!check.allowed) {
        setLastError(check.message)
        setSubmitting(false)
        return null
      }

      const { error: insertError } = await supabase
        .from('point_transactions')
        .insert({
          event_id: eventId,
          participant_id: participant.id,
          action_id: action.id,
          points: action.points,
          created_by: user!.id,
        })

      if (insertError) throw insertError

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
        participantId: participant.id,
        participantExternalId: pCode,
        participantGroupIds,
        actionId: action.id,
        actionCode: action.code,
        participantName: participant.name,
        actionName: action.name,
        points: action.points,
        celebrationRewards,
      }
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'משהו השתבש.')
      setSubmitting(false)
      return null
    }
  }, [eventId, user])

  return { submit, submitting, lastError }
}
