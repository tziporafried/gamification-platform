import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { EventForm } from '@/components/dashboard/EventForm'
import { EventSection } from '@/components/dashboard/EventSection'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { ParticipantList } from '@/components/participants/ParticipantList'
import { GroupList } from '@/components/groups/GroupList'
import { ActionList } from '@/components/actions/ActionList'
import { ScoreEntry } from '@/components/scoring/ScoreEntry'
import { LeaderboardSection } from '@/components/leaderboard/LeaderboardSection'
import type { Event, DashboardTab } from '@/types'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DashboardTab>('event')
  const [participantCount, setParticipantCount] = useState(0)
  const [groupCount, setGroupCount] = useState(0)
  const [actionCount, setActionCount] = useState(0)

  useEffect(() => {
    async function fetchEvent() {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('owner_admin_id', user!.id)
        .maybeSingle()

      setEvent(data)
      setLoading(false)
    }
    fetchEvent()
  }, [user])

  const handleParticipantCount = useCallback((count: number) => {
    setParticipantCount(count)
  }, [])

  const handleGroupCount = useCallback((count: number) => {
    setGroupCount(count)
  }, [])

  const handleActionCount = useCallback((count: number) => {
    setActionCount(count)
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Log Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {!event ? (
          <EventForm onSaved={(e) => setEvent(e)} />
        ) : (
          <>
            <DashboardTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              participantCount={participantCount}
              groupCount={groupCount}
              actionCount={actionCount}
            />

            {activeTab === 'event' && (
              <EventSection event={event} onEventUpdated={setEvent} />
            )}
            {activeTab === 'participants' && (
              <ParticipantList eventId={event.id} onCountChange={handleParticipantCount} />
            )}
            {activeTab === 'groups' && (
              <GroupList eventId={event.id} onCountChange={handleGroupCount} />
            )}
            {activeTab === 'actions' && (
              <ActionList eventId={event.id} onCountChange={handleActionCount} />
            )}
            {activeTab === 'score' && (
              <ScoreEntry eventId={event.id} />
            )}
            {activeTab === 'leaderboard' && (
              <LeaderboardSection eventId={event.id} themeColor={event.theme_color} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
