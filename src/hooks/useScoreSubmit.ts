import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { NewlyAwardedReward } from '@/types'

export interface ScoreSubmitResult {
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
        setLastError(`משתתף "${pCode}" לא נמצא.`)
        setSubmitting(false)
        return null
      }

      const { data: action, error: aError } = await supabase
        .from('actions')
        .select('id, name, code, points, is_active')
        .eq('event_id', eventId)
        .eq('code', aCode)
        .maybeSingle()

      if (aError) throw aError
      if (!action) {
        setLastError(`משימה "${aCode}" לא נמצאה.`)
        setSubmitting(false)
        return null
      }

      if (!action.is_active) {
        setLastError(`משימה "${action.code}" אינה פעילה.`)
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
