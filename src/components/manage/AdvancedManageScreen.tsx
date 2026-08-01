import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Gift, PartyPopper, ScanLine, Users } from 'lucide-react'
import { PageTitle } from '@/components/ui/PageTitle'
import { Tabs } from '@/components/ui/Tabs'
import { ParticipantsTab } from '@/components/manage/ParticipantsTab'
import { ScansTab } from '@/components/manage/ScansTab'
import { RewardsTab } from '@/components/manage/RewardsTab'
import { LotteryTab } from '@/components/manage/LotteryTab'
import { advancedManagePath } from '@/lib/manage/advancedManagementFlag'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import type { Event } from '@/types'

/**
 * The full management screen, on a page of its own.
 *
 * The popup over the control center stays what it always was: a look at the
 * running game without leaving the screen you were on. This is the other half
 * - the place you go when the game is over and the question is the data. It
 * has a URL, so it can be bookmarked and sent; its tab is in that URL, so a
 * link can point at the scan log rather than at "wherever you left off".
 *
 * Three of the four tabs are the popup's own components, unchanged. The fourth
 * is the one the popup never had.
 */

const TABS = [
  { id: 'participants', label: 'משתתפים', icon: <Users size={15} aria-hidden="true" /> },
  { id: 'scans', label: 'סריקות', icon: <ScanLine size={15} aria-hidden="true" /> },
  { id: 'rewards', label: 'פרסים', icon: <Gift size={15} aria-hidden="true" /> },
  { id: 'lottery', label: 'הגרלות', icon: <PartyPopper size={15} aria-hidden="true" /> },
]

const TAB_IDS = TABS.map((tab) => tab.id)

interface AdvancedManageScreenProps {
  event: Event
}

export function AdvancedManageScreen({ event }: AdvancedManageScreenProps) {
  const { tab } = useParams<{ tab?: string }>()
  const navigate = useNavigate()
  // A name handed over from the participants table, so the scan log opens on
  // that person. Cleared as soon as the tab is left, or it would come back.
  const [scansQuery, setScansQuery] = useState('')

  // An unknown tab in the URL is a typo or an old link, not an error page.
  const activeTab = tab && TAB_IDS.includes(tab) ? tab : TABS[0].id

  const goToTab = useCallback(
    (id: string) => {
      // Cleared even when the scan log is the tab being clicked: asking for it
      // from the tab bar means the whole log, not whoever was looked at before.
      setScansQuery('')
      // replace: the tabs are one screen, not four steps to walk back through.
      navigate(advancedManagePath(event.id, id), { replace: true })
    },
    [event.id, navigate],
  )

  const showScansFor = useCallback(
    (participantName: string) => {
      setScansQuery(participantName)
      navigate(advancedManagePath(event.id, 'scans'), { replace: true })
    },
    [event.id, navigate],
  )

  return (
    <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 pt-4">
      <Link
        to={`/events/${event.id}/control`}
        className={cn(
          'mb-3 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium',
          'transition-colors',
          theme.textMuted,
          theme.hoverText,
          theme.focusRing,
        )}
      >
        <ArrowRight size={14} aria-hidden="true" />
        חזרה למשחק
      </Link>

      <PageTitle title={`ניהול · ${event.name}`} subtitle="כל נתוני המשתתפים של המשחק, לצפייה ולייצוא" />

      <Tabs
        tabs={TABS}
        activeTab={activeTab}
        onChange={goToTab}
        variant="underline"
        className="mt-5 mb-5"
      />

      {activeTab === 'participants' && (
        <ParticipantsTab eventId={event.id} eventName={event.name} onShowScans={showScansFor} />
      )}
      {activeTab === 'scans' && <ScansTab eventId={event.id} initialQuery={scansQuery} />}
      {activeTab === 'rewards' && <RewardsTab eventId={event.id} />}
      {activeTab === 'lottery' && <LotteryTab eventId={event.id} />}
    </main>
  )
}
