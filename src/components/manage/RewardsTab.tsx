import { useMemo, useState } from 'react'
import { Gift, Search } from 'lucide-react'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Input } from '@/components/ui/Input'
import { useEventAwards, type EventAward } from '@/hooks/useEventAwards'
import { formatTimeOfDay, getIsraelHour, getIsraelLocalDateString, getIsraelMinute } from '@/lib/israelTime'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface RewardsTabProps {
  eventId: string
}

interface AwardDay {
  dayKey: string
  label: string
  awards: EventAward[]
}

/** "היום" for the current Israel day, otherwise "12.7". */
function dayLabel(dayKey: string, todayKey: string): string {
  if (dayKey === todayKey) return 'היום'
  const [, month, day] = dayKey.split('-')
  return `${Number(day)}.${Number(month)}`
}

/**
 * Awards newest first, split into days. The hook already sorts by time, so the
 * groups come out in order without a second sort.
 */
function groupByDay(awards: EventAward[], todayKey: string): AwardDay[] {
  const days: AwardDay[] = []
  for (const award of awards) {
    const dayKey = getIsraelLocalDateString(new Date(award.awardedAt))
    const last = days[days.length - 1]
    if (last?.dayKey === dayKey) last.awards.push(award)
    else days.push({ dayKey, label: dayLabel(dayKey, todayKey), awards: [award] })
  }
  return days
}

function matches(award: EventAward, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    award.participantName.toLowerCase().includes(q) || award.rewardName.toLowerCase().includes(q)
  )
}

/**
 * The award log: who won which prize and when, newest first - the list the
 * operator reads off when handing the prizes out. Same plain table as the scans
 * tab, with a day separator row where the log crosses midnight.
 */
export function RewardsTab({ eventId }: RewardsTabProps) {
  const { awards, loading, error } = useEventAwards(eventId)
  const [query, setQuery] = useState('')

  const todayKey = useMemo(() => getIsraelLocalDateString(new Date()), [])
  const visible = useMemo(() => awards.filter((award) => matches(award, query)), [awards, query])
  const days = useMemo(() => groupByDay(visible, todayKey), [visible, todayKey])
  const winners = useMemo(() => new Set(awards.map((a) => a.participantId)).size, [awards])

  if (loading) return <CenteredLoader />

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}

      {awards.length === 0 ? (
        <EmptyState
          icon={<Gift size={28} aria-hidden="true" />}
          title="עדיין לא חולקו פרסים"
          description="פרס יופיע כאן ברגע שמשתתף יעבור את סף הנקודות שנקבע לו."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={cn('text-sm tabular-nums', theme.textMuted)}>
              {awards.length === 1 ? 'פרס אחד' : `${awards.length} פרסים`} ·{' '}
              {winners === 1 ? 'זוכה אחד' : `${winners} זוכים`}
            </p>
            <div className="relative w-full sm:w-64">
              <Search
                size={15}
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש משתתף או פרס"
                aria-label="חיפוש משתתף או פרס"
                className="pr-9"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<Search size={28} aria-hidden="true" />}
              title="לא נמצאו תוצאות"
              description="נסו לחפש בשם משתתף אחר או בשם פרס."
              compact
            />
          ) : (
            <div className={cn('overflow-x-auto rounded-xl border shadow-sm', theme.border)}>
              <table className="w-full min-w-[26rem] table-fixed border-collapse text-sm">
                <thead>
                  <tr
                    className={cn(
                      'border-b text-[11px] font-semibold tracking-wide',
                      theme.border,
                      theme.bgCardMuted,
                      theme.textSubtle,
                    )}
                  >
                    <th scope="col" className="w-[30%] px-4 py-2.5 text-start font-semibold">
                      זוכה
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-start font-semibold">
                      פרס
                    </th>
                    <th scope="col" className="w-24 px-2 py-2.5 text-end font-semibold">
                      ניקוד בזכייה
                    </th>
                    <th scope="col" className="w-16 px-4 py-2.5 text-end font-semibold">
                      שעה
                    </th>
                  </tr>
                </thead>

                {days.map((day) => (
                  <tbody key={day.dayKey}>
                    <tr className={cn('border-b', theme.border, theme.bgCardMuted)}>
                      <th
                        scope="colgroup"
                        colSpan={4}
                        className={cn('px-4 py-1.5 text-start text-[11px] font-semibold tracking-wide', theme.textSubtle)}
                      >
                        {day.label}
                      </th>
                    </tr>

                    {day.awards.map((award) => (
                      <tr key={award.id} className={cn('border-b', theme.border, theme.hoverSurface)}>
                        <td className={cn('truncate px-4 py-3 text-[15px] font-medium', theme.text)}>
                          {award.participantName}
                        </td>
                        <td className={cn('truncate px-2 py-3', theme.textMuted)}>{award.rewardName}</td>
                        <td className={cn('px-2 py-3 text-end tabular-nums', theme.textMuted)}>
                          {award.scoreAtAward.toLocaleString('he-IL')}
                        </td>
                        <td className={cn('px-4 py-3 text-end tabular-nums', theme.textSubtle)}>
                          {formatTimeOfDay(
                            getIsraelHour(new Date(award.awardedAt)),
                            getIsraelMinute(new Date(award.awardedAt)),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
