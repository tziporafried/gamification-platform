import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  LogIn,
  MessageCircle,
  MousePointerClick,
  Package,
  RefreshCw,
  Route,
  Sparkles,
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
import { SummaryFunnel } from './SummaryFunnel'
import { HorizontalBars } from './HorizontalBars'
import { SimpleDonut } from './SimpleDonut'
import { InsightCards } from './InsightCards'
import { VideoProgressTrack } from './VideoProgressTrack'
import { fetchAnalyticsDashboard } from './fetchDashboard'
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

export function AdminAnalyticsDashboard() {
  const [preset, setPreset] = useState<AnalyticsDatePreset>('7d')
  const [startDate, setStartDate] = useState(() => daysAgoYmd(6))
  const [endDate, setEndDate] = useState(() => todayYmd())
  const [data, setData] = useState<AnalyticsDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AnalyticsFetchError | null>(null)
  const [showAllFaq, setShowAllFaq] = useState(false)
  const [showExtraOverview, setShowExtraOverview] = useState(false)
  const [showPlansDetails, setShowPlansDetails] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAnalyticsDashboard({
        preset,
        startDate: preset === 'custom' ? startDate : undefined,
        endDate: preset === 'custom' ? endDate : undefined,
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
  }, [preset, startDate, endDate])

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
    const steps = [
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
    return steps
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
  const visibleFaq = showAllFaq ? faqQuestions : faqQuestions.slice(0, 5)

  const topCta = data?.ctas.byName?.[0] ?? null
  const topCtaLocation = data?.ctas.byLocation?.[0] ?? null

  return (
    <div className="space-y-8">
      {/* 1. Date filter */}
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
          {/* 2. Attention required */}
          <section className="space-y-3">
            <SectionHeader
              icon={<AlertTriangle size={16} className="text-warning" />}
              title="דורש תשומת לב"
            />
            <InsightCards insights={insights} loading={loading} />
          </section>

          {/* 3. Primary conversion journey */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Route size={16} className="text-secondary" />}
              title="מסלול ההמרה"
              subtitle="סקירת קהלים לפי שלבים בטווח — לא מסלול רציף ברמת משתמש"
            />
            <Card className="p-5">
              <SummaryFunnel
                loading={loading}
                note="כל שלב מציג משתמשים ייחודיים שביצעו את הפעולה בטווח. אחוז ההמרה הוא יחס בין גודל הקהלים — לא הוכחה שכל משתמש עבר בכל השלבים."
                steps={[
                  { label: 'מבקרים', value: data.overview.homepageUsers },
                  {
                    label: 'צפו בסרטון',
                    value: data.video.startedUsers,
                    stepRate: calcStepRate(data.overview.homepageUsers, data.video.startedUsers),
                  },
                  {
                    label: 'צפו במחירים',
                    value: data.overview.pricingUsers,
                    stepRate: calcStepRate(data.video.startedUsers, data.overview.pricingUsers),
                  },
                  {
                    label: 'פתחו טופס',
                    value: data.contact.openUsers,
                    stepRate: calcStepRate(data.overview.pricingUsers, data.contact.openUsers),
                  },
                  {
                    label: 'השאירו פרטים',
                    value: data.overview.leadUsers,
                    stepRate: calcStepRate(data.contact.openUsers, data.overview.leadUsers),
                  },
                ]}
                overallRate={data.overview.leadConversionRate}
                overallLabel="המרת מבקר לליד"
              />
            </Card>
          </section>

          {/* 4. General overview */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Users size={16} className="text-secondary" />}
              title="סקירה כללית"
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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
                icon={<Video size={16} />}
                accent="secondary"
              />
              <KpiCard
                loading={loading}
                label="צפו במחירים"
                value={data.overview.pricingUsers}
                icon={<Sparkles size={16} />}
                accent="tertiary"
              />
              <KpiCard
                loading={loading}
                label="לידים"
                value={data.overview.leadUsers}
                icon={<MessageCircle size={16} />}
                accent="primary"
              />
              <KpiCard
                loading={loading}
                label="שיעור המרה לליד"
                value={formatRate(data.overview.leadConversionRate)}
                accent="secondary"
              />
              <KpiCard
                loading={loading}
                label="יצרו אירוע"
                value={data.overview.eventCreators}
                hint="משתמשים ייחודיים"
                icon={<Package size={16} />}
                accent="tertiary"
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
                  hint="ספירת צפיות (לא משתמשים)"
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
                  label="אירועים שנוצרו"
                  value={data.overview.eventsCreated}
                  hint="ספירת אירועים"
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

          {/* 5. Video performance */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Video size={16} className="text-secondary" />}
              title="ביצועי הסרטון"
            />
            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">שיעור השלמה</p>
                  <p className="text-3xl font-bold tabular-nums text-foreground">
                    {loading ? '—' : formatRate(data.video.completionRate)}
                  </p>
                </div>
                <p className="text-xs text-muted">
                  {formatNumber(data.video.startedUsers)} התחילו ·{' '}
                  {formatNumber(data.video.completedUsers)} סיימו
                </p>
              </div>
              <VideoProgressTrack
                loading={loading}
                milestones={videoMilestones}
                insight={videoInsight}
                unavailable={data.video.milestonesUnavailable}
                unavailableNote="אבני דרך 25% / 50% / 75% עדיין לא זמינות לדיווח (ייתכן שחסר מימד מותאם). מוצגים התחלה וסיום בלבד."
              />
            </Card>
          </section>

          {/* 6. Homepage interest */}
          <section className="space-y-4">
            <SectionHeader
              icon={<HelpCircle size={16} className="text-secondary" />}
              title="עניין בדף הבית"
            />

            <div className="grid gap-4 lg:grid-cols-5">
              <KpiCard
                loading={loading}
                label="פתחו שאלות נפוצות"
                value={data.homepageInterest.faqUsers}
                hint="משתמשים ייחודיים"
                className="lg:col-span-1"
                accent="secondary"
              />
              <Card className="space-y-4 p-5 lg:col-span-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">שאלות מובילות</h3>
                  {faqQuestions.length > 5 && (
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
                <HorizontalBars
                  loading={loading}
                  unavailable={data.homepageInterest.questionsUnavailable}
                  unavailableDescription="פירוט השאלות עדיין לא זמין לדיווח. שאר הדשבורד ממשיך לעבוד."
                  items={visibleFaq.map((q, i) => ({
                    label: `${i + 1}. ${q.question}`,
                    value: q.users,
                  }))}
                  emptyTitle="אין פתיחות FAQ"
                  emptyDescription="בטווח שנבחר אף משתמש לא פתח שאלות נפוצות."
                />
              </Card>
            </div>

            <Card className="space-y-4 p-5">
              <SectionHeader
                icon={<MousePointerClick size={14} className="text-secondary" />}
                title="לחיצות CTA"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface-elevated p-4">
                  <p className="text-xs text-muted">CTA מוביל</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {loading ? '—' : topCta?.label ?? 'אין נתונים'}
                  </p>
                  {topCta && (
                    <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                      {formatNumber(topCta.users)}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-border bg-surface-elevated p-4">
                  <p className="text-xs text-muted">מיקום מוביל</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {loading ? '—' : topCtaLocation?.label ?? 'אין נתונים'}
                  </p>
                  {topCtaLocation && (
                    <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                      {formatNumber(topCtaLocation.users)}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  CTA לפי מיקום
                </h3>
                {data.ctas.byNameAndLocationUnavailable ? (
                  <EmptyState
                    compact
                    icon={<BarChart3 size={22} />}
                    title="פירוט משולב עדיין לא זמין"
                    description="לא ניתן לטעון את הטבלה המשולבת. מציגים דירוגים נפרדים כגיבוי."
                  />
                ) : !(data.ctas.byNameAndLocation?.length) ? (
                  <EmptyState
                    compact
                    icon={<BarChart3 size={22} />}
                    title="אין לחיצות CTA"
                    description="בטווח שנבחר לא נרשמו לחיצות."
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full min-w-[320px] text-sm">
                      <thead>
                        <tr className="border-b border-border bg-surface-elevated text-right text-xs text-muted">
                          <th className="px-3 py-2 font-medium">CTA</th>
                          <th className="px-3 py-2 font-medium">מיקום</th>
                          <th className="px-3 py-2 font-medium">משתמשים ייחודיים</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.ctas.byNameAndLocation ?? []).slice(0, 12).map((row) => (
                          <tr
                            key={`${row.name}-${row.location}`}
                            className="border-b border-border/70 last:border-0"
                          >
                            <td className="px-3 py-2 font-medium text-foreground">{row.name}</td>
                            <td className="px-3 py-2 text-muted">{row.location}</td>
                            <td className="px-3 py-2 tabular-nums text-foreground">
                              {formatNumber(row.users)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {(data.ctas.byNameAndLocationUnavailable ||
                  !data.ctas.byNameAndLocation?.length) && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="mb-2 text-xs font-semibold text-muted">לפי סוג</h4>
                      <HorizontalBars
                        loading={loading}
                        unavailable={data.ctas.byNameUnavailable}
                        items={(data.ctas.byName ?? []).map((r) => ({
                          label: r.label,
                          value: r.users,
                        }))}
                      />
                    </div>
                    <div>
                      <h4 className="mb-2 text-xs font-semibold text-muted">לפי מיקום</h4>
                      <HorizontalBars
                        loading={loading}
                        unavailable={data.ctas.byLocationUnavailable}
                        items={(data.ctas.byLocation ?? []).map((r) => ({
                          label: r.label,
                          value: r.users,
                        }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </section>

          {/* 7. Plans and contact */}
          <section className="space-y-4">
            <SectionHeader
              icon={<MessageCircle size={16} className="text-secondary" />}
              title="מחירים ויצירת קשר"
              subtitle="השוואת קהלי שלבים בטווח — לא funnel רציף ברמת משתמש"
            />
            <Card className="space-y-4 p-5">
              <SummaryFunnel
                loading={loading}
                steps={[
                  { label: 'ראו מחירים', value: data.productInterest.plansViewedUsers },
                  {
                    label: 'פתחו טופס',
                    value: data.contact.openUsers,
                    stepRate: data.productInterest.formOpenRate,
                  },
                  {
                    label: 'שלחו פרטים',
                    value: data.contact.leadUsers,
                    stepRate: data.contact.conversionRate,
                  },
                ]}
                overallRate={data.productInterest.plansToLeadRate}
                overallLabel="המרה ממחירים לליד"
              />
              {plansDropInsight && (
                <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-foreground">
                  {plansDropInsight}
                </p>
              )}
            </Card>

            <button
              type="button"
              onClick={() => setShowPlansDetails((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              {showPlansDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              פירוט מסלולים ומקורות
            </button>
            {showPlansDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <KpiCard
                    loading={loading}
                    label="בחרו מסלול"
                    value={data.productInterest.planSelectedUsers}
                    accent="secondary"
                  />
                  <KpiCard
                    loading={loading}
                    label="צפייה מהפעלת ניסיון"
                    value={data.productInterest.activationOptionsViewedUsers}
                    accent="muted"
                  />
                  <KpiCard
                    loading={loading}
                    label="הופעלו מניסיון"
                    value={data.productInterest.trialActivatedUsers}
                    accent="tertiary"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-5">
                    <h3 className="mb-4 text-sm font-semibold text-foreground">
                      בחירת מסלול לפי תוכנית
                    </h3>
                    <HorizontalBars
                      loading={loading}
                      unavailable={data.productInterest.byPlanUnavailable}
                      unavailableDescription="פירוט לפי תוכנית עדיין לא זמין."
                      items={(data.productInterest.byPlan ?? []).map((r) => ({
                        label: r.label,
                        value: r.users,
                      }))}
                      emptyTitle="אין בחירות מסלול"
                      emptyDescription="בטווח שנבחר אף משתמש לא בחר מסלול."
                    />
                  </Card>
                  <Card className="p-5">
                    <h3 className="mb-4 text-sm font-semibold text-foreground">
                      לידים לפי מקור פנייה
                    </h3>
                    <HorizontalBars
                      loading={loading}
                      unavailable={data.contact.bySourceUnavailable}
                      unavailableDescription="פירוט מקורות עדיין לא זמין."
                      items={(data.contact.bySource ?? []).map((r) => ({
                        label: r.label,
                        value: r.users,
                      }))}
                      emptyTitle="אין לידים עם מקור"
                      emptyDescription="בטווח שנבחר לא נשלחו פניות עם מקור מזוהה."
                    />
                  </Card>
                </div>
              </div>
            )}
          </section>

          {/* 8. Product usage — visually separate */}
          <section className="space-y-4 rounded-2xl border border-dashed border-border bg-surface-elevated/40 p-5">
            <SectionHeader
              icon={<Package size={16} className="text-secondary" />}
              title="שימוש במוצר"
              subtitle="מסלול אימוץ נפרד ממשפך הלידים השיווקי"
            />
            <Card className="p-5">
              <SummaryFunnel
                loading={loading}
                note="מסלול אימוץ לפי משתמשים ייחודיים בטווח. נרשמים מוצגים בנפרד בכרטיסיות למטה (אין איחוד ייחודי בין התחברות להרשמה בנתונים הזמינים)."
                steps={[
                  {
                    label: 'התחברו',
                    value: data.login.successfulUsers,
                  },
                  {
                    label: 'התחילו יצירת אירוע',
                    value: data.eventCreation.startUsers,
                    stepRate: calcStepRate(
                      data.login.successfulUsers,
                      data.eventCreation.startUsers,
                    ),
                  },
                  {
                    label: 'יצרו אירוע',
                    value: data.eventCreation.creatorUsers,
                    stepRate: calcStepRate(
                      data.eventCreation.startUsers,
                      data.eventCreation.creatorUsers,
                    ),
                  },
                ]}
              />
              <p className="mt-3 text-xs text-muted">
                נרשמו בטווח: {loading ? '—' : formatNumber(data.login.signUpUsers)} משתמשים ייחודיים
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                loading={loading}
                label="הגיעו למסך התחברות"
                value={data.login.viewedUsers}
                icon={<LogIn size={16} />}
                accent="muted"
              />
              <KpiCard
                loading={loading}
                label="התחברו בהצלחה"
                value={data.login.successfulUsers}
                accent="primary"
              />
              <KpiCard
                loading={loading}
                label="נרשמו"
                value={data.login.signUpUsers}
                accent="secondary"
              />
              <KpiCard
                loading={loading}
                label="שגיאות התחברות"
                value={data.login.errorCount}
                hint="ספירת אירועים"
                accent="muted"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <KpiCard
                loading={loading}
                label="אירועים שנוצרו"
                value={data.eventCreation.eventCount}
                hint="ספירת אירועים"
                accent="primary"
              />
              <KpiCard
                loading={loading}
                label="משתמשים שיצרו אירוע"
                value={data.eventCreation.creatorUsers}
                accent="secondary"
              />
            </div>

            <Card className="p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">לפי שיטת יצירה</h3>
              <SimpleDonut
                loading={loading}
                unavailable={data.eventCreation.methodUnavailable}
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
              />
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
