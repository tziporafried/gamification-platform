import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { EventForm } from '@/components/dashboard/EventForm'
import { EventSection } from '@/components/dashboard/EventSection'
import { DashboardHome } from '@/components/dashboard/DashboardHome'
import { ParticipantList } from '@/components/participants/ParticipantList'
import { GroupList } from '@/components/groups/GroupList'
import { ActionList } from '@/components/actions/ActionList'
import { RewardList } from '@/components/rewards/RewardList'
import { ScoreEntry } from '@/components/scoring/ScoreEntry'
import { LeaderboardSection } from '@/components/leaderboard/LeaderboardSection'
import { QrCardGenerator } from '@/components/qr-cards/QrCardGenerator'
import type { Event, DashboardTab } from '@/types'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DashboardTab>('home')

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

  const noop = useCallback(() => {}, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-game-dark">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  const userEmail = user?.email || ''
  const userName = userEmail.split('@')[0] || 'משתמש'

  if (!event) {
    return (
      <div className="min-h-screen bg-game-dark">
        <main className="mx-auto max-w-3xl px-4 py-8">
          <EventForm onSaved={(e) => setEvent(e)} />
        </main>
      </div>
    )
  }

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      eventName={event.name}
      eventLogoUrl={event.logo_url}
      userName={userName}
      userEmail={userEmail}
      onSignOut={signOut}
    >
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
        <ParticipantList eventId={event.id} onCountChange={noop} />
      )}
      {activeTab === 'groups' && (
        <GroupList eventId={event.id} onCountChange={noop} />
      )}
      {activeTab === 'actions' && (
        <ActionList eventId={event.id} onCountChange={noop} />
      )}
      {activeTab === 'rewards' && (
        <RewardList eventId={event.id} onCountChange={noop} />
      )}
      {activeTab === 'score' && (
        <ScoreEntry eventId={event.id} qrScoringMode={event.qr_scoring_mode} />
      )}
      {activeTab === 'qr-cards' && (
        <QrCardGenerator eventId={event.id} qrScoringMode={event.qr_scoring_mode} />
      )}
      {activeTab === 'leaderboard' && (
        <LeaderboardSection eventId={event.id} themeColor={event.theme_color} />
      )}
    </DashboardLayout>
  )
}
