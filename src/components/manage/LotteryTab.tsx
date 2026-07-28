import { useMemo, useState } from 'react'
import { ChevronDown, PartyPopper, Search, Users } from 'lucide-react'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Input } from '@/components/ui/Input'
import { useEventLotteryDraws, type LotteryDraw } from '@/hooks/useEventLotteryDraws'
import { ELIGIBILITY_LABELS } from '@/components/live-events/lottery/lotteryMode'
import { formatTimeOfDay, getIsraelHour, getIsraelLocalDateString, getIsraelMinute } from '@/lib/israelTime'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface LotteryTabProps {
  eventId: string
}

interface DrawDay {
  dayKey: string
  label: string
  draws: LotteryDraw[]
}

/** "היום" for the current Israel day, otherwise "12.7". */
function dayLabel(dayKey: string, todayKey: string): string {
  if (dayKey === todayKey) return 'היום'
  const [, month, day] = dayKey.split('-')
  return `${Number(day)}.${Number(month)}`
}

function groupByDay(draws: LotteryDraw[], todayKey: string): DrawDay[] {
  const days: DrawDay[] = []
  for (const draw of draws) {
    const dayKey = getIsraelLocalDateString(new Date(draw.drawnAt))
    const last = days[days.length - 1]
    if (last?.dayKey === dayKey) last.draws.push(draw)
    else days.push({ dayKey, label: dayLabel(dayKey, todayKey), draws: [draw] })
  }
  return days
}

function matches(draw: LotteryDraw, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    draw.winnerName.toLowerCase().includes(q) ||
    draw.prizeName.toLowerCase().includes(q) ||
    // Searching a name should find the lotteries somebody was *in*, not only
    // the ones they won - that is most of what "did they get a chance" means.
    draw.entrants.some((e) => e.name.toLowerCase().includes(q))
  )
}

/** How the pool was chosen, in one phrase. */
function poolSummary(draw: LotteryDraw): string {
  if (draw.poolLabel?.trim()) return draw.poolLabel.trim()
  if (draw.eligibilityMode === 'min_points' && draw.minPoints != null) {
    return `מעל ${draw.minPoints.toLocaleString('he-IL')} נקודות`
  }
  return ELIGIBILITY_LABELS[draw.eligibilityMode] ?? draw.eligibilityMode
}

/**
 * The lottery log: what was given away, how the pool was chosen, who was in
 * the running and who won - newest first, in the same plain table as the scans
 * and rewards tabs.
 *
 * The entrants are the reason this exists rather than a winners list, so each
 * row opens onto them. They are collapsed by default because a hundred names
 * between two draws would bury the thing the manager scans for.
 */
export function LotteryTab({ eventId }: LotteryTabProps) {
  const { draws, loading, error } = useEventLotteryDraws(eventId)
  const [query, setQuery] = useState('')
  const [openDrawId, setOpenDrawId] = useState<string | null>(null)

  const todayKey = useMemo(() => getIsraelLocalDateString(new Date()), [])
  const visible = useMemo(() => draws.filter((draw) => matches(draw, query)), [draws, query])
  const days = useMemo(() => groupByDay(visible, todayKey), [visible, todayKey])

  if (loading) return <CenteredLoader />

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}

      {draws.length === 0 ? (
        <EmptyState
          icon={<PartyPopper size={28} aria-hidden="true" />}
          title="עדיין לא בוצעו הגרלות"
          description="הגרלה תופיע כאן ברגע שתוכרז בה זוכה."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={cn('text-sm tabular-nums', theme.textMuted)}>
              {draws.length === 1 ? 'הגרלה אחת' : `${draws.length} הגרלות`}
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
                placeholder="חיפוש פרס, זוכה או משתתף"
                aria-label="חיפוש פרס, זוכה או משתתף"
                className="pr-9"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<Search size={28} aria-hidden="true" />}
              title="לא נמצאו תוצאות"
              description="נסו לחפש בשם פרס, בשם זוכה או בשם משתתף."
              compact
            />
          ) : (
            <div className={cn('overflow-x-auto rounded-xl border shadow-sm', theme.border)}>
              <table className="w-full min-w-[34rem] table-fixed border-collapse text-sm">
                <thead>
                  <tr
                    className={cn(
                      'border-b text-[11px] font-semibold tracking-wide',
                      theme.border,
                      theme.bgCardMuted,
                      theme.textSubtle,
                    )}
                  >
                    <th scope="col" className="w-[26%] px-4 py-2.5 text-start font-semibold">
                      פרס
                    </th>
                    <th scope="col" className="w-[24%] px-2 py-2.5 text-start font-semibold">
                      זוכה
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-start font-semibold">
                      מי השתתף
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
                        className={cn(
                          'px-4 py-1.5 text-start text-[11px] font-semibold tracking-wide',
                          theme.textSubtle,
                        )}
                      >
                        {day.label}
                      </th>
                    </tr>

                    {day.draws.map((draw) => {
                      const open = openDrawId === draw.id
                      return (
                        <DrawRows
                          key={draw.id}
                          draw={draw}
                          open={open}
                          onToggle={() => setOpenDrawId(open ? null : draw.id)}
                        />
                      )
                    })}
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

/** One draw, plus its entrants when opened. */
function DrawRows({
  draw,
  open,
  onToggle,
}: {
  draw: LotteryDraw
  open: boolean
  onToggle: () => void
}) {
  const drawnAt = new Date(draw.drawnAt)

  return (
    <>
      <tr className={cn('border-b', theme.border, theme.hoverSurface)}>
        <td className={cn('px-4 py-3', theme.text)}>
          <span className="flex items-center gap-1.5">
            {draw.prizeIcon && (
              <span aria-hidden="true" className="shrink-0">
                {draw.prizeIcon}
              </span>
            )}
            <span className="truncate text-[15px] font-medium">{draw.prizeName}</span>
            {/* A redraw is a second name for the same prize - worth marking,
                since two rows with one prize otherwise look like a mistake. */}
            {draw.drawIndex > 0 && (
              <span className={cn('shrink-0 text-[11px]', theme.textSubtle)}>
                · הגרלה {draw.drawIndex + 1}
              </span>
            )}
          </span>
        </td>

        <td className={cn('truncate px-2 py-3 font-medium', theme.text)}>{draw.winnerName}</td>

        <td className="px-2 py-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            disabled={draw.entrants.length === 0}
            className={cn(
              'flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-start',
              'transition-colors disabled:cursor-default',
              draw.entrants.length > 0 && theme.hoverSurface,
            )}
          >
            <Users size={14} aria-hidden="true" className={cn('shrink-0', theme.textSubtle)} />
            <span className={cn('tabular-nums', theme.textMuted)}>{draw.entrantCount}</span>
            <span className={cn('truncate text-[13px]', theme.textSubtle)}>
              {poolSummary(draw)}
            </span>
            {draw.entrants.length > 0 && (
              <ChevronDown
                size={13}
                aria-hidden="true"
                className={cn('shrink-0 transition-transform', theme.textSubtle, open && 'rotate-180')}
              />
            )}
          </button>
        </td>

        <td className={cn('px-4 py-3 text-end tabular-nums', theme.textSubtle)}>
          {formatTimeOfDay(getIsraelHour(drawnAt), getIsraelMinute(drawnAt))}
        </td>
      </tr>

      {open && (
        <tr className={cn('border-b', theme.border, theme.bgCardMuted)}>
          <td colSpan={4} className="px-4 py-3">
            <p className={cn('mb-2 text-[11px] font-semibold tracking-wide', theme.textSubtle)}>
              היו בהגרלה
            </p>
            <div className="flex flex-wrap gap-1.5">
              {draw.entrants.map((entrant) => (
                <span
                  key={`${entrant.participantId ?? ''}-${entrant.name}`}
                  className={cn(
                    'rounded-md px-2 py-1 text-[13px]',
                    theme.bgCard,
                    theme.textMuted,
                    entrant.name === draw.winnerName && 'font-semibold text-primary',
                  )}
                >
                  {entrant.name}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
