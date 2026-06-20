import { useState, useEffect, useCallback } from 'react'
import { Users, Zap, Trophy, ChevronRight, ClipboardList } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { StatCard } from '@/components/ui/StatCard'
import { Button } from '@/components/ui/Button'
import { TransactionRow } from '@/components/scoring/TransactionRow'
import { HomeLeaderboard } from './HomeLeaderboard'
import { QuickScoreCard } from './QuickScoreCard'
import { RecentRewards } from './RecentRewards'
import type { DashboardTab, PointTransactionWithDetails, ParticipantLeaderboardEntry, Group } from '@/types'

interface DashboardHomeProps {
  eventId: string
  themeColor: string
  onTabChange: (tab: DashboardTab) => void
}

interface RankedLeaderboardEntry extends ParticipantLeaderboardEntry {
  rank: number
  groups: Group[]
}

interface RecentRewardEntry {
  id: string
  participantName: string
  rewardName: string
  awardedAt: string
}

function computeRanks(entries: ParticipantLeaderboardEntry[]): (ParticipantLeaderboardEntry & { rank: number })[] {
  let currentRank = 1
  return entries.map((entry, index) => {
    if (index > 0 && entry.total_points < entries[index - 1].total_points) {
      currentRank = index + 1
    }
    return { ...entry, rank: currentRank }
  })
}

export function DashboardHome({ eventId, themeColor, onTabChange }: DashboardHomeProps) {
  const [participantCount, setParticipantCount] = useState(0)
  const [totalPoints, setTotalPoints] = useState(0)
  const [rewardsUnlocked, setRewardsUnlocked] = useState(0)
  const [leaderboard, setLeaderboard] = useState<RankedLeaderboardEntry[]>([])
  const [recentTransactions, setRecentTransactions] = useState<PointTransactionWithDetails[]>([])
  const [recentRewards, setRecentRewards] = useState<RecentRewardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHomeData = useCallback(async () => {
    setLoading(true)

    const [
      participantCountResult,
      pointsResult,
      rewardsCountResult,
      leaderboardResult,
      transactionsResult,
      recentRewardsResult,
    ] = await Promise.all([
      supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId),
      supabase
        .from('point_transactions')
        .select('points')
        .eq('event_id', eventId),
      supabase
        .from('participant_rewards')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId),
      supabase.rpc('get_participant_leaderboard'),
      supabase
        .from('point_transactions')
        .select('*, participant:participants(name, external_id), action:actions(name, code)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('participant_rewards')
        .select('id, awarded_at, participant:participants(name), reward:rewards(name)')
        .eq('event_id', eventId)
        .order('awarded_at', { ascending: false })
        .limit(5),
    ])

    setParticipantCount(participantCountResult.count ?? 0)
    setTotalPoints((pointsResult.data ?? []).reduce((sum, t) => sum + t.points, 0))
    setRewardsUnlocked(rewardsCountResult.count ?? 0)
    setRecentTransactions((transactionsResult.data ?? []) as unknown as PointTransactionWithDetails[])

    const rewardEntries: RecentRewardEntry[] = (recentRewardsResult.data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      participantName: (r.participant as { name: string } | null)?.name ?? 'Unknown',
      rewardName: (r.reward as { name: string } | null)?.name ?? 'Unknown',
      awardedAt: r.awarded_at as string,
    }))
    setRecentRewards(rewardEntries)

    // Leaderboard: slice top 10, then fetch group associations
    const allEntries = (leaderboardResult.data ?? []) as ParticipantLeaderboardEntry[]
    const ranked = computeRanks(allEntries)
    const top10 = ranked.slice(0, 10)

    if (top10.length > 0) {
      const ids = top10.map((e) => e.participant_id)
      const { data: groupData } = await supabase
        .from('participant_groups')
        .select('participant_id, groups(id, name, color)')
        .in('participant_id', ids)

      const groupMap = new Map<string, Group[]>()
      if (groupData) {
        for (const pg of groupData) {
          const pid = pg.participant_id
          const group = pg.groups as unknown as Group
          if (!group) continue
          const existing = groupMap.get(pid) ?? []
          existing.push(group)
          groupMap.set(pid, existing)
        }
      }

      setLeaderboard(top10.map((e) => ({
        ...e,
        groups: groupMap.get(e.participant_id) ?? [],
      })))
    } else {
      setLeaderboard([])
    }

    setLoading(false)
  }, [eventId])

  useEffect(() => { fetchHomeData() }, [fetchHomeData])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ① Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Users size={20} />}
          label="Participants"
          value={participantCount}
          iconColor={themeColor}
        />
        <StatCard
          icon={<Zap size={20} />}
          label="Total Points"
          value={totalPoints}
          iconColor="#059669"
        />
        <StatCard
          icon={<Trophy size={20} />}
          label="Rewards Unlocked"
          value={rewardsUnlocked}
          iconColor="#d97706"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* ② Top 10 Leaderboard */}
      <HomeLeaderboard
        entries={leaderboard}
        themeColor={themeColor}
        onViewFull={() => onTabChange('leaderboard')}
      />

      {/* ③ Quick Score */}
      <QuickScoreCard eventId={eventId} onScoreSubmitted={fetchHomeData} />

      {/* ④ Recent Activity */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
              <ClipboardList size={18} className="text-brand-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Recent Activity</h3>
          </div>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-500">No activity yet. Submit scores to see them here.</p>
          </div>
        ) : (
          <>
            <div className="p-3 space-y-2">
              {recentTransactions.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}
            </div>
            <div className="border-t border-gray-100 px-5 py-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTabChange('score')}
                className="w-full justify-center gap-1 text-brand-600 hover:text-brand-700 hover:bg-brand-50"
              >
                View All Transactions
                <ChevronRight size={14} />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ⑤ Recently Unlocked Rewards */}
      <RecentRewards entries={recentRewards} />
    </div>
  )
}
