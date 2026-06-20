import { useState, useEffect, useCallback, useRef, FormEvent } from 'react'
import { Target } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { TransactionRow } from './TransactionRow'
import { CelebrationModal } from './CelebrationModal'
import type { PointTransactionWithDetails, NewlyAwardedReward } from '@/types'

interface ScoreEntryProps {
  eventId: string
}

export function ScoreEntry({ eventId }: ScoreEntryProps) {
  const { user } = useAuth()
  const [participantCode, setParticipantCode] = useState('')
  const [actionCode, setActionCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [transactions, setTransactions] = useState<PointTransactionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [celebrationRewards, setCelebrationRewards] = useState<NewlyAwardedReward[]>([])
  const [celebratingParticipantName, setCelebratingParticipantName] = useState('')
  const participantInputRef = useRef<HTMLInputElement>(null)

  const fetchTransactions = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('point_transactions')
      .select('*, participant:participants(name, external_id), action:actions(name, code)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (fetchError) {
      return
    }

    setTransactions((data ?? []) as unknown as PointTransactionWithDetails[])
    setLoading(false)
  }, [eventId])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!participantCode.trim()) {
      setError('Participant code is required.')
      return
    }
    if (!actionCode.trim()) {
      setError('Action code is required.')
      return
    }

    setSubmitting(true)

    try {
      const { data: participant, error: pError } = await supabase
        .from('participants')
        .select('id, name')
        .eq('event_id', eventId)
        .eq('external_id', participantCode.trim())
        .maybeSingle()

      if (pError) throw pError
      if (!participant) {
        setError(`Participant "${participantCode.trim()}" not found.`)
        setSubmitting(false)
        return
      }

      const { data: action, error: aError } = await supabase
        .from('actions')
        .select('id, name, code, points, is_active')
        .eq('event_id', eventId)
        .eq('code', actionCode.trim())
        .maybeSingle()

      if (aError) throw aError
      if (!action) {
        setError(`Action "${actionCode.trim()}" not found.`)
        setSubmitting(false)
        return
      }

      if (!action.is_active) {
        setError(`Action "${action.code}" is inactive.`)
        setSubmitting(false)
        return
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

      try {
        console.log('[Rewards Debug] Checking rewards for participant:', participant.id, participant.name)
        const { data: newRewards, error: rewardError } = await supabase
          .rpc('check_and_award_rewards', { p_participant_id: participant.id })

        console.log('[Rewards Debug] RPC response:', { data: newRewards, error: rewardError })

        if (rewardError) {
          console.warn('[Rewards Debug] RPC error:', rewardError.message, rewardError)
        } else if (newRewards && newRewards.length > 0) {
          console.log('[Rewards Debug] New rewards to celebrate:', newRewards)
          setCelebratingParticipantName(participant.name)
          setCelebrationRewards(newRewards as NewlyAwardedReward[])
        } else {
          console.log('[Rewards Debug] No new rewards. Data:', newRewards)
        }
      } catch (rewardErr) {
        console.warn('[Rewards Debug] Caught exception:', rewardErr)
      }

      const sign = action.points >= 0 ? '+' : ''
      setSuccess(`Awarded ${sign}${action.points} points to ${participant.name} for ${action.name}`)
      setParticipantCode('')
      setActionCode('')
      fetchTransactions()
      participantInputRef.current?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
          <Target size={18} className="text-brand-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Score Entry</h2>
      </div>

      <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-card">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            ref={participantInputRef}
            id="participant-code"
            label="Participant Code"
            placeholder="e.g. P-1001"
            value={participantCode}
            onChange={(e) => setParticipantCode(e.target.value)}
            autoFocus
          />
          <Input
            id="action-code"
            label="Action Code"
            placeholder="e.g. A-1001"
            value={actionCode}
            onChange={(e) => setActionCode(e.target.value)}
          />
        </div>

        <Button type="submit" loading={submitting}>
          Submit Score
        </Button>
      </form>

      <h3 className="mb-3 text-sm font-semibold text-gray-900">Recent Transactions</h3>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description="Submit scores above to create point transactions."
        />
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))}
        </div>
      )}

      {celebrationRewards.length > 0 && (
        <CelebrationModal
          rewards={celebrationRewards}
          participantName={celebratingParticipantName}
          onComplete={() => setCelebrationRewards([])}
        />
      )}
    </div>
  )
}
