import type { Event, EventCounts, WizardState, ReadinessCheck, WizardPrefs, GroupType, WizardStepId } from '@/types'
import { WIZARD_STEPS } from '@/types'

const STORAGE_PREFIX = 'wizard_prefs_'

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

export const TEMPLATE_SKIP_STEPS = [3] as const

export function adjustWizardStep(step: number, direction: 'next' | 'prev', isTemplateMode: boolean): number {
  if (!isTemplateMode) {
    return direction === 'next' ? step + 1 : step - 1
  }

  if (direction === 'next') {
    if (step === 2) return 4
    return step + 1
  }

  if (step === 4) return 2
  return step - 1
}

export function normalizeWizardStep(step: number, isTemplateMode: boolean): number {
  if (!isTemplateMode) return step
  if (step === 3) return 4
  return step
}

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
