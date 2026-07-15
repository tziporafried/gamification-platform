import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  Eye,
  Home,
  LogIn,
  MousePointerClick,
  Sparkles,
  Users,
  Video,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
  MessageCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Spinner } from '@/components/ui/Spinner'
import { DateRangePicker } from './DateRangePicker'
import { KpiCard, formatRate } from './KpiCard'
import { SummaryFunnel } from './SummaryFunnel'
import { HorizontalBars } from './HorizontalBars'
import { SimpleDonut } from './SimpleDonut'
import { fetchAnalyticsDashboard } from './fetchDashboard'
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

export function AdminAnalyticsDashboard() {
  const [preset, setPreset] = useState<AnalyticsDatePreset>('7d')
  const [startDate, setStartDate] = useState(() => daysAgoYmd(6))
  const [endDate, setEndDate] = useState(() => todayYmd())
  const [data, setData] = useState<AnalyticsDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AnalyticsFetchError | null>(null)

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

  return (
    <div className="space-y-8">
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
            <p className="text-xs text-muted">
              חסרים: {error.missing.join(', ')}
            </p>
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
          {/* 1. Overview */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Home size={16} className="text-secondary" />}
              title="סקירה כללית"
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <KpiCard
                loading={loading}
                label="מבקרים בדף הבית"
                value={data.overview.homepageUsers}
                hint="משתמשים ייחודיים · pagePath = /"
                icon={<Users size={16} />}
                accent="primary"
              />
              <KpiCard
                loading={loading}
                label="צפיות בדף הבית"
                value={data.overview.homepageViews}
                hint="סה״כ page_view בנתיב /"
                icon={<Eye size={16} />}
                accent="secondary"
              />
              <KpiCard
                loading={loading}
                label="פתחו אפשרויות הפעלה"
                value={data.overview.pricingUsers}
                hint="view_plans · מודל Plans"
                icon={<Sparkles size={16} />}
                accent="tertiary"
              />
              <KpiCard
                loading={loading}
                label="הגיעו להתחברות"
                value={data.overview.loginViewUsers}
                icon={<LogIn size={16} />}
                accent="secondary"
              />
              <KpiCard
                loading={loading}
                label="השאירו פרטים"
                value={data.overview.leadUsers}
                icon={<MousePointerClick size={16} />}
                accent="primary"
              />
              <KpiCard
                loading={loading}
                label="אירועים שנוצרו"
                value={data.overview.eventsCreated}
                hint="ספירת אירועים (לא משתמשים)"
                icon={<Sparkles size={16} />}
                accent="tertiary"
              />
            </div>
          </section>

          {/* 2. Video */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Video size={16} className="text-secondary" />}
              title="ביצועי הסרטון"
            />
            <Card className="p-5">
              <div className="grid gap-6 md:grid-cols-2">
                <SummaryFunnel
                  loading={loading}
                  steps={[
                    { label: 'התחילו לצפות', value: data.video.startedUsers },
                    {
                      label: 'סיימו לצפות',
                      value: data.video.completedUsers,
                      stepRate: data.video.completionRate,
                    },
                  ]}
                  overallRate={data.video.completionRate}
                  overallLabel="שיעור השלמה"
                />
                <div className="flex flex-col justify-center gap-4 rounded-xl border border-border bg-surface-elevated p-5">
                  <div>
                    <p className="text-xs text-muted">שיעור השלמה</p>
                    <p className="mt-1 text-4xl font-bold tabular-nums text-foreground">
                      {loading ? '—' : formatRate(data.video.completionRate)}
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    משתמשים ייחודיים שסיימו לחלק באלה שהתחילו. אם אין התחלות צפייה —
                    מוצג מקף במקום חלוקה באפס.
                  </p>
                </div>
              </div>
            </Card>
          </section>

          {/* 3. Homepage interest */}
          <section className="space-y-4">
            <SectionHeader
              icon={<HelpCircle size={16} className="text-secondary" />}
              title="עניין בדף הבית"
            />
            <div className="grid gap-4 lg:grid-cols-3">
              <KpiCard
                loading={loading}
                label="פתחו שאלות נפוצות"
                value={data.homepageInterest.faqUsers}
                hint="משתמשים ייחודיים שפתחו לפחות FAQ אחת"
                className="lg:col-span-1"
                accent="secondary"
              />
              <Card className="p-5 lg:col-span-2">
                <h3 className="mb-4 text-sm font-semibold text-foreground">
                  השאלות שהכי עניינו מבקרים
                </h3>
                <HorizontalBars
                  loading={loading}
                  unavailable={data.homepageInterest.questionsUnavailable}
                  unavailableDescription="המימד customEvent:question עדיין לא זמין ב-Data API (נרשם לאחרונה). שאר הדשבורד ממשיך לעבוד."
                  items={(data.homepageInterest.questions ?? []).map((q) => ({
                    label: q.question,
                    value: q.users,
                    secondary: q.opens,
                    secondaryLabel: 'פתיחות',
                  }))}
                  emptyTitle="אין פתיחות FAQ"
                  emptyDescription="בטווח שנבחר אף משתמש לא פתח שאלות נפוצות."
                />
              </Card>
            </div>
          </section>

          {/* 4. CTA performance */}
          <section className="space-y-4">
            <SectionHeader
              icon={<MousePointerClick size={16} className="text-secondary" />}
              title="לחיצות ופעולות בדף הבית"
            />
            <KpiCard
              loading={loading}
              label="משתמשים שלחצו על CTA"
              value={data.ctas.totalUsers}
              accent="primary"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">לפי סוג CTA</h3>
                <HorizontalBars
                  loading={loading}
                  unavailable={data.ctas.byNameUnavailable}
                  unavailableDescription="המימד customEvent:cta_name עדיין לא זמין ב-GA4."
                  items={(data.ctas.byName ?? []).map((r) => ({
                    label: r.label,
                    value: r.users,
                  }))}
                />
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">לפי מיקום</h3>
                <HorizontalBars
                  loading={loading}
                  unavailable={data.ctas.byLocationUnavailable}
                  unavailableDescription="המימד customEvent:cta_location עדיין לא זמין ב-GA4."
                  items={(data.ctas.byLocation ?? []).map((r) => ({
                    label: r.label,
                    value: r.users,
                  }))}
                />
              </Card>
            </div>
          </section>

          {/* 5. Plans / activation */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Sparkles size={16} className="text-secondary" />}
              title="Plans ואפשרויות הפעלה"
              subtitle="מודל בחירת מסלול · view_plans / select_plan / activation_options_*"
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <KpiCard
                loading={loading}
                label="פתחו את מודל ההפעלה"
                value={data.productInterest.plansViewedUsers}
                hint="view_plans"
                accent="primary"
              />
              <KpiCard
                loading={loading}
                label="בחרו מסלול"
                value={data.productInterest.planSelectedUsers}
                hint="select_plan"
                accent="secondary"
              />
              <KpiCard
                loading={loading}
                label="השאירו פרטים (כולל)"
                value={data.productInterest.leadUsers}
                hint="generate_lead · כל המקורות"
                accent="tertiary"
              />
              <KpiCard
                loading={loading}
                label="צפייה מהפעלת ניסיון"
                value={data.productInterest.activationOptionsViewedUsers}
                hint="activation_options_viewed"
                accent="secondary"
              />
              <KpiCard
                loading={loading}
                label="לחיצה על באדג׳ הפעלה"
                value={data.productInterest.activationOptionsClickedUsers}
                hint="activation_options_clicked"
                accent="primary"
              />
              <KpiCard
                loading={loading}
                label="הופעלו מניסיון"
                value={data.productInterest.trialActivatedUsers}
                hint="trial_activated"
                accent="tertiary"
              />
            </div>
            <Card className="p-5">
              <SummaryFunnel
                loading={loading}
                note="סיכום לפי משתמשים ייחודיים בטווח התאריכים — לא funnel רציף ברמת משתמש/סשן. שלב הליד כולל גם פניות שאינן ממודל ה-Plans."
                steps={[
                  { label: 'פתחו מודל הפעלה', value: data.productInterest.plansViewedUsers },
                  {
                    label: 'בחרו מסלול',
                    value: data.productInterest.planSelectedUsers,
                    stepRate: data.productInterest.step2Rate,
                  },
                  {
                    label: 'השאירו פרטים',
                    value: data.productInterest.leadUsers,
                    stepRate: data.productInterest.step3Rate,
                  },
                ]}
                overallRate={data.productInterest.overallRate}
                overallLabel="מפתיחת מודל ההפעלה להשארת פרטים"
              />
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">בחירת מסלול לפי תוכנית</h3>
                <HorizontalBars
                  loading={loading}
                  unavailable={data.productInterest.byPlanUnavailable}
                  unavailableDescription="המימד customEvent:plan_name עדיין לא זמין ב-GA4. יש לרשום אותו כ-Custom Dimension ל-event-scoped param plan_name."
                  items={(data.productInterest.byPlan ?? []).map((r) => ({
                    label: r.label,
                    value: r.users,
                  }))}
                  emptyTitle="אין בחירות מסלול"
                  emptyDescription="בטווח שנבחר אף משתמש לא בחר מסלול במודל ההפעלה."
                />
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">
                  פתיחת מודל לפי מקור כניסה
                </h3>
                <HorizontalBars
                  loading={loading}
                  unavailable={data.productInterest.activationBySourceUnavailable}
                  unavailableDescription="המימד customEvent:source עדיין לא זמין ב-GA4. יש לרשום אותו כ-Custom Dimension ל-event-scoped param source (עבור activation_options_viewed)."
                  items={(data.productInterest.activationBySource ?? []).map((r) => ({
                    label: r.label,
                    value: r.users,
                  }))}
                  emptyTitle="אין פתיחות עם מקור"
                  emptyDescription="בטווח שנבחר לא נפתח מודל ההפעלה ממקור tracked עם event_id, או שהמימד עדיין לא נאסף."
                />
              </Card>
            </div>
          </section>

          {/* 5b. Contact */}
          <section className="space-y-4">
            <SectionHeader
              icon={<MessageCircle size={16} className="text-secondary" />}
              title="יצירת קשר"
              subtitle="טופס יצירת קשר ניטרלי + לידים ממסלולי Plans"
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <KpiCard
                loading={loading}
                label="פתחו טופס יצירת קשר"
                value={data.contact.openUsers}
                hint="contact_form_open · משתמשים ייחודיים"
                accent="secondary"
              />
              <KpiCard
                loading={loading}
                label="השאירו פרטים"
                value={data.contact.leadUsers}
                hint="generate_lead"
                accent="primary"
              />
              <KpiCard
                loading={loading}
                label="המרה מפתיחה לשליחה"
                value={formatRate(data.contact.conversionRate)}
                hint="לידים ÷ פתיחות טופס"
                accent="tertiary"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">פתיחות טופס לפי מקור</h3>
                <HorizontalBars
                  loading={loading}
                  unavailable={data.contact.opensBySourceUnavailable}
                  unavailableDescription="המימד customEvent:contact_source עדיין לא זמין ב-GA4. יש לרשום אותו כ-Custom Dimension ל-event-scoped param contact_source."
                  items={(data.contact.opensBySource ?? []).map((r) => ({
                    label: r.label,
                    value: r.users,
                  }))}
                  emptyTitle="אין פתיחות עם מקור"
                  emptyDescription="בטווח שנבחר לא נפתח טופס עם contact_source, או שהמימד עדיין לא נאסף."
                />
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">לידים לפי מקור פנייה</h3>
                <HorizontalBars
                  loading={loading}
                  unavailable={data.contact.bySourceUnavailable}
                  unavailableDescription="המימד customEvent:contact_source עדיין לא זמין ב-GA4. יש לרשום אותו כ-Custom Dimension ל-event-scoped param contact_source."
                  items={(data.contact.bySource ?? []).map((r) => ({
                    label: r.label,
                    value: r.users,
                  }))}
                  emptyTitle="אין לידים עם מקור"
                  emptyDescription="בטווח שנבחר לא נשלחו פניות עם contact_source, או שהמימד עדיין לא נאסף."
                />
              </Card>
            </div>
          </section>

          {/* 6. Login */}
          <section className="space-y-4">
            <SectionHeader
              icon={<LogIn size={16} className="text-secondary" />}
              title="התחברות והרשמה"
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                loading={loading}
                label="הגיעו למסך התחברות"
                value={data.login.viewedUsers}
                accent="secondary"
              />
              <KpiCard
                loading={loading}
                label="התחילו התחברות"
                value={data.login.startedUsers}
                accent="tertiary"
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
            </div>
            <Card className="flex items-start gap-3 border-warning/40 bg-surface-elevated p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-semibold text-foreground">שגיאות התחברות</p>
                <p className="mt-1 text-xs text-muted">
                  ספירת אירועים (`eventCount`) — לא משתמשים ייחודיים
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
                  {loading ? '—' : data.login.errorCount}
                </p>
              </div>
            </Card>
          </section>

          {/* 7. Event creation */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Sparkles size={16} className="text-secondary" />}
              title="יצירת אירועים"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <KpiCard
                loading={loading}
                label="אירועים שנוצרו"
                value={data.eventCreation.eventCount}
                hint="eventCount"
                accent="primary"
              />
              <KpiCard
                loading={loading}
                label="משתמשים שיצרו אירוע"
                value={data.eventCreation.creatorUsers}
                hint="totalUsers"
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
