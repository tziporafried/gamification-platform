import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { KpiCard, formatNumber, formatRate } from './KpiCard'
import { Filter, UserPlus, Percent, Users, Video, Eye } from 'lucide-react'

export interface AffiliateOption {
  code: string
  name: string
  /** Registered customers exist but no GA traffic in the selected range. */
  noTraffic?: boolean
}

export interface AffiliateRowMetrics {
  content: string
  users: number
  newUsers: number
  videoViewUsers: number
  plansViewUsers: number
  leadUsers: number
}

export function ratePct(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return Math.round((part / whole) * 1000) / 10
}

export function sumAffiliateMetrics(rows: AffiliateRowMetrics[]) {
  return rows.reduce(
    (acc, row) => ({
      users: acc.users + row.users,
      newUsers: acc.newUsers + row.newUsers,
      videoViewUsers: acc.videoViewUsers + row.videoViewUsers,
      plansViewUsers: acc.plansViewUsers + row.plansViewUsers,
      leadUsers: acc.leadUsers + row.leadUsers,
    }),
    { users: 0, newUsers: 0, videoViewUsers: 0, plansViewUsers: 0, leadUsers: 0 },
  )
}

export function AffiliateFilterBar({
  options,
  selected,
  onChange,
  hint = 'הסינון מצמצם את המגמה, הסרטון והשאלות במסגרת. הסיכום למעלה נשאר לכל האתר.',
}: {
  options: AffiliateOption[]
  selected: string[]
  onChange: (codes: string[]) => void
  /** Pass null to hide the hint line. */
  hint?: string | null
}) {
  if (options.length === 0) return null

  const selectedSet = new Set(selected)
  const allSelected = selected.length === 0

  function toggle(code: string) {
    if (selectedSet.has(code)) {
      onChange(selected.filter((c) => c !== code))
    } else {
      onChange([...selected, code])
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-secondary" />
          <h3 className="text-sm font-semibold text-foreground">סינון לפי אפיליאייט</h3>
        </div>
        {!allSelected && (
          <Button type="button" variant="ghost" size="xs" onClick={() => onChange([])}>
            נקה סינון
          </Button>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange([])}
          className={cn(
            'rounded-full border px-3 py-1 text-xs transition-colors',
            allSelected
              ? 'border-secondary bg-secondary/15 text-foreground'
              : 'border-border text-muted hover:border-secondary/50 hover:text-foreground',
          )}
        >
          הכל · ללא סינון
        </button>
        {options.map((opt) => {
          const active = selectedSet.has(opt.code)
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => toggle(opt.code)}
              className={cn(
                'max-w-full rounded-full border px-3 py-1 text-xs transition-colors',
                active
                  ? 'border-secondary bg-secondary/15 text-foreground'
                  : 'border-border text-muted hover:border-secondary/50 hover:text-foreground',
              )}
              title={
                opt.noTraffic
                  ? `${opt.code} · יש לקוחות רשומים, בלי תנועה ב-GA בטווח`
                  : opt.code
              }
            >
              <span className="font-medium">{opt.name}</span>
              <span className="mx-1 text-muted/60">·</span>
              <span className="font-mono text-[10px]" dir="ltr">
                {opt.code}
              </span>
              {opt.noTraffic && (
                <span className="mr-1 text-[10px] text-warning">· לקוחות</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function AffiliateMetricsStrip({
  rows,
  loading,
  filtered,
}: {
  rows: AffiliateRowMetrics[]
  loading?: boolean
  filtered: boolean
}) {
  if (rows.length === 0) return null
  const totals = sumAffiliateMetrics(rows)
  const videoRate = ratePct(totals.videoViewUsers, totals.users)
  const plansRate = ratePct(totals.plansViewUsers, totals.users)
  const leadRate = ratePct(totals.leadUsers, totals.users)

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {filtered
          ? `קוביות לפי האפיליאייטים שנבחרו (${rows.length})`
          : 'קוביות לכל האתר · ללא סינון'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="מבקרים"
          value={totals.users}
          hint={filtered ? undefined : 'סה״כ ייחודיים בטווח'}
          loading={loading}
          accent="secondary"
          icon={<Users size={16} />}
        />
        <KpiCard
          label="משתמשים חדשים"
          value={totals.newUsers}
          hint={
            totals.users > 0
              ? `${formatRate(ratePct(totals.newUsers, totals.users))} מהמבקרים`
              : undefined
          }
          loading={loading}
          accent="primary"
          icon={<UserPlus size={16} />}
        />
        <KpiCard
          label="המרה לסרטון"
          value={formatRate(videoRate)}
          hint={`${formatNumber(totals.videoViewUsers)} צפו`}
          loading={loading}
          accent="tertiary"
          icon={<Video size={16} />}
        />
        <KpiCard
          label="המרה למחירים"
          value={formatRate(plansRate)}
          hint={`${formatNumber(totals.plansViewUsers)} ראו מחירים`}
          loading={loading}
          accent="secondary"
          icon={<Eye size={16} />}
        />
        <KpiCard
          label="המרה לליד"
          value={formatRate(leadRate)}
          hint={`${formatNumber(totals.leadUsers)} לידים`}
          loading={loading}
          accent="primary"
          icon={<Percent size={16} />}
        />
      </div>
    </div>
  )
}
