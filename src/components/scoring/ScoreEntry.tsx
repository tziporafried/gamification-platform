import { useState, useEffect, useCallback, useRef, FormEvent } from 'react'
import { Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { PointsFlyUp } from '@/components/ui/PointsFlyUp'
import { Toast } from '@/components/ui/Toast'
import { TransactionRow } from './TransactionRow'
import { ParticipantPreview } from './ParticipantPreview'
import { CelebrationModal } from './CelebrationModal'
import { useScoreSubmit } from '@/hooks/useScoreSubmit'
import type { PointTransactionWithDetails, NewlyAwardedReward, Group } from '@/types'

interface ScoreEntryProps {
  eventId: string
}

interface ParticipantPreviewData {
  id: string
  name: string
  externalId: string
  totalPoints: number
  rank: number | null
  groups: Group[]
  nextReward: { name: string; required_points: number } | null
}

interface ActionPreviewData {
  id: string
  name: string
  code: string
  points: number
}

export function ScoreEntry({ eventId }: ScoreEntryProps) {
  const [participantCode, setParticipantCode] = useState('')
  const [actionCode, setActionCode] = useState('')
  const [transactions, setTransactions] = useState<PointTransactionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [celebrationRewards, setCelebrationRewards] = useState<NewlyAwardedReward[]>([])
  const [celebratingParticipantName, setCelebratingParticipantName] = useState('')
  const participantInputRef = useRef<HTMLInputElement>(null)

  const [participantPreview, setParticipantPreview] = useState<ParticipantPreviewData | null>(null)
  const [actionPreview, setActionPreview] = useState<ActionPreviewData | null>(null)
  const [participantLoading, setParticipantLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [flyUpPoints, setFlyUpPoints] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)

  const { submit, submitting, lastError } = useScoreSubmit(eventId)

  useEffect(() => {
    if (lastError) {
      setToast({ message: lastError, variant: 'error' })
    }
  }, [lastError])

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

  const participantDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const actionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (participantDebounceRef.current) clearTimeout(participantDebounceRef.current)

    const code = participantCode.trim()
    if (!code) {
      setParticipantPreview(null)
      return
    }

    participantDebounceRef.current = setTimeout(async () => {
      setParticipantLoading(true)
      try {
        const { data: participant } = await supabase
          .from('participants')
          .select('id, name, external_id, participant_groups(group_id, groups(*))')
          .eq('event_id', eventId)
          .eq('external_id', code)
          .maybeSingle()

        if (!participant) {
          setParticipantPreview(null)
          setParticipantLoading(false)
          return
        }

        const groups: Group[] = ((participant.participant_groups as unknown as { group_id: string; groups: Group }[]) ?? [])
          .map((pg) => pg.groups)

        const [pointsResult, leaderboardResult, rewardResult] = await Promise.all([
          supabase
            .from('point_transactions')
            .select('points')
            .eq('participant_id', participant.id),
          supabase.rpc('get_participant_leaderboard'),
          supabase
            .from('rewards')
            .select('name, required_points')
            .eq('event_id', eventId)
            .eq('is_active', true)
            .order('required_points', { ascending: true }),
        ])

        const totalPoints = (pointsResult.data ?? []).reduce((sum, t) => sum + t.points, 0)

        let rank: number | null = null
        if (leaderboardResult.data) {
          const sorted = leaderboardResult.data as { participant_id: string; total_points: number }[]
          const idx = sorted.findIndex((e) => e.participant_id === participant.id)
          if (idx >= 0) {
            let r = 1
            for (let i = 0; i < idx; i++) {
              if (sorted[i].total_points > sorted[idx].total_points) r = i + 2
            }
            rank = r
          }
        }

        let nextReward: { name: string; required_points: number } | null = null
        if (rewardResult.data) {
          const allRewards = rewardResult.data as { name: string; required_points: number }[]
          const unearnedAbove = allRewards.find((r) => r.required_points > totalPoints)
          if (unearnedAbove) {
            nextReward = unearnedAbove
          }
        }

        setParticipantPreview({
          id: participant.id,
          name: participant.name,
          externalId: participant.external_id,
          totalPoints,
          rank,
          groups,
          nextReward,
        })
      } catch {
        setParticipantPreview(null)
      }
      setParticipantLoading(false)
    }, 500)

    return () => {
      if (participantDebounceRef.current) clearTimeout(participantDebounceRef.current)
    }
  }, [participantCode, eventId])

  useEffect(() => {
    if (actionDebounceRef.current) clearTimeout(actionDebounceRef.current)

    const code = actionCode.trim()
    if (!code) {
      setActionPreview(null)
      return
    }

    actionDebounceRef.current = setTimeout(async () => {
      setActionLoading(true)
      try {
        const { data: action } = await supabase
          .from('actions')
          .select('id, name, code, points, is_active')
          .eq('event_id', eventId)
          .eq('code', code)
          .maybeSingle()

        if (action && action.is_active) {
          setActionPreview({
            id: action.id,
            name: action.name,
            code: action.code,
            points: action.points,
          })
        } else {
          setActionPreview(null)
        }
      } catch {
        setActionPreview(null)
      }
      setActionLoading(false)
    }, 400)

    return () => {
      if (actionDebounceRef.current) clearTimeout(actionDebounceRef.current)
    }
  }, [actionCode, eventId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setToast(null)

    const result = await submit(participantCode, actionCode)
    if (!result) return

    if (result.celebrationRewards.length > 0) {
      setCelebratingParticipantName(result.participantName)
      setCelebrationRewards(result.celebrationRewards)
    }

    setFlyUpPoints(result.points)

    const sign = result.points >= 0 ? '+' : ''
    setToast({
      message: `${sign}${result.points} pts to ${result.participantName} for ${result.actionName}`,
      variant: 'success',
    })

    setParticipantCode('')
    setActionCode('')
    setParticipantPreview(null)
    setActionPreview(null)
    fetchTransactions()
    participantInputRef.current?.focus()
  }

  const bothValid = participantPreview && actionPreview
  const submitLabel = bothValid
    ? `AWARD ${actionPreview.points >= 0 ? '+' : ''}${actionPreview.points} PTS`
    : 'Award Points'

  return (
    <div className="-mx-4 -mt-6 md:-mt-8">
      <div className="bg-game-radial px-4 pt-6 pb-6 md:pt-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
              <Zap size={22} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Award Points</h2>
              <p className="text-xs text-gray-400">Power up your players</p>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-game-border bg-game-card overflow-hidden">
            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">Player</label>
                  <input
                    ref={participantInputRef}
                    id="participant-code"
                    placeholder="P-1001"
                    value={participantCode}
                    onChange={(e) => setParticipantCode(e.target.value)}
                    autoFocus
                    className="w-full rounded-xl border border-game-border bg-game-dark px-4 py-3 text-sm font-medium text-white placeholder-gray-500 transition-all focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  {participantLoading && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                      Looking up...
                    </div>
                  )}
                  {participantPreview && !participantLoading && (
                    <ParticipantPreview
                      name={participantPreview.name}
                      externalId={participantPreview.externalId}
                      totalPoints={participantPreview.totalPoints}
                      rank={participantPreview.rank}
                      groups={participantPreview.groups}
                      nextReward={participantPreview.nextReward}
                    />
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">Action</label>
                  <input
                    id="action-code"
                    placeholder="A-1001"
                    value={actionCode}
                    onChange={(e) => setActionCode(e.target.value)}
                    className="w-full rounded-xl border border-game-border bg-game-dark px-4 py-3 text-sm font-medium text-white placeholder-gray-500 transition-all focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  {actionLoading && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                      Looking up...
                    </div>
                  )}
                  {actionPreview && !actionLoading && (
                    <div className="mt-2 animate-slide-up rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-emerald-400" />
                          <span className="text-sm font-medium text-gray-200">{actionPreview.name}</span>
                        </div>
                        <span className={`text-sm font-bold ${actionPreview.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {actionPreview.points >= 0 ? '+' : ''}{actionPreview.points} pts
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <Button
                  type="submit"
                  variant="gradient"
                  size="lg"
                  loading={submitting}
                  className={bothValid ? 'w-full animate-glow-pulse font-bold tracking-wide' : 'w-full font-bold tracking-wide'}
                >
                  <Zap size={16} className="mr-1.5" />
                  {submitLabel}
                </Button>
                <PointsFlyUp points={flyUpPoints} onDone={() => setFlyUpPoints(null)} />
              </div>
            </form>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Activity</h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-2xl border border-game-border bg-game-card/50 px-6 py-12 text-center">
              <p className="text-sm text-gray-500">No transactions yet. Award points to see activity here.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {transactions.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          autoDismissMs={toast.variant === 'success' ? 3000 : undefined}
          onDismiss={() => setToast(null)}
        />
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
