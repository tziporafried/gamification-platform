import { useState, useEffect, useCallback } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { EventForm } from '@/components/dashboard/EventForm'
import { EventSection } from '@/components/dashboard/EventSection'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { DashboardHome } from '@/components/dashboard/DashboardHome'
import { ParticipantList } from '@/components/participants/ParticipantList'
import { GroupList } from '@/components/groups/GroupList'
import { ActionList } from '@/components/actions/ActionList'
import { RewardList } from '@/components/rewards/RewardList'
import { ScoreEntry } from '@/components/scoring/ScoreEntry'
import { LeaderboardSection } from '@/components/leaderboard/LeaderboardSection'
import type { Event, DashboardTab } from '@/types'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DashboardTab>('home')
  const [participantCount, setParticipantCount] = useState(0)
  const [groupCount, setGroupCount] = useState(0)
  const [actionCount, setActionCount] = useState(0)
  const [rewardCount, setRewardCount] = useState(0)

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

  const handleRewardCount = useCallback((count: number) => {
    setRewardCount(count)
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  const userEmail = user?.email || ''
  const userName = userEmail.split('@')[0] || 'User'

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {event?.logo_url ? (
              <img src={event.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand text-sm font-bold text-white">
                G
              </div>
            )}
            <h1 className="text-lg font-bold text-gray-900">
              {event?.name || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <AvatarCircle name={userName} size="sm" />
              <span className="text-sm text-gray-500">{userEmail}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
              <LogOut size={14} />
              <span className="hidden sm:inline">Log Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
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
              rewardCount={rewardCount}
            />

            {activeTab === 'home' && (
              <DashboardHome
                eventId={event.id}
                themeColor={event.theme_color}
                onTabChange={setActiveTab}
              />
            )}
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
            {activeTab === 'rewards' && (
              <RewardList eventId={event.id} onCountChange={handleRewardCount} />
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
