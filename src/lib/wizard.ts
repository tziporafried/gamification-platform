import type { Event, EventCounts, WizardState, ReadinessCheck, WizardPrefs, GroupType } from '@/types'

const STORAGE_PREFIX = 'wizard_prefs_'

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

export function calculateReadiness(
  event: Event,
  counts: EventCounts,
  groupType: GroupType | null = getWizardPrefs(event.id).groupType,
): ReadinessCheck[] {
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
      label: 'נבחרה חלוקה לקבוצות',
      wizardPassedLabel: 'בחרתם איך לשחק',
      wizardFailedLabel: 'יש לבחור איך לשחק',
      passed: groupType !== null,
      required: true,
      stepNumber: 2,
    },
    {
      id: 'has_groups',
      label: 'הוגדרה לפחות קבוצה אחת',
      wizardPassedLabel: 'נוספה לפחות קבוצה אחת',
      wizardFailedLabel: 'יש להוסיף לפחות קבוצה אחת',
      passed: groupType !== 'custom' || counts.groups > 0,
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
  groupType: GroupType | null = getWizardPrefs(event.id).groupType,
): boolean {
  return calculateReadiness(event, counts, groupType).filter(c => c.required).every(c => c.passed)
}
