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
      setError('טבלת הדירוג בהכנה. אנא נסו שוב בקרוב.')
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-3 text-sm text-red-300">
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
      ? 'אין קבוצות עדיין. צרו קבוצות בלשונית קבוצות כדי לראות את דירוג הקבוצות.'
      : undefined

  function handleSoundToggle() {
    toggleMute()
    if (muted) play()
  }

  return (
    <div className="-mx-4 -mt-6 md:-mt-8">
      <div className="bg-game-radial px-4 pt-6 pb-2 md:pt-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                <Trophy size={22} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">זירה</h2>
                <p className="text-xs text-gray-400">דירוגים חיים</p>
              </div>
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
            <div className="pb-6">
              <LeaderboardEmptyState themeColor={themeColor} message={emptyMessage} />
            </div>
          ) : (
            <LeaderboardPodium entries={podiumEntries} themeColor={themeColor} />
          )}
        </div>
      </div>

      {!isEmpty && tableEntries.length > 0 && (
        <div className="bg-game px-4 pb-6 pt-4">
          <div className="mx-auto max-w-5xl">
            <LeaderboardTable entries={tableEntries} themeColor={themeColor} />
          </div>
        </div>
      )}

      {!isEmpty && tableEntries.length === 0 && (
        <div className="h-4 bg-game" />
      )}
    </div>
  )
}
