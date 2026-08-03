import type { Event, EventCounts, WizardState, ReadinessCheck, WizardPrefs, GroupType, WizardStepId } from '@/types'
import { WIZARD_STEPS } from '@/types'

const STORAGE_PREFIX = 'wizard_prefs_'

/**
 * The step holding "התחל את הפעילות" - the one and only place in the app that
 * writes `events.status = 'active'`. Anything that needs to send an owner off
 * to start their game points here rather than hard-coding the number.
 */
export const ACTIVATION_STEP = WIZARD_STEPS.find((step) => step.id === 'cards')!.step

/**
 * Where pressing an event lands its owner. One rule, so the events list and the
 * wizard breadcrumb cannot drift apart:
 *   started        → the control center, on the DB flag alone
 *   ready, unstarted → the step that starts it
 *   otherwise      → wherever they left off
 * `counts` is optional because the breadcrumb does not always have them; without
 * it a game simply resumes where it stopped rather than jumping to the ending.
 */
export function resolveEventEntryPath(
  event: Event,
  counts?: EventCounts,
  groupType?: GroupType | null,
): string {
  if (event.status === 'active') return `/events/${event.id}/control`
  const ready = counts ? isEventReady(event, counts, groupType) : false
  const step = ready ? ACTIVATION_STEP : getWizardPrefs(event.id).lastStep
  return `/events/${event.id}/step/${step}`
}

export function getWizardStepId(stepNumber: number): WizardStepId | null {
  return WIZARD_STEPS.find((step) => step.step === stepNumber)?.id ?? null
}

export function getWizardPrefs(eventId: string): WizardPrefs {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${eventId}`)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { lastStep: 1, groupType: null }
}

export function setWizardPrefs(eventId: string, prefs: Partial<WizardPrefs>): void {
  const current = getWizardPrefs(eventId)
  const updated = { ...current, ...prefs }
  localStorage.setItem(`${STORAGE_PREFIX}${eventId}`, JSON.stringify(updated))
}

/** DB groups imply custom mode; otherwise fall back to the wizard step-2 choice in localStorage. */
export function resolveGroupType(eventId: string, counts: EventCounts): GroupType | null {
  if (counts.groups > 0) return 'custom'
  return getWizardPrefs(eventId).groupType
}

export function computeWizardState(event: Event, counts: EventCounts, groupType: GroupType | null): WizardState {
  const hasDetails = !!event.name
  const groupsResolved = groupType === 'none' || counts.groups > 0
  const hasParticipants = counts.participants > 0
  const hasTasks = counts.tasks > 0
  const hasRewards = counts.rewards > 0

  return {
    details: hasDetails ? 'completed' : 'not_started',
    groups: groupType === null ? 'not_started' : (groupsResolved ? 'completed' : 'in_progress'),
    participants: hasParticipants ? 'completed' : (groupsResolved || groupType === null ? 'in_progress' : 'not_started'),
    tasks: hasTasks ? 'completed' : (hasParticipants ? 'in_progress' : 'not_started'),
    rewards: hasRewards ? 'completed' : (hasTasks ? 'in_progress' : 'not_started'),
    // Completed means the owner wrote their own message. An untouched step is
    // not a broken game - it sends the default text - so nothing here ever
    // blocks starting, and the step is hidden outright without the flag.
    sms: event.sms_template ? 'completed' : (hasTasks ? 'in_progress' : 'not_started'),
    cards: event.scan_mode ? 'completed' : (hasTasks ? 'in_progress' : 'not_started'),
    review: hasTasks ? 'in_progress' : 'not_started',
  }
}

export function computeTemplateWizardState(
  event: Event,
  counts: EventCounts,
  groupType: GroupType | null,
): WizardState {
  const hasDetails = !!event.name
  const groupsResolved = groupType === 'none' || counts.groups > 0
  const hasTasks = counts.tasks > 0
  const hasRewards = counts.rewards > 0

  return {
    details: hasDetails ? 'completed' : 'not_started',
    groups: groupType === null ? 'not_started' : (groupsResolved ? 'completed' : 'in_progress'),
    participants: groupsResolved || groupType === null ? 'completed' : 'not_started',
    tasks: hasTasks ? 'completed' : (groupsResolved ? 'in_progress' : 'not_started'),
    rewards: hasRewards ? 'completed' : (hasTasks ? 'in_progress' : 'not_started'),
    // A template has no participants - so nobody to print cards for and nobody
    // to text. Both steps are hidden in template mode (TEMPLATE_SKIP_STEPS) and
    // never have a status.
    sms: 'not_started',
    cards: 'not_started',
    review: hasTasks && groupsResolved && hasDetails ? 'in_progress' : 'not_started',
  }
}

export function calculateTemplateReadiness(
  event: Event,
  counts: EventCounts,
  groupType?: GroupType | null,
): ReadinessCheck[] {
  const resolvedGroupType = groupType ?? resolveGroupType(event.id, counts)

  return [
    {
      id: 'event_name',
      label: 'לתבנית יש שם',
      wizardPassedLabel: 'נתתם שם לתבנית',
      wizardFailedLabel: 'יש לתת שם לתבנית',
      passed: !!event.name,
      required: true,
      stepNumber: 1,
    },
    {
      id: 'groups_decided',
      label: 'נבחר אופן השחק (כולם יחד / קבוצות)',
      wizardPassedLabel: 'בחרתם איך לשחק',
      wizardFailedLabel: 'יש לבחור בשלב «חלוקה לקבוצות»: כולם יחד או קבוצות',
      passed: resolvedGroupType !== null,
      required: true,
      stepNumber: 2,
    },
    {
      id: 'has_groups',
      label: 'הוגדרה לפחות קבוצה אחת',
      wizardPassedLabel: 'נוספה לפחות קבוצה אחת',
      wizardFailedLabel: 'יש להוסיף לפחות קבוצה אחת',
      passed: resolvedGroupType !== 'custom' || counts.groups > 0,
      required: true,
      stepNumber: 2,
    },
    {
      id: 'has_tasks',
      label: 'לפחות משימה אחת',
      wizardPassedLabel: 'נוספה לפחות פעילות אחת',
      wizardFailedLabel: 'יש להוסיף לפחות פעילות אחת',
      passed: counts.tasks > 0,
      required: true,
      stepNumber: 4,
    },
  ]
}

export function isTemplateReady(
  event: Event,
  counts: EventCounts,
  groupType?: GroupType | null,
): boolean {
  return calculateTemplateReadiness(event, counts, groupType).filter((c) => c.required).every((c) => c.passed)
}

/**
 * Not every run walks every step.
 *
 * A template has nobody to enrol (3), no phones to text (6) and no cards to
 * print (7), and ends on the summary. A game ends on the cards step, where it
 * is also started - the summary (8) is the template's ending only, so a game
 * never sees it - and sees the SMS step only if it was sold SMS.
 *
 * Which steps exist is the one question everything else here is derived from:
 * the progress bar, the dots, and both directions of next/back. That is why
 * these are computed from a set rather than written as jumps - the SMS step is
 * the third thing that can move them, and a jump table with three inputs is
 * a table nobody can read.
 */
export const TEMPLATE_SKIP_STEPS = [3, 6, 7] as const
export const EVENT_SKIP_STEPS = [8] as const
/** Sold separately; hidden entirely for every game that did not buy it. */
export const SMS_STEP = 6

/** What this particular run of the wizard is. */
export interface WizardScope {
  isTemplateMode: boolean
  /** The game has the `sms_notifications` flag. Always false for a template. */
  smsEnabled?: boolean
}

export function hiddenWizardSteps({ isTemplateMode, smsEnabled }: WizardScope): number[] {
  if (isTemplateMode) return [...TEMPLATE_SKIP_STEPS]
  return smsEnabled ? [...EVENT_SKIP_STEPS] : [...EVENT_SKIP_STEPS, SMS_STEP]
}

/** The steps this run actually walks, in order. */
export function visibleWizardSteps(scope: WizardScope): number[] {
  const hidden = hiddenWizardSteps(scope)
  return WIZARD_STEPS.map((s) => s.step).filter((step) => !hidden.includes(step))
}

export function isSkippedWizardStep(step: number, scope: WizardScope): boolean {
  return hiddenWizardSteps(scope).includes(step)
}

/** The step the footer's next / back buttons lead to. Ends stay put. */
export function adjustWizardStep(step: number, direction: 'next' | 'prev', scope: WizardScope): number {
  const steps = visibleWizardSteps(scope)
  if (direction === 'next') {
    return steps.find((s) => s > step) ?? steps[steps.length - 1] ?? step
  }
  return [...steps].reverse().find((s) => s < step) ?? steps[0] ?? step
}

/**
 * The nearest step that exists in this run, for a number that came from a URL
 * or from a lastStep saved before the game was sold SMS. Falls forward, so
 * landing on a hidden step carries on through the wizard rather than back.
 */
export function normalizeWizardStep(step: number, scope: WizardScope): number {
  const steps = visibleWizardSteps(scope)
  if (steps.includes(step)) return step
  return steps.find((s) => s > step) ?? steps[steps.length - 1] ?? step
}

/**
 * What a game needs before it can be played.
 *
 * Deliberately says nothing about the cards step: this list is also what the
 * control centre and the events list call through isEventReady, and a game
 * plays fine without that choice - printing falls back to 'combined' and the
 * scanner reads either deck. The cards step enforces its own answer before it
 * lets anyone past it, and games that predate the step must not start
 * reporting themselves as broken.
 */
export function calculateReadiness(
  event: Event,
  counts: EventCounts,
  groupType?: GroupType | null,
): ReadinessCheck[] {
  const resolvedGroupType = groupType ?? resolveGroupType(event.id, counts)

  return [
    {
      id: 'event_name',
      label: 'לאירוע יש שם',
      wizardPassedLabel: 'נתתם שם לפעילות',
      wizardFailedLabel: 'יש לתת שם לפעילות',
      passed: !!event.name,
      required: true,
      stepNumber: 1,
    },
    {
      id: 'groups_decided',
      label: 'נבחר אופן השחק (כולם יחד / קבוצות)',
      wizardPassedLabel: 'בחרתם איך לשחק',
      wizardFailedLabel: 'יש לבחור בשלב «חלוקה לקבוצות»: כולם יחד או קבוצות',
      passed: resolvedGroupType !== null,
      required: true,
      stepNumber: 2,
    },
    {
      id: 'has_groups',
      label: 'הוגדרה לפחות קבוצה אחת',
      wizardPassedLabel: 'נוספה לפחות קבוצה אחת',
      wizardFailedLabel: 'יש להוסיף לפחות קבוצה אחת',
      passed: resolvedGroupType !== 'custom' || counts.groups > 0,
      required: true,
      stepNumber: 2,
    },
    {
      id: 'has_participants',
      label: 'לפחות 2 משתתפים',
      wizardPassedLabel: 'נוספו מספיק משתתפים',
      wizardFailedLabel: 'יש להוסיף משתתף נוסף',
      passed: counts.participants >= 2,
      required: true,
      stepNumber: 3,
    },
    {
      id: 'has_tasks',
      label: 'לפחות משימה אחת',
      wizardPassedLabel: 'נוספה לפחות פעילות אחת',
      wizardFailedLabel: 'יש להוסיף לפחות פעילות אחת',
      passed: counts.tasks > 0,
      required: true,
      stepNumber: 4,
    },
  ]
}

export function getFirstIncompleteStep(checks: ReadinessCheck[]): number | null {
  const steps = checks
    .filter((c) => c.required && !c.passed && c.stepNumber != null)
    .map((c) => c.stepNumber as number)
  return steps.length > 0 ? Math.min(...steps) : null
}

export function isEventReady(
  event: Event,
  counts: EventCounts,
  groupType?: GroupType | null,
): boolean {
  return calculateReadiness(event, counts, groupType).filter(c => c.required).every(c => c.passed)
}
