import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Filter,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Link2,
  LogIn,
  MessageCircle,
  MousePointerClick,
  Package,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { DateRangePicker } from './DateRangePicker'
import { KpiCard, formatNumber, formatRate } from './KpiCard'
import { FunnelChart } from './FunnelChart'
import { TrendLineChart } from './TrendLineChart'
import { FaqBarChart } from './FaqBarChart'
import { RankedBarChart } from './RankedBarChart'
import { SimpleDonut } from './SimpleDonut'
import { InsightCards } from './InsightCards'
import { VideoProgressTrack } from './VideoProgressTrack'
import { fetchAnalyticsDashboard } from './fetchDashboard'
import { LinkLabelEditor, useUtmLinkLabels, UtmShareLinkGenerator } from './useUtmLinkLabels'
import { AffiliateFilterBar, ratePct } from './AffiliateFilter'
import {
  buildAttentionInsights,
  buildFaqInsight,
  buildPlansContactDropInsight,
  buildVideoDropInsight,
} from './insights'
import {
  AnalyticsDashboardData,
  AnalyticsDatePreset,
  AnalyticsFetchError,
} from './types'

const CHART_COLORS = [
  'var(--color-secondary)',
  'var(--color-primary)',
  'var(--color-tertiary)',
  'var(--color-accent)',
  'var(--color-warning)',
  'var(--color-success)',
  'var(--color-muted)',
]

const INTEREST_INFO =
  'השלבים מציגים השוואה בין קהלי הפעולות בתקופה הנבחרת ואינם בהכרח מסלול רציף של אותו משתמש.'

const UTM_SOURCE_LABELS: Record<string, string> = {
  personal_share: 'שיתוף אישי',
  share: 'שיתוף',
}

function utmSourceLabel(source: string): string {
  return UTM_SOURCE_LABELS[source] ?? source
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoYmd(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function presetToRange(preset: AnalyticsDatePreset): { start: string; end: string } {
  const end = todayYmd()
  if (preset === 'today') return { start: end, end }
  if (preset === '14d') return { start: daysAgoYmd(13), end }
  if (preset === '28d') return { start: daysAgoYmd(27), end }
  return { start: daysAgoYmd(6), end }
}

function calcStepRate(from: number, to: number): number | null {
  if (from <= 0) return null
  return Math.round((to / from) * 1000) / 10
}

function toDonutSlices(items: { label: string; users: number }[] | null | undefined) {
  return (items ?? [])
    .filter((i) => i.users > 0)
    .map((item, i) => ({
      label: item.label,
      value: item.users,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
}

/** Distinct utm_content codes from registered customer first-touch attribution. */
function extractCustomerContentCodes(
  rows: { affiliate_attribution: unknown }[] | null,
): string[] {
  const codes = new Set<string>()
  for (const row of rows ?? []) {
    const raw = row.affiliate_attribution
    if (!raw || typeof raw !== 'object') continue
    const content = (raw as Record<string, unknown>).utm_content
    if (typeof content !== 'string') continue
    const code = content.trim().toLowerCase()
    if (code) codes.add(code)
  }
  return [...codes]
}

export function AdminAnalyticsDashboard() {
  const [preset, setPreset] = useState<AnalyticsDatePreset>('7d')
  const [startDate, setStartDate] = useState(() => daysAgoYmd(6))
  const [endDate, setEndDate] = useState(() => todayYmd())
  const [data, setData] = useState<AnalyticsDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  /** Affiliate-filter refetch only — must not flash the site-wide quick summary. */
  const [frameLoading, setFrameLoading] = useState(false)
  const [error, setError] = useState<AnalyticsFetchError | null>(null)
  const [showAllFaq, setShowAllFaq] = useState(false)
  const [showExtraOverview, setShowExtraOverview] = useState(false)
  const [showActivationDetails, setShowActivationDetails] = useState(false)
  const [selectedAffiliates, setSelectedAffiliates] = useState<string[]>([])
  const [customerContentCodes, setCustomerContentCodes] = useState<string[]>([])
  const skipAffiliateReload = useRef(true)
  const selectedAffiliatesRef = useRef(selectedAffiliates)
  selectedAffiliatesRef.current = selectedAffiliates

  const {
    labelFor,
    labelsByCode,
    displayLabel: linkDisplayLabel,
    saveLabel,
    createShareLink,
    savingCode,
    error: linkLabelError,
  } = useUtmLinkLabels()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: rows, error: fetchError } = await supabase
        .from('user_profiles')
        .select('affiliate_attribution')
        .not('affiliate_attribution', 'is', null)
      if (cancelled || fetchError) return
      setCustomerContentCodes(
        extractCustomerContentCodes(rows as { affiliate_attribution: unknown }[]),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(
    async (mode: 'full' | 'frame' = 'full') => {
      if (mode === 'full') {
        setLoading(true)
        setError(null)
      } else {
        setFrameLoading(true)
      }
      try {
        const result = await fetchAnalyticsDashboard({
          preset,
          startDate: preset === 'custom' ? startDate : undefined,
          endDate: preset === 'custom' ? endDate : undefined,
          // empty = whole site (no affiliate filter); non-empty = those content codes only
          utmContents: selectedAffiliatesRef.current,
        })
        setData(result)
        if (mode === 'frame') setError(null)
      } catch (err) {
        if (mode === 'full') {
          setData(null)
        }
        // On frame refetch failure keep existing data (summary stays visible).
        if (err instanceof AnalyticsFetchError) {
          setError(err)
        } else {
          setError(new AnalyticsFetchError('שגיאה בטעינת אנליטיקות', 'UNKNOWN'))
        }
      } finally {
        setLoading(false)
        setFrameLoading(false)
      }
    },
    [preset, startDate, endDate],
  )

  // Date range / initial load — includes current affiliate selection.
  useEffect(() => {
    void load('full')
  }, [load])

  // Affiliate filter — refetch scoped frame only; do not flash site-wide summary.
  useEffect(() => {
    if (skipAffiliateReload.current) {
      skipAffiliateReload.current = false
      return
    }
    void load('frame')
    // Only when affiliate chips change — not when date-range `load` identity updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedAffiliates only
  }, [selectedAffiliates])

  const frameBusy = loading || frameLoading

  function handlePresetChange(next: AnalyticsDatePreset) {
    setPreset(next)
    if (next !== 'custom') {
      const range = presetToRange(next)
      setStartDate(range.start)
      setEndDate(range.end)
    }
  }

  function handleCustomChange(start: string, end: string) {
    setStartDate(start)
    setEndDate(end)
    setPreset('custom')
  }

  const rangeLabel =
    data?.meta
      ? `${data.meta.startDate} – ${data.meta.endDate}`
      : `${startDate} – ${endDate}`

  const insights = useMemo(
    () => (data ? buildAttentionInsights(data) : []),
    [data],
  )

  const videoMilestones = useMemo(() => {
    if (!data) return []
    return [
      { label: 'התחילו', users: data.video.startedUsers },
      ...(data.video.milestonesUnavailable
        ? []
        : [
            { label: '25%', users: data.video.reached25Users ?? 0 },
            { label: '50%', users: data.video.reached50Users ?? 0 },
            { label: '75%', users: data.video.reached75Users ?? 0 },
          ]),
      { label: 'סיימו', users: data.video.completedUsers },
    ]
  }, [data])

  const videoInsight = useMemo(
    () => buildVideoDropInsight(videoMilestones),
    [videoMilestones],
  )

  const faqInsight = useMemo(
    () => buildFaqInsight(data?.homepageInterest.questions),
    [data],
  )

  const plansDropInsight = useMemo(
    () => (data ? buildPlansContactDropInsight(data) : null),
    [data],
  )

  const faqQuestions = data?.homepageInterest.questions ?? []
  const visibleFaq = showAllFaq ? faqQuestions : faqQuestions.slice(0, 7)

  const contactSourceUnavailable =
    data?.contact.bySourceUnavailable && data?.contact.opensBySourceUnavailable

  const loginCompletion = data
    ? calcStepRate(data.login.startedUsers, data.login.successfulUsers)
    : null

  const eventCreationCompletion = data
    ? calcStepRate(data.eventCreation.startUsers, data.eventCreation.creatorUsers)
    : null

  /**
   * All affiliate content codes we know about — for filter + name editing:
   * GA traffic, registered customers, and admin-created share links.
   */
  const linkDetailRows = useMemo(() => {
    const byCode = new Map<
      string,
      {
        content: string
        source: string | null
        users: number
        newUsers: number
        videoViewUsers: number
        plansViewUsers: number
        leadUsers: number
        /** Seen via customers / labels only — no GA signal in range. */
        noGaTraffic: boolean
      }
    >()

    const perf = data?.utm.linkPerformance ?? []
    for (const row of perf) {
      byCode.set(row.content.trim().toLowerCase(), {
        content: row.content,
        source: row.source,
        users: row.users,
        newUsers: row.newUsers ?? 0,
        videoViewUsers: row.videoViewUsers,
        plansViewUsers: row.plansViewUsers,
        leadUsers: row.leadUsers,
        noGaTraffic: false,
      })
    }

    // Always merge contentBreakdown so session-only affiliates aren't dropped
    // when linkPerformance already has at least one customEvent row.
    for (const row of data?.utm.contentBreakdown ?? []) {
      const key = row.content.trim().toLowerCase()
      const existing = byCode.get(key)
      if (!existing) {
        byCode.set(key, {
          content: row.content,
          source: null,
          users: row.users,
          newUsers: 0,
          videoViewUsers: 0,
          plansViewUsers: 0,
          leadUsers: 0,
          noGaTraffic: false,
        })
      } else if (row.users > existing.users) {
        byCode.set(key, { ...existing, users: row.users })
      }
    }

    // Codes from registered customers (may have no GA hits in the selected range).
    for (const code of customerContentCodes) {
      if (byCode.has(code)) continue
      byCode.set(code, {
        content: code,
        source: 'share',
        users: 0,
        newUsers: 0,
        videoViewUsers: 0,
        plansViewUsers: 0,
        leadUsers: 0,
        noGaTraffic: true,
      })
    }

    // Admin-created share links — always list so names stay editable.
    for (const code of Object.keys(labelsByCode)) {
      if (byCode.has(code)) continue
      byCode.set(code, {
        content: code,
        source: 'share',
        users: 0,
        newUsers: 0,
        videoViewUsers: 0,
        plansViewUsers: 0,
        leadUsers: 0,
        noGaTraffic: true,
      })
    }

    return [...byCode.values()]
      .filter(
        (row) =>
          row.noGaTraffic ||
          row.users > 0 ||
          row.videoViewUsers > 0 ||
          row.plansViewUsers > 0 ||
          row.leadUsers > 0,
      )
      .sort((a, b) => {
        // Unnamed codes first — so external affiliates can be labeled quickly.
        const aNamed = Boolean(labelFor(a.content))
        const bNamed = Boolean(labelFor(b.content))
        if (aNamed !== bNamed) return aNamed ? 1 : -1
        if (b.users !== a.users) return b.users - a.users
        return (labelFor(a.content) ?? a.content).localeCompare(
          labelFor(b.content) ?? b.content,
          'he',
        )
      })
  }, [data, labelFor, customerContentCodes, labelsByCode])

  const affiliateOptions = useMemo(
    () =>
      linkDetailRows.map((row) => ({
        code: row.content.trim().toLowerCase(),
        name: labelFor(row.content) ?? row.content,
        noTraffic: row.noGaTraffic,
      })),
    [linkDetailRows, labelFor],
  )

  const unnamedLinkCount = useMemo(
    () => linkDetailRows.filter((row) => !labelFor(row.content)).length,
    [linkDetailRows, labelFor],
  )

  const filteredLinkRows = useMemo(() => {
    if (selectedAffiliates.length === 0) return linkDetailRows
    const set = new Set(selectedAffiliates)
    return linkDetailRows.filter((row) => set.has(row.content.trim().toLowerCase()))
  }, [linkDetailRows, selectedAffiliates])

  const affiliatesFiltered = selectedAffiliates.length > 0


  const trendLooksEmpty = useMemo(() => {
    if (!data || data.timeSeries.unavailable) return false
    const expectTraffic = affiliatesFiltered
      ? filteredLinkRows.some((r) => r.users > 0)
      : data.overview.homepageUsers > 0
    if (!expectTraffic) return false
    const hasTrend = data.timeSeries.days.some(
      (d) =>
        d.visitors > 0 ||
        d.newUsers > 0 ||
        d.videoView > 0 ||
        d.viewPlans > 0 ||
        d.generateLead > 0,
    )
    return !hasTrend
  }, [data, filteredLinkRows, affiliatesFiltered])

  return (
    <div className="space-y-4">
      {/* Header + date filter + compact share-link create */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader
            size="md"
            icon={<BarChart3 size={18} className="text-secondary" />}
            title="ניתוח נתונים"
            subtitle={`טווח: ${rangeLabel}`}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load('full')}
            disabled={loading || frameLoading}
            className="shrink-0 gap-1.5 self-start"
          >
            <RefreshCw
              size={14}
              className={loading || frameLoading ? 'animate-spin' : undefined}
            />
            רענון
          </Button>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/70 pt-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
          <div className="min-w-0 flex-1">
            <DateRangePicker
              preset={preset}
              startDate={startDate}
              endDate={endDate}
              onPresetChange={handlePresetChange}
              onCustomChange={handleCustomChange}
              disabled={loading}
            />
          </div>
          <div className="min-w-[14rem] shrink-0 border-t border-border/60 pt-2 lg:max-w-sm lg:border-t-0 lg:border-s lg:ps-4 lg:pt-0">
            <UtmShareLinkGenerator
              compact
              createShareLink={createShareLink}
              generating={!!savingCode}
              error={linkLabelError}
            />
          </div>
        </div>
      </div>

      {error && !loading && (
        <Card className="space-y-3 p-5">
          <ErrorAlert
            message={
              error.code === 'GA4_NOT_CONFIGURED'
                ? 'חיבור Google Analytics עדיין לא הוגדר בשרת. יש להגדיר את ה-secrets של Edge Function ga4-dashboard.'
                : error.message
            }
          />
          {error.code === 'GA4_NOT_CONFIGURED' && error.missing && error.missing.length > 0 && (
            <p className="text-xs text-muted">חסרים: {error.missing.join(', ')}</p>
          )}
          {error.detail && error.message !== error.detail && (
            <p className="break-words rounded-lg bg-surface-elevated px-3 py-2 font-mono text-xs text-muted">
              {error.detail}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={() => void load('full')}>
            נסו שוב
          </Button>
        </Card>
      )}

      {loading && !data && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
          <Spinner size="lg" />
          <p className="text-sm">טוען נתוני אנליטיקות…</p>
        </div>
      )}

      {!error && data && (
        <>
          {/* Site-wide quick summary — above affiliate filter */}
          <section className="space-y-3">
            <SectionHeader
              icon={<Users size={16} className="text-secondary" />}
              title="סיכום מהיר"
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                loading={loading}
                label="מבקרים ייחודיים"
                value={data.overview.homepageUsers}
                icon={<Users size={16} />}
                accent="primary"
              />
              <KpiCard
                loading={loading}
                label="צפו בסרטון"
                value={data.overview.videoUsers}
                hint={
                  data.overview.homepageUsers > 0
                    ? formatRate(
                        calcStepRate(data.overview.homepageUsers, data.overview.videoUsers),
                      )
                    : undefined
                }
                icon={<Video size={16} />}
                accent="secondary"
              />
              <KpiCard
                loading={loading}
                label="צפו במחירים"
                value={data.overview.pricingUsers}
                hint={
                  data.overview.homepageUsers > 0
                    ? formatRate(
                        calcStepRate(data.overview.homepageUsers, data.overview.pricingUsers),
                      )
                    : undefined
                }
                icon={<Sparkles size={16} />}
                accent="tertiary"
              />
              <KpiCard
                loading={loading}
                label="לידים"
                value={data.overview.leadUsers}
                hint={
                  data.overview.leadConversionRate !== null
                    ? formatRate(data.overview.leadConversionRate)
                    : undefined
                }
                icon={<MessageCircle size={16} />}
                accent="primary"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowExtraOverview((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              {showExtraOverview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              נתונים נוספים
            </button>
            {showExtraOverview && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                  loading={loading}
                  label="צפיות בדף הבית"
                  value={data.overview.homepageViews}
                  hint="ספירת צפיות"
                  accent="muted"
                />
                <KpiCard
                  loading={loading}
                  label="הגיעו להתחברות"
                  value={data.overview.loginViewUsers}
                  accent="muted"
                />
                <KpiCard
                  loading={loading}
                  label="יצרו אירוע"
                  value={data.overview.eventCreators}
                  hint="משתמשים ייחודיים"
                  accent="muted"
                />
                <KpiCard
                  loading={loading}
                  label="לחיצות CTA"
                  value={data.ctas.totalUsers}
                  hint="משתמשים ייחודיים"
                  accent="muted"
                />
              </div>
            )}
          </section>

          {/* Affiliate frame: filter + trend + video + FAQ */}
          <section>
            <Card className="space-y-3 border-2 border-secondary/40 p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-secondary" />
                  <h2 className="text-sm font-semibold text-foreground">מגמה וסינון</h2>
                  <span className="rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-foreground">
                    {affiliatesFiltered ? 'מסונן לפי אפיליאייט' : 'כל האתר'}
                  </span>
                </div>
              </div>

              <AffiliateFilterBar
                options={affiliateOptions}
                selected={selectedAffiliates}
                onChange={setSelectedAffiliates}
                hint="כולל גם אפיליאייטים עם לקוחות רשומים גם אם אין תנועה ב-GA בטווח. הסיכום למעלה נשאר לכל האתר."
              />

              <div className="border-t border-border pt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-secondary" />
                    <h3 className="text-sm font-semibold text-foreground">מגמה לאורך זמן</h3>
                  </div>
                  <p className="text-[11px] text-muted">
                    {affiliatesFiltered
                      ? 'מסונן לפי האפיליאייטים שנבחרו'
                      : 'כל האתר · ללא סינון'}
                  </p>
                </div>
                {trendLooksEmpty && (
                  <div className="mb-4 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
                    המגמה ריקה למרות שיש תנועה. ייתכן שצריך לדפלוי מחדש את{' '}
                    <code className="text-xs">ga4-dashboard</code>.
                  </div>
                )}
                <TrendLineChart
                  days={data.timeSeries.days}
                  loading={frameBusy}
                  unavailable={data.timeSeries.unavailable}
                  height={360}
                />
              </div>

              <div className="grid gap-4 border-t border-border pt-3 lg:grid-cols-2 lg:items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Video size={14} className="text-secondary" />
                    <h3 className="text-sm font-semibold text-foreground">ביצועי הסרטון</h3>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-elevated/40 p-3 sm:p-4">
                    <h4 className="mb-3 text-xs font-semibold text-muted">פיצול צפייה</h4>
                    <VideoProgressTrack
                      loading={frameBusy}
                      milestones={videoMilestones}
                      baseUsers={data.video.startedUsers}
                      startedUsers={data.video.startedUsers}
                      completedUsers={data.video.completedUsers}
                      reached25Users={data.video.reached25Users}
                      reached50Users={data.video.reached50Users}
                      reached75Users={data.video.reached75Users}
                      unavailable={data.video.milestonesUnavailable}
                      unavailableNote="אבני דרך 25% / 50% / 75% עדיין לא זמינות ב-GA4 (יש לרשום את progress_percent כ-Event-scoped Custom Dimension). מוצג כרגע סיימו מול לא סיימו."
                      insight={videoInsight}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <HelpCircle size={14} className="text-secondary" />
                    <h3 className="text-sm font-semibold text-foreground">שאלות נפוצות</h3>
                  </div>
                  <div className="space-y-3 rounded-xl border border-border bg-surface-elevated/40 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-muted">פתחו שאלות</span>
                        <span className="text-lg font-bold tabular-nums text-foreground">
                          {frameBusy ? '—' : formatNumber(data.homepageInterest.faqUsers)}
                        </span>
                      </div>
                      {faqQuestions.length > 7 && (
                        <button
                          type="button"
                          onClick={() => setShowAllFaq((v) => !v)}
                          className="text-xs font-medium text-secondary hover:underline"
                        >
                          {showAllFaq ? 'הצג פחות' : 'הצג את כל השאלות'}
                        </button>
                      )}
                    </div>
                    {faqInsight && (
                      <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                        {faqInsight}
                      </p>
                    )}
                    <FaqBarChart
                      loading={frameBusy}
                      unavailable={data.homepageInterest.questionsUnavailable}
                      items={visibleFaq.map((q) => ({ question: q.question, users: q.users }))}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {insights.length > 0 && (
            <section className="space-y-2">
              <SectionHeader
                icon={<AlertTriangle size={14} className="text-warning" />}
                title="דורש תשומת לב"
              />
              <InsightCards insights={insights} loading={loading} />
            </section>
          )}


          {/* CTA + Traffic */}
          <section className="space-y-3">
            <SectionHeader
              icon={<MousePointerClick size={16} className="text-secondary" />}
              title="לחיצות CTA ומקורות"
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">סוגי פעולה</h3>
                <SimpleDonut
                  loading={loading}
                  unavailable={data.ctas.byNameUnavailable}
                  unavailableDescription="פירוט לפי סוג CTA עדיין לא זמין."
                  emptyTitle="אין לחיצות CTA"
                  emptyDescription="בטווח שנבחר לא נרשמו לחיצות."
                  slices={toDonutSlices(data.ctas.byName)}
                  centerValue={formatNumber(data.ctas.totalUsers)}
                  centerLabel="לחיצות CTA"
                  showLegendPercent
                />
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">מיקום הפעולה</h3>
                <RankedBarChart
                  loading={loading}
                  unavailable={data.ctas.byLocationUnavailable}
                  unavailableDescription="פירוט לפי מיקום עדיין לא זמין."
                  emptyTitle="אין לחיצות לפי מיקום"
                  emptyDescription="בטווח שנבחר לא נרשמו לחיצות עם מיקום."
                  items={(data.ctas.byLocation ?? []).map((r) => ({
                    label: r.label,
                    value: r.users,
                  }))}
                  color="var(--color-primary)"
                />
              </Card>
            </div>
          </section>

          {/* Traffic sources + link performance side by side */}
          <section className="space-y-3">
            <SectionHeader
              icon={<Link2 size={16} className="text-secondary" />}
              title="מקורות תנועה וביצועי לינקים"
            />
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <Card className="p-4 sm:p-5">
                <h3 className="mb-1 text-sm font-semibold text-foreground">מקורות תנועה</h3>
                <p className="mb-3 text-[11px] text-muted">כל האתר (GA sessionSource)</p>
                <SimpleDonut
                  loading={loading}
                  unavailable={data.trafficSources.unavailable}
                  unavailableTitle="מקורות תנועה לא זמינים"
                  unavailableDescription="לא ניתן לטעון את התפלגות מקורות התנועה כרגע."
                  emptyTitle="אין נתוני מקורות"
                  emptyDescription="בטווח שנבחר לא זוהו מקורות תנועה."
                  slices={toDonutSlices(data.trafficSources.items)}
                  centerValue={formatNumber(
                    data.trafficSources.totalUsers || data.overview.homepageUsers,
                  )}
                  centerLabel="מבקרים"
                  showLegendPercent
                />
              </Card>

              <Card className="p-4 sm:p-5">
                <h3 className="mb-1 text-sm font-semibold text-foreground">ביצועי לינקים</h3>
                <p className="mb-3 text-[11px] text-muted">לינקים מסומנים (utm_content) · לפי מבקרים</p>
                {data.utm.unavailable ? (
                  <EmptyState
                    compact
                    icon={<Link2 size={22} />}
                    title="אנליטיקת לינקים עדיין לא זמינה"
                    description="יש לרשום ב-GA4 את utm_source ו-utm_content כ-Event-scoped Custom Dimensions."
                  />
                ) : linkDetailRows.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Link2 size={22} />}
                    title="אין לינקים עם תנועה"
                    description="צרו לינק בראש העמוד ושתפו אותו."
                  />
                ) : (
                  <RankedBarChart
                    loading={loading}
                    valueLabel="מבקרים"
                    items={linkDetailRows
                      .filter((r) => r.users > 0)
                      .map((r) => ({
                        label: r.source
                          ? `${linkDisplayLabel(r.content)}\u00A0·\u00A0${utmSourceLabel(r.source)}`
                          : linkDisplayLabel(r.content),
                        value: r.users,
                      }))
                      .sort((a, b) => b.value - a.value)}
                    emptyTitle="אין לינקים עם תנועה"
                    emptyDescription="בטווח שנבחר אין מזהי לינק."
                    color="var(--color-accent)"
                  />
                )}
              </Card>
            </div>
          </section>

          {/* UTM / shared-link attribution — detail table + name editor */}
          <section className="space-y-3">
            <SectionHeader
              icon={<Link2 size={16} className="text-secondary" />}
              title="לינקים מסומנים — פירוט"
            />

            {linkDetailRows.length === 0 ? (
              <Card className="p-5">
                <EmptyState
                  compact
                  icon={<Link2 size={22} />}
                  title={
                    data.utm.unavailable
                      ? 'אנליטיקת לינקים מסומנים עדיין לא זמינה'
                      : 'עדיין אין לינקים מסומנים'
                  }
                  description={
                    data.utm.unavailable
                      ? 'יש לרשום ב-GA4 כ-Event-scoped Custom Dimensions לפחות את utm_source ו-utm_content. פרמטרים אופציונליים (utm_medium, utm_campaign) אינם נדרשים ללינקים קצרים.'
                      : 'צרו לינק בראש העמוד ושתפו אותו — כשייכנסו מבקרים או לקוחות עם utm_content הם יופיעו כאן לעריכת שם.'
                  }
                />
              </Card>
            ) : (
              <>
                {data.utm.unavailable && (
                  <Card className="border-warning/30 bg-warning/5 p-4">
                    <p className="text-xs text-foreground">
                      מדדי תנועה מ-GA4 עדיין לא זמינים, אבל אפשר לערוך כאן שמות לכל הקודים שזוהו
                      מלקוחות או מלינקים קיימים.
                    </p>
                  </Card>
                )}

                {data.utm.unavailableParams.length > 0 && !data.utm.unavailable && (
                  <Card className="border-warning/30 bg-warning/5 p-4">
                    <p className="text-xs text-foreground">
                      חלק ממימדי ה-UTM עדיין לא זמינים ב-GA4. יש לרשום כ-Event-scoped Custom
                      Dimensions:{' '}
                      <span className="font-mono text-[11px]">
                        {data.utm.unavailableParams.join(', ')}
                      </span>
                    </p>
                  </Card>
                )}

                {unnamedLinkCount > 0 && (
                  <Card className="border-secondary/30 bg-secondary/5 p-4">
                    <p className="text-xs text-foreground">
                      {unnamedLinkCount === 1
                        ? 'יש קוד אחד בלי שם — בראש הטבלה. לחצו על העיפרון כדי לתת לו שם לתצוגה.'
                        : `יש ${unnamedLinkCount} קודים בלי שם — הם בראש הטבלה. לחצו על העיפרון כדי לתת שם לתצוגה.`}
                    </p>
                  </Card>
                )}

                <Card className="overflow-hidden p-0">
                  <div className="border-b border-border px-5 py-3">
                    <h3 className="text-sm font-semibold text-foreground">ביצועי לינקים — פירוט</h3>
                    <p className="mt-0.5 text-[11px] text-muted">
                      כולל לינקים מתנועת GA, מלקוחות רשומים, ומלינקים שנוצרו באדמין — גם בלי תנועה
                      בטווח. קודים בלי שם מופיעים ראשונים לעריכה.
                    </p>
                    {linkLabelError && (
                      <p className="mt-2 text-xs text-danger">{linkLabelError}</p>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm" dir="rtl">
                      <thead>
                        <tr className="border-b border-border bg-white/[0.02] text-xs text-muted">
                          <th className="px-4 py-2.5 text-right font-medium">לינק</th>
                          <th className="px-4 py-2.5 text-right font-medium">מקור</th>
                          <th className="px-4 py-2.5 text-center font-medium">מבקרים</th>
                          <th className="px-4 py-2.5 text-center font-medium">חדשים</th>
                          <th className="px-4 py-2.5 text-center font-medium">סרטון</th>
                          <th className="px-4 py-2.5 text-center font-medium">% סרטון</th>
                          <th className="px-4 py-2.5 text-center font-medium">מחירים</th>
                          <th className="px-4 py-2.5 text-center font-medium">% מחירים</th>
                          <th className="px-4 py-2.5 text-center font-medium">לידים</th>
                          <th className="px-4 py-2.5 text-center font-medium">% ליד</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {linkDetailRows.map((row) => {
                          const hasLead = row.leadUsers > 0
                          const needsName = !labelFor(row.content)
                          return (
                            <tr
                              key={row.content}
                              style={
                                needsName
                                  ? {
                                      background:
                                        'color-mix(in srgb, var(--color-secondary) 10%, transparent)',
                                    }
                                  : hasLead
                                    ? {
                                        background:
                                          'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                                      }
                                    : undefined
                              }
                            >
                              <td className="px-4 py-2.5">
                                <LinkLabelEditor
                                  contentCode={row.content}
                                  displayLabel={labelFor(row.content)}
                                  saving={savingCode === row.content.trim().toLowerCase()}
                                  onSave={async (name) => {
                                    await saveLabel(row.content, name)
                                  }}
                                />
                              </td>
                              <td className="px-4 py-2.5 text-muted">
                                {row.source ? utmSourceLabel(row.source) : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-center tabular-nums text-muted">
                                {formatNumber(row.users)}
                              </td>
                              <td className="px-4 py-2.5 text-center tabular-nums text-muted">
                                {formatNumber(row.newUsers)}
                              </td>
                              <td className="px-4 py-2.5 text-center tabular-nums text-muted">
                                {formatNumber(row.videoViewUsers)}
                              </td>
                              <td className="px-4 py-2.5 text-center tabular-nums text-muted">
                                {formatRate(ratePct(row.videoViewUsers, row.users))}
                              </td>
                              <td className="px-4 py-2.5 text-center tabular-nums text-muted">
                                {formatNumber(row.plansViewUsers)}
                              </td>
                              <td className="px-4 py-2.5 text-center tabular-nums text-muted">
                                {formatRate(ratePct(row.plansViewUsers, row.users))}
                              </td>
                              <td
                                className="px-4 py-2.5 text-center tabular-nums"
                                style={
                                  hasLead
                                    ? { color: 'var(--color-accent)', fontWeight: 600 }
                                    : { color: 'var(--color-muted)' }
                                }
                              >
                                {formatNumber(row.leadUsers)}
                              </td>
                              <td
                                className="px-4 py-2.5 text-center tabular-nums"
                                style={
                                  hasLead
                                    ? { color: 'var(--color-accent)', fontWeight: 600 }
                                    : { color: 'var(--color-muted)' }
                                }
                              >
                                {formatRate(ratePct(row.leadUsers, row.users))}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </section>

          {/* Plans + contact progression */}
          <section className="space-y-3">
            <SectionHeader
              icon={<MessageCircle size={16} className="text-secondary" />}
              title="מחירים ויצירת קשר"
            />
            <Card className="p-5">
              <FunnelChart
                loading={loading}
                infoTooltip={INTEREST_INFO}
                steps={[
                  { label: 'ראו מחירים', value: data.productInterest.plansViewedUsers },
                  { label: 'פתחו טופס', value: data.contact.openUsers },
                  { label: 'השאירו פרטים', value: data.contact.leadUsers },
                ]}
                overallRate={data.productInterest.plansToLeadRate}
                overallLabel="המרה ממחירים לליד"
              />
              {plansDropInsight && (
                <p className="mt-4 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-foreground">
                  {plansDropInsight}
                </p>
              )}
            </Card>

            <button
              type="button"
              onClick={() => setShowActivationDetails((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              {showActivationDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              אפשרויות הפעלה ומסלולים
            </button>
            {showActivationDetails && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-5">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">בחירת מסלול</h3>
                  <p className="mb-3 text-xs text-muted">
                    בחרו מסלול: {formatNumber(data.productInterest.planSelectedUsers)} · הופעלו
                    מניסיון: {formatNumber(data.productInterest.trialActivatedUsers)}
                  </p>
                  <RankedBarChart
                    loading={loading}
                    unavailable={data.productInterest.byPlanUnavailable}
                    unavailableDescription="פירוט לפי תוכנית עדיין לא זמין."
                    items={(data.productInterest.byPlan ?? []).map((r) => ({
                      label: r.label,
                      value: r.users,
                    }))}
                    emptyTitle="אין בחירות מסלול"
                    emptyDescription="בטווח שנבחר אף משתמש לא בחר מסלול."
                    color="var(--color-tertiary)"
                  />
                </Card>
                <Card className="p-5">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">מקורות הפעלה</h3>
                  <RankedBarChart
                    loading={loading}
                    unavailable={data.productInterest.activationBySourceUnavailable}
                    unavailableDescription="פירוט מקורות הפעלה עדיין לא זמין."
                    items={(data.productInterest.activationBySource ?? []).map((r) => ({
                      label: r.label,
                      value: r.users,
                    }))}
                    emptyTitle="אין נתוני הפעלה"
                    emptyDescription="בטווח שנבחר אין צפיות באפשרויות הפעלה."
                    color="var(--color-accent)"
                  />
                </Card>
              </div>
            )}
          </section>

          {/* Contact source breakdowns only */}
          <section className="space-y-3">
            <SectionHeader
              icon={<MessageCircle size={16} className="text-secondary" />}
              title="יצירת קשר — לפי מקור"
            />
            {contactSourceUnavailable ? (
              <Card className="p-5">
                <EmptyState
                  compact
                  icon={<MessageCircle size={22} />}
                  title="פירוט לפי מקור עדיין לא זמין"
                  description="כש-contact_source יהיה זמין ב-GA4, יוצגו כאן פתיחות טופס ולידים לפי מקור."
                />
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-5">
                  <h3 className="mb-4 text-sm font-semibold text-foreground">
                    פתיחות טופס לפי מקור
                  </h3>
                  <SimpleDonut
                    loading={loading}
                    unavailable={data.contact.opensBySourceUnavailable}
                    unavailableDescription="פירוט פתיחות לפי מקור עדיין לא זמין."
                    slices={toDonutSlices(data.contact.opensBySource)}
                    centerLabel="פתיחות"
                    showLegendPercent
                    emptyTitle="אין פתיחות עם מקור"
                    emptyDescription="בטווח שנבחר לא נפתחו טפסים עם מקור מזוהה."
                  />
                </Card>
                <Card className="p-5">
                  <h3 className="mb-4 text-sm font-semibold text-foreground">לידים לפי מקור</h3>
                  <SimpleDonut
                    loading={loading}
                    unavailable={data.contact.bySourceUnavailable}
                    unavailableDescription="פירוט לידים לפי מקור עדיין לא זמין."
                    slices={toDonutSlices(data.contact.bySource)}
                    centerLabel="לידים"
                    showLegendPercent
                    emptyTitle="אין לידים עם מקור"
                    emptyDescription="בטווח שנבחר לא נשלחו פניות עם מקור מזוהה."
                  />
                </Card>
              </div>
            )}
          </section>

          {/* Product usage divider */}
          <div className="relative py-2">
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
            <div className="relative mx-auto flex w-fit flex-col items-center gap-1 rounded-full border border-border bg-surface px-5 py-2 shadow-card">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-secondary" />
                <span className="text-sm font-semibold text-foreground">שימוש במוצר</span>
              </div>
              <p className="text-[11px] text-muted">מה קורה אחרי שמבקרים נכנסים למערכת</p>
            </div>
          </div>

          {/* Login funnel */}
          <section className="space-y-3">
            <SectionHeader
              icon={<LogIn size={16} className="text-secondary" />}
              title="התחברות"
            />
            <Card className="p-5">
              <FunnelChart
                loading={loading}
                compact
                steps={[
                  { label: 'ראו מסך התחברות', value: data.login.viewedUsers },
                  { label: 'התחילו התחברות', value: data.login.startedUsers },
                  { label: 'התחברו בהצלחה', value: data.login.successfulUsers },
                ]}
                overallRate={loginCompletion}
                overallLabel="השלימו התחברות"
              />
              {(data.login.errorCount > 0 || data.login.signUpUsers > 0) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.login.errorCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/5 px-3 py-1.5 text-xs font-medium text-foreground">
                      <AlertTriangle size={12} className="text-warning" />
                      {formatNumber(data.login.errorCount)} שגיאות התחברות
                    </span>
                  )}
                  {data.login.signUpUsers > 0 && (
                    <span className="inline-flex items-center rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs text-muted">
                      נרשמו: {formatNumber(data.login.signUpUsers)} משתמשים ייחודיים
                    </span>
                  )}
                </div>
              )}
            </Card>
          </section>

          {/* Event creation */}
          <section className="space-y-3">
            <SectionHeader
              icon={<Package size={16} className="text-secondary" />}
              title="יצירת אירוע"
            />
            <Card className="p-5">
              <p className="mb-4 text-xs text-muted">
                התחילו:{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatNumber(data.eventCreation.startUsers)}
                </span>
                {' · '}
                יצרו:{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatNumber(data.eventCreation.creatorUsers)}
                </span>
                {' · '}
                סה״כ אירועים:{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatNumber(data.eventCreation.eventCount)}
                </span>
                {eventCreationCompletion !== null && (
                  <>
                    {' · '}
                    השלמה:{' '}
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatRate(eventCreationCompletion)}
                    </span>
                  </>
                )}
              </p>
              {data.eventCreation.methodUnavailable ? (
                <EmptyState
                  compact
                  icon={<Package size={20} />}
                  title="אופן יצירה עדיין לא זמין"
                  description="פירוט מאפס / מתבנית יתרענן כש-creation_method או method יהיו זמינים ב-GA4."
                />
              ) : (
                <>
                  <h3 className="mb-3 text-sm font-semibold text-foreground">אופן יצירת אירוע</h3>
                  <SimpleDonut
                    loading={loading}
                    slices={[
                      {
                        label: 'חדש / מאפס',
                        value: data.eventCreation.scratchCount ?? 0,
                        color: 'var(--color-primary)',
                      },
                      {
                        label: 'מתבנית',
                        value: data.eventCreation.templateCount ?? 0,
                        color: 'var(--color-secondary)',
                      },
                    ]}
                    centerLabel="אירועים"
                    showLegendPercent
                    emptyTitle={
                      data.eventCreation.eventCount > 0
                        ? 'אין פירוט אופן יצירה'
                        : 'אין נתוני יצירה'
                    }
                    emptyDescription={
                      data.eventCreation.eventCount > 0
                        ? `נוצרו ${formatNumber(data.eventCreation.eventCount)} אירועים, אך חסר פירוט מאפס/מתבנית בטווח.`
                        : 'עדיין לא נוצרו אירועים בטווח שנבחר.'
                    }
                  />
                </>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
