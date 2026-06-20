import { useState, useEffect, useCallback } from 'react'
import { Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSound } from '@/hooks/useSound'
import { LeaderboardToggle, type LeaderboardView } from './LeaderboardToggle'
import { SoundToggle } from './SoundToggle'
import { LeaderboardPodium } from './LeaderboardPodium'
import { LeaderboardTable } from './LeaderboardTable'
import { LeaderboardEmptyState } from './LeaderboardEmptyState'
import type { ParticipantLeaderboardEntry, GroupLeaderboardEntry } from '@/types'

interface LeaderboardSectionProps {
  eventId: string
  themeColor: string
}

function computeRanks<T extends { total_points: number }>(
  entries: T[],
): (T & { rank: number })[] {
  let currentRank = 1
  return entries.map((entry, index) => {
    if (index > 0 && entry.total_points < entries[index - 1].total_points) {
      currentRank = index + 1
    }
    return { ...entry, rank: currentRank }
  })
}

export function LeaderboardSection({ eventId: _eventId, themeColor }: LeaderboardSectionProps) {
  const [activeView, setActiveView] = useState<LeaderboardView>('participants')
  const [participantData, setParticipantData] = useState<ParticipantLeaderboardEntry[]>([])
  const [groupData, setGroupData] = useState<GroupLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { play, muted, toggleMute } = useSound()

  const fetchLeaderboards = useCallback(async () => {
    setError('')
    setLoading(true)

    const [participantResult, groupResult] = await Promise.all([
      supabase.rpc('get_participant_leaderboard'),
      supabase.rpc('get_group_leaderboard'),
    ])

    if (participantResult.error || groupResult.error) {
      setError('Leaderboard is being set up. Please try again shortly.')
      setLoading(false)
      return
    }

    setParticipantData(
      (participantResult.data ?? []) as ParticipantLeaderboardEntry[],
    )
    setGroupData(
      (groupResult.data ?? []) as GroupLeaderboardEntry[],
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLeaderboards()
  }, [fetchLeaderboards])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  const rankedParticipants = computeRanks(participantData)
  const rankedGroups = computeRanks(groupData)

  const currentEntries =
    activeView === 'participants' ? rankedParticipants : rankedGroups
  const isEmpty = currentEntries.length === 0

  const podiumEntries = currentEntries
    .filter((e) => e.rank <= 3)
    .map((e) => ({
      rank: e.rank as 1 | 2 | 3,
      name:
        activeView === 'participants'
          ? (e as (typeof rankedParticipants)[number]).participant_name
          : (e as (typeof rankedGroups)[number]).group_name,
      detail:
        activeView === 'participants'
          ? (e as (typeof rankedParticipants)[number]).external_id
          : undefined,
      color:
        activeView === 'groups'
          ? (e as (typeof rankedGroups)[number]).group_color
          : undefined,
      total_points: e.total_points,
    }))

  const tableEntries = currentEntries
    .filter((e) => e.rank > 3)
    .map((e) => ({
      rank: e.rank,
      name:
        activeView === 'participants'
          ? (e as (typeof rankedParticipants)[number]).participant_name
          : (e as (typeof rankedGroups)[number]).group_name,
      detail:
        activeView === 'participants'
          ? (e as (typeof rankedParticipants)[number]).external_id
          : undefined,
      color:
        activeView === 'groups'
          ? (e as (typeof rankedGroups)[number]).group_color
          : undefined,
      total_points: e.total_points,
    }))

  const emptyMessage =
    activeView === 'groups'
      ? 'No groups yet. Create groups in the Groups tab to see the group leaderboard.'
      : undefined

  function handleSoundToggle() {
    toggleMute()
    if (muted) play()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: themeColor + '14' }}
          >
            <Trophy size={18} style={{ color: themeColor }} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Leaderboard</h2>
        </div>
        <div className="flex items-center gap-2">
          <SoundToggle
            muted={muted}
            onToggle={handleSoundToggle}
            themeColor={themeColor}
          />
          <LeaderboardToggle
            activeView={activeView}
            onViewChange={setActiveView}
            themeColor={themeColor}
          />
        </div>
      </div>

      {isEmpty ? (
        <LeaderboardEmptyState
          themeColor={themeColor}
          message={emptyMessage}
        />
      ) : (
        <>
          <LeaderboardPodium entries={podiumEntries} themeColor={themeColor} />
          <LeaderboardTable entries={tableEntries} themeColor={themeColor} />
        </>
      )}
    </div>
  )
}
