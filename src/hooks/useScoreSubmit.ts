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
  basePoints: number
  speedBonusApplied: boolean
  speedBonusLabel: string
  celebrationRewards: NewlyAwardedReward[]
}

interface TimedAction {
  id: string
  name: string
  code: string
  points: number
  is_active: boolean
  max_completions: number | null
  time_enabled: boolean
  start_at: string | null
  end_at: string | null
  speed_bonus_enabled: boolean
  speed_bonus_minutes: number | null
  speed_bonus_flat_points: number | null
  speed_multiplier: number
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

      const { data: rawAction, error: aError } = await supabase
        .from('actions')
        .select('id, name, code, points, is_active, max_completions, time_enabled, start_at, end_at, speed_bonus_enabled, speed_bonus_minutes, speed_bonus_flat_points, speed_multiplier')
        .eq('event_id', eventId)
        .eq('code', aCode)
        .maybeSingle()

      if (aError) throw aError
      if (!rawAction) {
        setLastError(`משימה "${aCode}" לא נמצאה.`)
        setSubmitting(false)
        return null
      }

      const action = rawAction as TimedAction

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
          time_enabled: action.time_enabled,
          start_at: action.start_at,
          end_at: action.end_at,
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

      // Speed bonus calculation
      let finalPoints = action.points
      let speedBonusApplied = false
      let speedBonusLabel = ''

      if (action.speed_bonus_enabled && action.start_at && action.speed_bonus_minutes) {
        const now = new Date()
        const speedBonusUntil = new Date(
          new Date(action.start_at).getTime() + action.speed_bonus_minutes * 60_000,
        )
        if (now <= speedBonusUntil) {
          if (action.speed_bonus_flat_points != null) {
            finalPoints = action.points + action.speed_bonus_flat_points
            speedBonusLabel = `+${action.speed_bonus_flat_points}`
          } else {
            finalPoints = Math.round(action.points * Number(action.speed_multiplier))
            speedBonusLabel = `×${action.speed_multiplier}`
          }
          speedBonusApplied = true
        }
      }

      const { error: insertError } = await supabase
        .from('point_transactions')
        .insert({
          event_id: eventId,
          participant_id: participant.id,
          action_id: action.id,
          points: finalPoints,
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
        points: finalPoints,
        basePoints: action.points,
        speedBonusApplied,
        speedBonusLabel,
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
