import { formatNumber, formatRate } from './KpiCard'
import type { AnalyticsDashboardData, AnalyticsInsight } from './types'

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

function dropPct(from: number, to: number): number | null {
  if (from <= 0) return null
  return Math.round(((from - to) / from) * 1000) / 10
}

/**
 * Up to 3 data-driven insights. Only uses unique-user cohorts.
 * Abandonment language only when stages are product-compatible and counts allow it.
 */
export function buildAttentionInsights(data: AnalyticsDashboardData): AnalyticsInsight[] {
  const insights: Array<AnalyticsInsight & { score: number }> = []

  const openUsers = data.contact.openUsers
  const leadUsers = data.contact.leadUsers
  // Form open → submit: both unique users, product-compatible stages.
  // Only phrase as abandonment when leads ≤ opens (valid cohort comparison).
  if (openUsers >= 5 && leadUsers <= openUsers) {
    const abandonRate = dropPct(openUsers, leadUsers)
    if (abandonRate !== null && abandonRate >= 50) {
      insights.push({
        id: 'contact-abandon',
        severity: abandonRate >= 80 ? 'critical' : 'warning',
        title: 'נטישת טופס יצירת קשר',
        detail: `${formatRate(abandonRate)} ממי שפתחו את טופס יצירת הקשר לא שלחו אותו`,
        counts: `${formatNumber(openUsers)} פתחו · ${formatNumber(leadUsers)} שלחו`,
        score: abandonRate + (abandonRate >= 80 ? 20 : 0),
      })
    }
  }

  const plans = data.productInterest.plansViewedUsers
  const formOpen = data.contact.openUsers
  // Plans vs form open: independent unique-user cohorts — comparison, not sequence.
  if (plans >= 5 && formOpen < plans) {
    const gap = plans - formOpen
    const gapRate = dropPct(plans, formOpen)
    if (gapRate !== null && gapRate >= 40) {
      insights.push({
        id: 'plans-vs-form',
        severity: gapRate >= 70 ? 'critical' : 'warning',
        title: 'פער בין מחירים לטופס',
        detail: `קהל שצפה במחירים (${formatNumber(plans)}) גדול משמעותית מקהל שפתח טופס (${formatNumber(formOpen)})`,
        counts: `הפרש של ${formatNumber(gap)} משתמשים ייחודיים`,
        score: gapRate + 5,
      })
    }
  }

  const plansToLead = data.productInterest.plansToLeadRate ?? data.productInterest.overallRate
  if (plans >= 5 && plansToLead !== null && plansToLead < 25) {
    insights.push({
      id: 'plans-to-lead-low',
      severity: plansToLead < 10 ? 'critical' : 'warning',
      title: 'המרה נמוכה ממחירים לליד',
      detail: `רק ${formatRate(plansToLead)} ממי שצפו במחירים השאירו פרטים באותו טווח`,
      counts: `${formatNumber(plans)} צפו במחירים · ${formatNumber(leadUsers)} לידים`,
      score: 100 - plansToLead,
    })
  }

  const started = data.video.startedUsers
  const completed = data.video.completedUsers
  const completion = data.video.completionRate
  if (started >= 5 && completion !== null && completion >= 60 && completed <= started) {
    insights.push({
      id: 'video-strong',
      severity: 'positive',
      title: 'השלמת סרטון חזקה',
      detail: `${formatRate(completion)} מהמתחילים מסיימים לצפות`,
      counts: `${formatNumber(started)} התחילו · ${formatNumber(completed)} סיימו`,
      score: completion,
    })
  }

  const visitors = data.overview.homepageUsers
  const leadConv = data.overview.leadConversionRate
  if (visitors >= 20 && leadConv !== null && leadConv < 2) {
    insights.push({
      id: 'visitor-to-lead-low',
      severity: 'warning',
      title: 'המרת מבקרים לליד נמוכה',
      detail: `רק ${formatRate(leadConv)} מהמבקרים הייחודיים השאירו פרטים`,
      counts: `${formatNumber(visitors)} מבקרים · ${formatNumber(leadUsers)} לידים`,
      score: 50 - leadConv,
    })
  }

  return insights
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ score: _score, ...rest }) => rest)
}

export function buildFaqInsight(
  questions: { question: string; users: number }[] | null | undefined,
): string | null {
  if (!questions || questions.length < 2) return null
  const [top, second] = questions
  if (top.users < 3 || second.users <= 0) return null
  const ratio = top.users / second.users
  if (ratio < 1.8) return null
  const rounded = Math.round(ratio * 10) / 10
  const shortQ = top.question.length > 40 ? `${top.question.slice(0, 40)}…` : top.question
  return `השאלה המובילה בפער: 「${shortQ}」 — פי ${rounded} מהשאלה הבאה`
}

export function buildVideoDropInsight(milestones: {
  label: string
  users: number
}[]): { kind: 'drop' | 'positive'; text: string } | null {
  if (milestones.length < 2) return null
  const first = milestones[0]
  const last = milestones[milestones.length - 1]
  if (first.users <= 0) return null

  const completionRate = rate(last.users, first.users)
  if (completionRate !== null && completionRate >= 60) {
    return {
      kind: 'positive',
      text: `${formatRate(completionRate)} מהמתחילים מסיימים לצפות`,
    }
  }

  let maxDrop = -1
  let maxDropText = ''
  for (let i = 1; i < milestones.length; i++) {
    const prev = milestones[i - 1]
    const curr = milestones[i]
    if (prev.users <= 0 || curr.users > prev.users) continue
    const drop = dropPct(prev.users, curr.users)
    if (drop !== null && drop > maxDrop) {
      maxDrop = drop
      maxDropText = `הנפילה הגדולה ביותר: ${prev.label} → ${curr.label} · ${formatRate(drop)} נטישה`
    }
  }

  if (maxDrop < 5 || !maxDropText) return null
  return { kind: 'drop', text: maxDropText }
}

export function buildPlansContactDropInsight(data: AnalyticsDashboardData): string | null {
  const plans = data.productInterest.plansViewedUsers
  const formOpen = data.contact.openUsers
  const leads = data.contact.leadUsers

  type Gap = { from: string; to: string; fromN: number; toN: number; drop: number }
  const gaps: Gap[] = []

  if (plans >= 3 && formOpen <= plans) {
    const drop = dropPct(plans, formOpen)
    if (drop !== null) {
      gaps.push({
        from: 'ראו מחירים',
        to: 'פתחו טופס',
        fromN: plans,
        toN: formOpen,
        drop,
      })
    }
  }

  if (formOpen >= 3 && leads <= formOpen) {
    const drop = dropPct(formOpen, leads)
    if (drop !== null) {
      gaps.push({
        from: 'פתחו טופס',
        to: 'שלחו פרטים',
        fromN: formOpen,
        toN: leads,
        drop,
      })
    }
  }

  if (!gaps.length) return null
  gaps.sort((a, b) => b.drop - a.drop)
  const g = gaps[0]
  if (g.drop < 15) return null

  // Prefer comparison wording (cohorts are independent in the date range).
  const diff = g.fromN - g.toN
  return `${formatNumber(diff)} הפרש בין 「${g.from}」 (${formatNumber(g.fromN)}) ל־「${g.to}」 (${formatNumber(g.toN)}) · ${formatRate(g.drop)}`
}

export { rate as calcRate }
