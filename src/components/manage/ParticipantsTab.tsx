import { useCallback, useMemo, useRef, useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet, ScanLine, Search, Table2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { DropdownDivider, DropdownHeader, DropdownItem, DropdownPanel } from '@/components/ui/DropdownPanel'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useEventParticipantsReport } from '@/hooks/useEventParticipantsReport'
import {
  downloadFullWorkbook,
  downloadParticipantsCsv,
  downloadParticipantsXlsx,
} from '@/lib/manage/participantsExport'
import {
  EMPTY_FILTERS,
  filterParticipants,
  formatDay,
  groupNames,
  hasActiveFilters,
  NO_GROUP,
  participantColumns,
  sortParticipants,
  STATUS_LABELS,
  totalsOf,
  visibleColumns,
  type ParticipantFilters,
  type ParticipantRow,
  type ParticipantSort,
  type ParticipantStatus,
} from '@/lib/manage/participantsReport'
import { getIsraelLocalDateString } from '@/lib/israelTime'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

/**
 * One row per participant, with everything the game knows about them.
 *
 * The screen the other three tabs never were: they each answer one question
 * over time - who scanned, who won - and this one answers "who is this person
 * and how are they doing", which is the question a list gets asked when the
 * event is over and somebody wants the results as a file.
 *
 * Styled like ScansTab on purpose - hairlines, aligned numbers, rows that open
 * with no animation. This is a table to scan down, not a set of cards.
 */

interface ParticipantsTabProps {
  eventId: string
  eventName: string
  /** Jump to the scan log with this participant already searched for. */
  onShowScans?: (participantName: string) => void
}

const DEFAULT_SORT: ParticipantSort = { column: 'points', direction: 'desc' }

export function ParticipantsTab({ eventId, eventName, onShowScans }: ParticipantsTabProps) {
  const { rows, loading, error } = useEventParticipantsReport(eventId)
  const [filters, setFilters] = useState<ParticipantFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<ParticipantSort>(DEFAULT_SORT)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  useClickOutside(exportRef, useCallback(() => setExportOpen(false), []))

  // Fixed for the life of the render, so a table drawn either side of midnight
  // cannot disagree with itself about what "today" means.
  const todayKey = useMemo(() => getIsraelLocalDateString(new Date()), [])
  const allColumns = useMemo(() => participantColumns(todayKey), [todayKey])

  // Which columns exist is decided by the whole roster, not by the filtered
  // view: a column should not appear and disappear as somebody types.
  const columns = useMemo(() => visibleColumns(allColumns, rows), [allColumns, rows])
  const groups = useMemo(() => groupNames(rows), [rows])

  const visible = useMemo(
    () => sortParticipants(filterParticipants(rows, filters), sort, allColumns),
    [rows, filters, sort, allColumns],
  )
  const totals = useMemo(() => totalsOf(visible), [visible])
  const filtered = hasActiveFilters(filters)

  function toggleSort(columnId: ParticipantSort['column']) {
    const column = allColumns.find((c) => c.id === columnId)
    if (!column) return
    setSort((prev) =>
      prev.column === columnId
        ? { column: columnId, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column: columnId, direction: column.firstClick },
    )
  }

  function exportTable(kind: 'xlsx' | 'csv') {
    setExportOpen(false)
    setExportError(null)
    // What is on screen, after the filters and in the order shown - the export
    // that disagrees with its table is the one nobody trusts again.
    if (kind === 'xlsx') downloadParticipantsXlsx(eventName, visible, columns)
    else downloadParticipantsCsv(eventName, visible, columns)
  }

  async function exportWorkbook() {
    setExportOpen(false)
    setExportError(null)
    setExporting(true)
    const result = await downloadFullWorkbook(eventId, eventName, rows, columns)
    if (!result.ok) setExportError(result.error)
    setExporting(false)
  }

  if (loading) return <CenteredLoader />

  if (error) return <ErrorAlert message={error} />

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Users size={28} aria-hidden="true" />}
        title="אין עדיין משתתפים"
        description="הוסיפו משתתפים למשחק כדי לראות כאן את הנתונים שלהם."
      />
    )
  }

  return (
    <div className="space-y-4">
      {exportError && <ErrorAlert message={exportError} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            placeholder="חיפוש שם או טלפון"
            aria-label="חיפוש משתתף"
            className="pr-9"
          />
        </div>

        {/* Select fills its own wrapper, so the widths are set out here. */}
        {groups.length > 0 && (
          <div className="w-36 shrink-0 sm:w-44">
            <Select
              value={filters.group}
              onChange={(e) => setFilters((f) => ({ ...f, group: e.target.value }))}
              aria-label="סינון לפי קבוצה"
            >
              <option value="">כל הקבוצות</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
              <option value={NO_GROUP}>ללא קבוצה</option>
            </Select>
          </div>
        )}

        <div className="w-36 shrink-0 sm:w-44">
          <Select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as ParticipantStatus }))}
            aria-label="סינון לפי סטטוס"
          >
            {(Object.keys(STATUS_LABELS) as ParticipantStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>

        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            <X size={14} className="ms-1" aria-hidden="true" />
            ניקוי מסננים
          </Button>
        )}

        <div className="relative" ref={exportRef}>
          <Button
            variant="outline"
            size="sm"
            loading={exporting}
            onClick={() => setExportOpen((open) => !open)}
            aria-expanded={exportOpen}
            aria-haspopup="menu"
          >
            <Download size={14} className="ms-1.5" aria-hidden="true" />
            ייצוא
            <ChevronDown size={13} className="me-1" aria-hidden="true" />
          </Button>

          {exportOpen && (
            <DropdownPanel width="w-64">
              {/* The header says which rows once, so neither item has to. */}
              <DropdownHeader>
                {filtered ? `הטבלה שעל המסך · ${visible.length} שורות` : 'הטבלה שעל המסך'}
              </DropdownHeader>
              <DropdownItem onClick={() => exportTable('xlsx')}>
                <span className="flex items-center gap-2">
                  <Table2 size={14} aria-hidden="true" />
                  אקסל
                </span>
              </DropdownItem>
              <DropdownItem onClick={() => exportTable('csv')}>
                <span className="flex items-center gap-2">
                  <Table2 size={14} aria-hidden="true" />
                  CSV
                </span>
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem onClick={exportWorkbook}>
                <span className="flex items-center gap-2">
                  <FileSpreadsheet size={14} aria-hidden="true" />
                  <span>
                    חוברת מלאה
                    <span className={cn('block text-[11px]', theme.textSubtle)}>
                      כל המשתתפים, הסריקות, הפרסים וההגרלות
                    </span>
                  </span>
                </span>
              </DropdownItem>
            </DropdownPanel>
          )}
        </div>
      </div>

      <p className={cn('text-sm tabular-nums', theme.textMuted)}>
        {filtered ? `${visible.length} מתוך ${rows.length} משתתפים` : `${rows.length} משתתפים`} ·{' '}
        {totals.played} שיחקו · {totals.scans.toLocaleString('he-IL')} סריקות ·{' '}
        {totals.points.toLocaleString('he-IL')} נקודות
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Search size={28} aria-hidden="true" />}
          title="לא נמצאו תוצאות"
          description="נסו לשנות את החיפוש או את המסננים."
          compact
        />
      ) : (
        <div className={cn('overflow-x-auto rounded-xl border shadow-sm', theme.border)}>
          <table className="w-full min-w-[40rem] border-collapse text-sm">
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
                {columns.map((column) => {
                  const active = sort.column === column.id
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={cn('px-2 py-0', column.align === 'end' ? 'text-end' : 'text-start')}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className={cn(
                          'flex w-full items-center gap-1 py-2.5 font-semibold',
                          column.align === 'end' ? 'justify-end' : 'justify-start',
                          theme.focusRing,
                          theme.hoverText,
                          active && theme.text,
                        )}
                      >
                        {column.label}
                        <ChevronDown
                          size={12}
                          aria-hidden="true"
                          className={cn(
                            'transition-[transform,opacity] duration-150',
                            active ? 'opacity-100' : 'opacity-0',
                            active && sort.direction === 'asc' && 'rotate-180',
                          )}
                        />
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>

            {visible.map((row) => (
              <tbody key={row.id}>
                <tr
                  onClick={() => setExpanded((open) => (open === row.id ? null : row.id))}
                  className={cn(
                    'cursor-pointer border-b',
                    theme.border,
                    theme.hoverSurface,
                    expanded === row.id && theme.bgCardMuted,
                  )}
                >
                  <td className="ps-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpanded((open) => (open === row.id ? null : row.id))
                      }}
                      aria-expanded={expanded === row.id}
                      aria-label={`${expanded === row.id ? 'סגירת' : 'פתיחת'} הפרטים של ${row.name}`}
                      className={cn('rounded p-1', theme.textSubtle, theme.focusRing)}
                    >
                      <ChevronDown
                        size={14}
                        aria-hidden="true"
                        className={cn(
                          'transition-transform duration-150',
                          expanded === row.id && 'rotate-180',
                        )}
                      />
                    </button>
                  </td>
                  {columns.map((column) => {
                    const text = column.text(row)
                    return (
                      <td
                        key={column.id}
                        className={cn(
                          'max-w-[16rem] truncate px-2 py-3 tabular-nums',
                          column.align === 'end' ? 'text-end' : 'text-start',
                          column.emphasis
                            ? cn('text-[15px] font-bold', theme.text)
                            : theme.textMuted,
                        )}
                      >
                        {text || <span className={theme.textSubtle}>—</span>}
                      </td>
                    )
                  })}
                </tr>

                {expanded === row.id && (
                  <tr className={cn('border-b', theme.border, theme.bgCardMuted)}>
                    <td />
                    <td colSpan={columns.length} className="px-2 pb-4 pt-1">
                      <ParticipantDetails row={row} onShowScans={onShowScans} />
                    </td>
                  </tr>
                )}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  )
}

/**
 * What did not fit in a column: the lists, and the fields a game may not use.
 *
 * The scans themselves are not repeated here - they are a tab of their own,
 * with the delete the scan log already owns, so the row links there rather
 * than growing a second copy of it.
 */
function ParticipantDetails({
  row,
  onShowScans,
}: {
  row: ParticipantRow
  onShowScans?: (participantName: string) => void
}) {
  const facts: { label: string; value: string }[] = [
    { label: 'קבוצה', value: row.groups.join(' · ') },
    { label: 'טלפון', value: row.phone },
    { label: 'פרסים', value: row.rewards.join(' · ') },
    { label: 'זכיות בהגרלה', value: row.lotteryWins.join(' · ') },
    { label: 'נוסף בתאריך', value: formatDay(row.createdAt) },
  ].filter((fact) => fact.value !== '')

  return (
    <div className="space-y-3 text-[13px]">
      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="flex gap-2">
            <dt className={cn('shrink-0 font-semibold', theme.textSubtle)}>{fact.label}</dt>
            <dd className={cn('min-w-0 break-words', theme.text)}>{fact.value}</dd>
          </div>
        ))}
      </dl>

      {onShowScans && row.scans > 0 && (
        <Button variant="outline" size="xs" onClick={() => onShowScans(row.name)}>
          <ScanLine size={13} className="ms-1" aria-hidden="true" />
          {row.scans} הסריקות של {row.name}
        </Button>
      )}
    </div>
  )
}
