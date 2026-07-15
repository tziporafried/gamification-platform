import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  Route,
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
import { AffiliateFilterBar, AffiliateMetricsStrip, ratePct } from './AffiliateFilter'
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

/** Temporary review wrapper — grayed candidates pending deletion approval */
function RemovalCandidate({ reason, children }: { reason: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-muted/60 bg-[color-mix(in_srgb,var(--color-muted)_8%,var(--color-surface))] opacity-60 grayscale">
      <p className="border-b border-dashed border-muted/40 px-4 py-2 text-[11px] font-medium text-muted">
        מועמד להסרה · {reason}
      </p>
      <div className="p-3">{children}</div>
    </div>
  )
}

export function AdminAnalyticsDashboard() {
  const [preset, setPreset] = useState<AnalyticsDatePreset>('7d')
  const [startDate, setStartDate] = useState(() => daysAgoYmd(6))
  const [endDate, setEndDate] = useState(() => todayYmd())
  const [data, setData] = useState<AnalyticsDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AnalyticsFetchError | null>(null)
  const [showAllFaq, setShowAllFaq] = useState(false)
  const [showExtraOverview, setShowExtraOverview] = useState(false)
  const [showActivationDetails, setShowActivationDetails] = useState(false)
  const [selectedAffiliates, setSelectedAffiliates] = useState<string[]>([])

  const {
    labelFor,
    displayLabel: linkDisplayLabel,
    saveLabel,
    createShareLink,
    savingCode,
    error: linkLabelError,
  } = useUtmLinkLabels()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAnalyticsDashboard({
        preset,
        startDate: preset === 'custom' ? startDate : undefined,
        endDate: preset === 'custom' ? endDate : undefined,
        // empty = all tagged affiliates for the trend series
        utmContents: selectedAffiliates,
      })
      setData(result)
    } catch (err) {
      setData(null)
      if (err instanceof AnalyticsFetchError) {
        setError(err)
      } else {
        setError(new AnalyticsFetchError('שגיאה בטעינת אנליטיקות', 'UNKNOWN'))
      }
    } finally {
      setLoading(false)
    }
  }, [preset, startDate, endDate, selectedAffiliates])

  useEffect(() => {
    void load()
  }, [load])

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

  /** Performance rows + pre-registered labels that have no traffic yet. */
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
        })
      } else if (row.users > existing.users) {
        byCode.set(key, { ...existing, users: row.users })
      }
    }

    // Do not auto-list created links with zero traffic — labels still map names
    // once GA reports appear for that content code.

    return [...byCode.values()]
      .filter(
        (row) =>
          row.users > 0 ||
          row.videoViewUsers > 0 ||
          row.plansViewUsers > 0 ||
          row.leadUsers > 0,
      )
      .sort((a, b) => {
        if (b.users !== a.users) return b.users - a.users
        return (labelFor(a.content) ?? a.content).localeCompare(
          labelFor(b.content) ?? b.content,
          'he',
        )
      })
  }, [data, labelFor])

  const affiliateOptions = useMemo(
    () =>
      linkDetailRows.map((row) => ({
        code: row.content.trim().toLowerCase(),
        name: labelFor(row.content) ?? row.content,
      })),
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
    // Trend is affiliate-scoped — only warn when affiliate traffic exists but series is flat.
    const hasAffiliateSignal =
      filteredLinkRows.some((r) => r.users > 0) ||
      (selectedAffiliates.length === 0 && data.utm.taggedVisitors > 0)
    if (!hasAffiliateSignal) return false
    const hasTrend = data.timeSeries.days.some(
      (d) =>
        d.visitors > 0 ||
        d.newUsers > 0 ||
        d.videoView > 0 ||
        d.viewPlans > 0 ||
        d.generateLead > 0,
    )
    return !hasTrend
  }, [data, filteredLinkRows, selectedAffiliates])

  return (
    <div className="space-y-7">
      {/* Header — unchanged */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeader
            size="md"
            icon={<BarChart3 size={20} className="text-secondary" />}
            title="ניתוח נתונים"
            subtitle={`טווח: ${rangeLabel}`}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="shrink-0 gap-1.5 self-start"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
            רענון
          </Button>
        </div>
        <DateRangePicker
          preset={preset}
          startDate={startDate}
          endDate={endDate}
          onPresetChange={handlePresetChange}
          onCustomChange={handleCustomChange}
          disabled={loading}
        />
      </div>

      <UtmShareLinkGenerator
        createShareLink={createShareLink}
        generating={!!savingCode}
        error={linkLabelError}
      />

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
          <Button variant="outline" size="sm" onClick={() => void load()}>
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
          {/* Affiliate frame: filter + KPI boxes + trend only */}
          <section>
            <Card className="space-y-4 border-2 border-secondary/40 p-5 sm:p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Filter size={18} className="text-secondary" />
                    <h2 className="text-base font-semibold text-foreground">נתוני אפיליאייטים</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    המסגרת הזו מסוננת לפי אפיליאייט — הקוביות וגרף המגמה בלבד. כל שאר הדאשבורד
                    למטה מציג את האתר כולו.
                  </p>
                </div>
                <span className="rounded-full border border-secondary/40 bg-secondary/10 px-2.5 py-1 text-[11px] font-medium text-foreground">
                  {affiliatesFiltered ? 'מסונן' : 'כל האפיליאייטים'}
                </span>
              </div>

              <AffiliateFilterBar
                options={affiliateOptions}
                selected={selectedAffiliates}
                onChange={setSelectedAffiliates}
              />
              <AffiliateMetricsStrip
                rows={filteredLinkRows}
                loading={loading}
                filtered={affiliatesFiltered}
              />

              <div className="border-t border-border pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-secondary" />
                    <h3 className="text-sm font-semibold text-foreground">מגמה לפי אפיליאייט</h3>
                  </div>
                  <p className="text-[11px] text-muted">
                    {affiliatesFiltered
                      ? 'מסונן לפי הבחירה למעלה'
                      : 'כל התנועה שמגיעה מלינקי אפיליאייט'}
                  </p>
                </div>
                {trendLooksEmpty && (
                  <div className="mb-4 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
                    מגמת האפיליאייט ריקה. אם יש תנועה באתר אבל לא כאן — ייתכן שעדיין אין כניסות
                    מלינקים מסומנים בטווח, או שצריך לדפלוי מחדש את{' '}
                    <code className="text-xs">ga4-dashboard</code>.
                  </div>
                )}
                <TrendLineChart
                  days={data.timeSeries.days}
                  loading={loading}
                  unavailable={data.timeSeries.unavailable}
                  height={420}
                />
              </div>
            </Card>
          </section>

          {/* Compact KPI strip */}
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
                value={data.video.startedUsers}
                hint={
                  data.overview.homepageUsers > 0
                    ? formatRate(
                        calcStepRate(data.overview.homepageUsers, data.video.startedUsers),
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

          {insights.length > 0 && (
            <section className="space-y-2">
              <SectionHeader
                icon={<AlertTriangle size={14} className="text-warning" />}
                title="דורש תשומת לב"
              />
              <InsightCards insights={insights} loading={loading} />
            </section>
          )}

          {/* Video */}
          <section className="space-y-3">
            <SectionHeader
              icon={<Video size={16} className="text-secondary" />}
              title="ביצועי הסרטון"
            />
            <Card className="p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">מסלול הצפייה</h3>
              <VideoProgressTrack
                loading={loading}
                milestones={videoMilestones}
                baseUsers={data.video.startedUsers}
                unavailable={data.video.milestonesUnavailable}
                unavailableNote="אבני דרך 25% / 50% / 75% עדיין לא זמינות לדיווח. מוצגים התחלה וסיום בלבד."
              />
              {videoInsight && (
                <p
                  className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                    videoInsight.kind === 'positive'
                      ? 'border-success/30 bg-success/5'
                      : 'border-warning/30 bg-warning/5'
                  }`}
                >
                  {videoInsight.text}
                </p>
              )}
            </Card>
          </section>

          {/* FAQ */}
          <section className="space-y-3">
            <SectionHeader
              icon={<HelpCircle size={16} className="text-secondary" />}
              title="שאלות נפוצות"
            />
            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-muted">פתחו שאלות</span>
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {loading ? '—' : formatNumber(data.homepageInterest.faqUsers)}
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
                <p className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-foreground">
                  {faqInsight}
                </p>
              )}
              <FaqBarChart
                loading={loading}
                unavailable={data.homepageInterest.questionsUnavailable}
                items={visibleFaq.map((q) => ({ question: q.question, users: q.users }))}
              />
            </Card>
          </section>

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

            <Card className="p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">מקורות תנועה</h3>
              <SimpleDonut
                loading={loading}
                unavailable={data.trafficSources.unavailable}
                unavailableTitle="מקורות תנועה לא זמינים"
                unavailableDescription="לא ניתן לטעון את התפלגות מקורות התנועה כרגע."
                emptyTitle="אין נתוני מקורות"
                emptyDescription="בטווח שנבחר לא זוהו מקורות תנועה."
                slices={toDonutSlices(data.trafficSources.items)}
                centerValue={formatNumber(data.trafficSources.totalUsers || data.overview.homepageUsers)}
                centerLabel="מבקרים"
                showLegendPercent
                size="lg"
              />
            </Card>
          </section>

          {/* UTM / shared-link attribution */}
          <section className="space-y-3">
            <SectionHeader
              icon={<Link2 size={16} className="text-secondary" />}
              title="לינקים ומקורות שיתוף"
            />

            {data.utm.unavailable ? (
              <Card className="p-5">
                <EmptyState
                  compact
                  icon={<Link2 size={22} />}
                  title="אנליטיקת לינקים מסומנים עדיין לא זמינה"
                  description={`יש לרשום ב-GA4 כ-Event-scoped Custom Dimensions לפחות את utm_source ו-utm_content. פרמטרים אופציונליים (utm_medium, utm_campaign) אינם נדרשים ללינקים קצרים.`}
                />
              </Card>
            ) : data.utm.taggedVisitors <= 0 && linkDetailRows.length === 0 ? (
              <Card className="p-5">
                <EmptyState
                  compact
                  icon={<Link2 size={22} />}
                  title="עדיין אין כניסות מלינקים מסומנים בתקופה שנבחרה"
                  description="צרו לינק בראש העמוד ושתפו אותו — כשייכנסו מבקרים הנתונים יופיעו כאן."
                />
              </Card>
            ) : (
              <>
                {data.utm.unavailableParams.length > 0 && (
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

                {linkDetailRows.length > 0 && (
                  <Card className="overflow-hidden p-0">
                    <div className="border-b border-border px-5 py-3">
                      <h3 className="text-sm font-semibold text-foreground">ביצועי לינקים — פירוט</h3>
                      <p className="mt-0.5 text-[11px] text-muted">
                        כולל משתמשים חדשים ואחוזי המרה. מוצגים רק לינקים עם תנועה בתקופה שנבחרה (לא מושפע מסינון המסגרת למעלה).
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
                            return (
                              <tr
                                key={row.content}
                                style={
                                  hasLead
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
                )}
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
                  description="פירוט מאפס / מתבנית יתרענן כש-creation_method יהיה זמין."
                />
              ) : (
                <>
                  <h3 className="mb-3 text-sm font-semibold text-foreground">אופן יצירת אירוע</h3>
                  <SimpleDonut
                    loading={loading}
                    slices={[
                      {
                        label: 'מאפס',
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
                    emptyTitle="אין נתוני יצירה"
                    emptyDescription="עדיין לא נוצרו אירועים בטווח שנבחר."
                  />
                </>
              )}
            </Card>
          </section>

          {/* Review zone: candidates for removal */}
          <section className="space-y-4 border-t border-dashed border-muted/50 pt-8">
            <div className="rounded-xl border border-dashed border-muted/50 bg-[color-mix(in_srgb,var(--color-muted)_6%,transparent)] px-4 py-3">
              <h2 className="text-sm font-semibold text-muted">מועמדים להסרה</h2>
              <p className="mt-1 text-xs text-muted">
                וידג׳טים כפולים / פחות שימושיים — מסומנים באפור. אשרי מחיקה ואסיר אותם.
              </p>
            </div>

            <div className="space-y-4">
              <RemovalCandidate reason="חוזר על סיכום מהיר + משפך מחירים/ליד">
                <Card className="space-y-1 p-5">
                  <div className="mb-1 flex items-center gap-2">
                    <Route size={16} className="text-secondary" />
                    <h2 className="text-sm font-semibold text-foreground">מסלול ההתעניינות</h2>
                  </div>
                  <FunnelChart
                    loading={loading}
                    infoTooltip={INTEREST_INFO}
                    steps={[
                      { label: 'מבקרים', value: data.overview.homepageUsers },
                      { label: 'צפו בסרטון', value: data.video.startedUsers },
                      { label: 'צפו במחירים', value: data.overview.pricingUsers },
                      { label: 'פתחו טופס', value: data.contact.openUsers },
                      { label: 'השאירו פרטים', value: data.overview.leadUsers },
                    ]}
                    overallRate={data.overview.leadConversionRate}
                    overallLabel="המרה ממבקר לליד"
                  />
                </Card>
              </RemovalCandidate>

              <RemovalCandidate reason="חוזר על מסלול הצפייה (השלמה כבר מופיעה שם)">
                <Card className="flex flex-col justify-center p-5">
                  <h3 className="mb-4 text-sm font-semibold text-foreground">שיעור השלמת סרטון</h3>
                  <SimpleDonut
                    loading={loading}
                    size="lg"
                    slices={[
                      {
                        label: 'השלימו',
                        value: data.video.completedUsers,
                        color: 'var(--color-secondary)',
                      },
                      {
                        label: 'לא השלימו',
                        value: Math.max(0, data.video.startedUsers - data.video.completedUsers),
                        color: 'var(--color-border)',
                      },
                    ]}
                    centerValue={formatRate(data.video.completionRate)}
                    centerLabel="השלימו את הסרטון"
                    emptyTitle="אין צפיות"
                    emptyDescription="בטווח שנבחר אף משתמש לא התחיל לצפות בסרטון."
                  />
                </Card>
              </RemovalCandidate>

              {linkDetailRows.some((r) => r.users > 0) && (
                <RemovalCandidate reason="הטבלה למעלה כבר מציגה מבקרים ואחוז ליד לפי לינק">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="p-5">
                      <h3 className="mb-4 text-sm font-semibold text-foreground">ביצועי לינקים</h3>
                      <RankedBarChart
                        loading={loading}
                        unavailable={
                          data.utm.linkPerformance === null && data.utm.contentBreakdown === null
                        }
                        unavailableDescription="יש לרשום ב-GA4 את הפרמטר utm_content כ-Event-scoped Custom Dimension."
                        emptyTitle="אין לינקים בסינון"
                        emptyDescription="נסו לבחור אפיליאייט אחר או לנקות סינון."
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
                        color="var(--color-accent)"
                      />
                    </Card>
                    <Card className="p-5">
                      <h3 className="mb-4 text-sm font-semibold text-foreground">
                        המרה לליד לפי לינק
                      </h3>
                      <RankedBarChart
                        loading={loading}
                        emptyTitle="אין המרות לליד"
                        emptyDescription="עדיין אין לידים מהלינקים שנבחרו."
                        valueLabel="המרה %"
                        items={linkDetailRows
                          .filter((r) => r.users > 0)
                          .map((r) => ({
                            label: linkDisplayLabel(r.content),
                            value: ratePct(r.leadUsers, r.users) ?? 0,
                          }))
                          .sort((a, b) => b.value - a.value)}
                        color="var(--color-secondary)"
                      />
                    </Card>
                  </div>
                </RemovalCandidate>
              )}

              <RemovalCandidate reason="חוזר על משפך מחירים → ליד">
                <Card className="p-5">
                  <h3 className="mb-4 text-sm font-semibold text-foreground">
                    דונאט המרה ממחירים לליד
                  </h3>
                  <SimpleDonut
                    loading={loading}
                    slices={[
                      {
                        label: 'לידים',
                        value: data.productInterest.leadUsers,
                        color: 'var(--color-secondary)',
                      },
                      {
                        label: 'לא הפכו לליד',
                        value: Math.max(
                          0,
                          data.productInterest.plansViewedUsers - data.productInterest.leadUsers,
                        ),
                        color: 'var(--color-border)',
                      },
                    ]}
                    centerValue={formatRate(data.productInterest.plansToLeadRate)}
                    centerLabel="המרה ממחירים לליד"
                    emptyTitle="אין צפיות במחירים"
                    emptyDescription="בטווח שנבחר אין נתונים."
                  />
                </Card>
              </RemovalCandidate>

              <RemovalCandidate reason="חוזר על משפך ההתחברות">
                <Card className="p-5">
                  <h3 className="mb-4 text-sm font-semibold text-foreground">
                    דונאט השלמת התחברות
                  </h3>
                  <SimpleDonut
                    loading={loading}
                    slices={[
                      {
                        label: 'השלימו',
                        value: data.login.successfulUsers,
                        color: 'var(--color-secondary)',
                      },
                      {
                        label: 'לא השלימו',
                        value: Math.max(0, data.login.startedUsers - data.login.successfulUsers),
                        color: 'var(--color-border)',
                      },
                    ]}
                    centerValue={formatRate(loginCompletion)}
                    centerLabel="השלימו התחברות"
                    emptyTitle="אין ניסיונות התחברות"
                    emptyDescription="בטווח שנבחר אין נתוני התחברות."
                  />
                </Card>
              </RemovalCandidate>

              <RemovalCandidate reason="משפך דו-שלבי דל — המספרים כבר בשורת הסיכום של יצירת אירוע">
                <Card className="p-5">
                  <FunnelChart
                    loading={loading}
                    compact
                    steps={[
                      { label: 'התחילו יצירת אירוע', value: data.eventCreation.startUsers },
                      { label: 'יצרו אירוע', value: data.eventCreation.creatorUsers },
                    ]}
                    overallRate={eventCreationCompletion}
                    overallLabel="השלימו יצירת אירוע"
                  />
                </Card>
              </RemovalCandidate>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
