import { useMemo, useState } from 'react'
import { ChevronDown, ScanLine, Search } from 'lucide-react'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { DeleteButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Input } from '@/components/ui/Input'
import { DeleteScanDialog } from '@/components/manage/DeleteScanDialog'
import { useEventScans, type EventScan, type ParticipantScans } from '@/hooks/useEventScans'
import { getIsraelLocalDateString } from '@/lib/israelTime'
import { formatMoment } from '@/lib/manage/participantsReport'
import { WRONG_ANSWER_LABEL } from '@/lib/tasks/triviaScan'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

interface ScansTabProps {
  eventId: string
  /**
   * Opens with the search already filled in - the participants table sends a
   * name here rather than growing its own copy of the scan log.
   */
  initialQuery?: string
}

function matches(entry: ParticipantScans, query: string): boolean {
  if (!query) return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    entry.name.toLowerCase().includes(q) ||
    entry.scans.some(
      (scan) =>
        scan.actionName.toLowerCase().includes(q) ||
        (scan.answerLabel ?? '').toLowerCase().includes(q),
    )
  )
}

/**
 * The scan log as a plain table, one row per participant, expandable into that
 * participant's scans - a single scan removable when it was recorded by mistake.
 *
 * Deliberately unstyled next to the rest of the app: this is the screen an
 * operator scans down a long list in, so it is hairlines and aligned numbers
 * rather than cards, and rows open instantly with no animation to sit through.
 *
 * Participants who have not scanned yet are listed too (last, greyed out) -
 * "who is missing" is the other question this screen gets asked.
 */
export function ScansTab({ eventId, initialQuery = '' }: ScansTabProps) {
  const { participants, loading, error, previewDelete, deleteScan } = useEventScans(eventId)
  const [query, setQuery] = useState(initialQuery)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<{ scan: EventScan; participantName: string } | null>(null)

  const todayKey = useMemo(() => getIsraelLocalDateString(new Date()), [])
  const visible = useMemo(
    () => participants.filter((entry) => matches(entry, query)),
    [participants, query],
  )

  const totals = useMemo(() => {
    let scans = 0
    let points = 0
    let played = 0
    for (const entry of participants) {
      scans += entry.scans.length
      points += entry.totalPoints
      if (entry.scans.length > 0) played += 1
    }
    return { scans, points, played }
  }, [participants])

  function toggle(participantId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(participantId)) next.delete(participantId)
      else next.add(participantId)
      return next
    })
  }

  if (loading) return <CenteredLoader />

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}

      {participants.length === 0 ? (
        <EmptyState
          icon={<ScanLine size={28} aria-hidden="true" />}
          title="אין עדיין משתתפים"
          description="הוסיפו משתתפים למשחק כדי לראות כאן את הסריקות שלהם."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={cn('text-sm tabular-nums', theme.textMuted)}>
              {totals.scans} סריקות · {totals.points.toLocaleString('he-IL')} נקודות ·{' '}
              {totals.played} משתתפים ששיחקו
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
                placeholder="חיפוש משתתף או משימה"
                aria-label="חיפוש משתתף או משימה"
                className="pr-9"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<Search size={28} aria-hidden="true" />}
              title="לא נמצאו תוצאות"
              description="נסו לחפש בשם משתתף אחר או בשם משימה."
              compact
            />
          ) : (
            <div className={cn('overflow-x-auto rounded-xl border shadow-sm', theme.border)}>
              <table className="w-full min-w-[28rem] border-collapse text-sm">
                <thead>
                  <tr
                    className={cn(
                      'border-b text-[11px] font-semibold tracking-wide',
                      theme.border,
                      theme.bgCardMuted,
                      theme.textSubtle,
                    )}
                  >
                    <th scope="col" className="w-9" aria-label="פתיחת שורה" />
                    <th scope="col" className="px-2 py-2.5 text-start font-semibold">
                      משתתף
                    </th>
                    <th scope="col" className="w-20 px-2 py-2.5 text-end font-semibold">
                      שעה
                    </th>
                    <th scope="col" className="w-20 px-2 py-2.5 text-end font-semibold">
                      סריקות
                    </th>
                    <th scope="col" className="w-24 px-4 py-2.5 text-end font-semibold">
                      נקודות
                    </th>
                  </tr>
                </thead>

                {visible.map((entry) => {
                  const isOpen = expanded.has(entry.participantId)
                  const hasScans = entry.scans.length > 0
                  return (
                    <tbody key={entry.participantId}>
                      <tr
                        onClick={() => hasScans && toggle(entry.participantId)}
                        className={cn(
                          'border-b',
                          theme.border,
                          hasScans ? cn('cursor-pointer', theme.hoverSurface) : undefined,
                          isOpen && theme.bgCardMuted,
                        )}
                      >
                        <td className="ps-2">
                          {hasScans && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggle(entry.participantId)
                              }}
                              aria-expanded={isOpen}
                              aria-label={`${isOpen ? 'סגירת' : 'פתיחת'} הסריקות של ${entry.name}`}
                              className={cn('rounded p-1', theme.textSubtle, theme.focusRing)}
                            >
                              <ChevronDown
                                size={14}
                                aria-hidden="true"
                                className={cn('transition-transform duration-150', isOpen && 'rotate-180')}
                              />
                            </button>
                          )}
                        </td>
                        <td
                          className={cn(
                            'truncate px-2 py-3 text-[15px]',
                            hasScans ? cn('font-medium', theme.text) : theme.textSubtle,
                          )}
                        >
                          {entry.name}
                        </td>
                        <td />
                        <td className={cn('px-2 py-3 text-end tabular-nums', theme.textMuted)}>
                          {hasScans ? entry.scans.length : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-end text-[15px] font-bold tabular-nums',
                            hasScans ? theme.text : theme.textSubtle,
                          )}
                        >
                          {entry.totalPoints.toLocaleString('he-IL')}
                        </td>
                      </tr>

                      {isOpen &&
                        entry.scans.map((scan) => (
                          <tr
                            key={scan.id}
                            className={cn('border-b text-[13px]', theme.border)}
                          >
                            <td />
                            <td className={cn('truncate py-2 pe-2 ps-4', theme.textMuted)}>
                              <span
                                className={cn('me-2 inline-block h-1 w-1 rounded-full align-middle', 'bg-current opacity-40')}
                                aria-hidden="true"
                              />
                              {/* Says which of the two it is. The text beside it
                                  is the operator's reason, not a task, and the
                                  game's task list has no such entry to check it
                                  against. */}
                              {scan.isBonus && (
                                <span className={cn('me-1.5 text-[11px] font-bold', theme.textSubtle)}>
                                  בונוס ·
                                </span>
                              )}
                              {scan.actionName}
                              {/* The answer they picked, and whether it scored.
                                  A 0 next to a task worth 20 is unreadable
                                  without it. */}
                              {scan.answerLabel && (
                                <span className={cn('ms-1.5 text-[11px]', theme.textSubtle)}>
                                  · {scan.answerLabel}
                                  {scan.isCorrect === false && ` (${WRONG_ANSWER_LABEL})`}
                                </span>
                              )}
                            </td>
                            <td className={cn('px-2 py-2 text-end tabular-nums', theme.textSubtle)}>
                              {formatMoment(scan.createdAt, todayKey)}
                            </td>
                            <td />
                            <td className="px-2 py-2">
                              <span className="flex items-center justify-end gap-1.5">
                                <span
                                  className={cn(
                                    'font-semibold tabular-nums',
                                    scan.isCorrect === false ? theme.textSubtle : 'text-success-text',
                                  )}
                                >
                                  {scan.isCorrect === false ? '0' : `+${scan.points.toLocaleString('he-IL')}`}
                                </span>
                                {/* Always visible, not hover-revealed: this list is
                                    worked through on a phone at the event, where
                                    there is no hover to reveal it with. */}
                                <DeleteButton
                                  iconSize={13}
                                  className="!p-1"
                                  aria-label={`מחיקת הסריקה ${scan.actionName} של ${entry.name}`}
                                  title="מחיקת הסריקה"
                                  onClick={() => setPending({ scan, participantName: entry.name })}
                                />
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  )
                })}
              </table>
            </div>
          )}
        </>
      )}

      <DeleteScanDialog
        scan={pending?.scan ?? null}
        participantName={pending?.participantName ?? ''}
        onPreview={previewDelete}
        onDelete={deleteScan}
        onClose={() => setPending(null)}
      />
    </div>
  )
}
