import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { KpiCard, formatNumber, formatRate } from './KpiCard'
import { Filter, UserPlus, Percent, Users, Video, Eye, MessageCircle } from 'lucide-react'

export interface AffiliateOption {
  code: string
  name: string
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
}: {
  options: AffiliateOption[]
  selected: string[]
  onChange: (codes: string[]) => void
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
    <Card className="space-y-3 p-4">
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
      <p className="text-[11px] text-muted">
        בחרו לינק אחד או יותר — המטריקות והטבלאות למטה יסתננו בהתאם. ללא בחירה מוצגים כולם.
      </p>
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
          כל האפיליאייטים
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
              title={opt.code}
            >
              <span className="font-medium">{opt.name}</span>
              <span className="mx-1 text-muted/60">·</span>
              <span className="font-mono text-[10px]" dir="ltr">
                {opt.code}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
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
          ? `מטריקות לאפיליאייטים שנבחרו (${rows.length})`
          : `סיכום כל האפיליאייטים (${rows.length})`}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="מבקרים"
          value={totals.users}
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
        <KpiCard
          label="לידים"
          value={totals.leadUsers}
          loading={loading}
          accent="tertiary"
          icon={<MessageCircle size={16} />}
        />
      </div>
    </div>
  )
}
