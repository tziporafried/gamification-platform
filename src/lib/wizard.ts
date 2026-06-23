import type { Event, EventCounts, WizardState, ReadinessCheck, WizardPrefs, GroupType, WizardStepId } from '@/types'

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

  return {
    details: hasDetails ? 'completed' : 'not_started',
    groups: groupType === null ? 'not_started' : (groupsResolved ? 'completed' : 'in_progress'),
    participants: hasParticipants ? 'completed' : (groupsResolved || groupType === null ? 'in_progress' : 'not_started'),
    tasks: hasTasks ? 'completed' : (hasParticipants ? 'in_progress' : 'not_started'),
    review: hasTasks ? 'in_progress' : 'not_started',
  }
}

export function calculateReadiness(event: Event, counts: EventCounts): ReadinessCheck[] {
  return [
    {
      id: 'event_name',
      label: 'לאירוע יש שם',
      passed: !!event.name,
      required: true,
      stepNumber: 1,
    },
    {
      id: 'has_participants',
      label: 'לפחות 2 משתתפים',
      passed: counts.participants >= 2,
      required: true,
      stepNumber: 3,
    },
    {
      id: 'has_tasks',
      label: 'לפחות משימה אחת',
      passed: counts.tasks > 0,
      required: true,
      stepNumber: 4,
    },
  ]
}

export function isEventReady(event: Event, counts: EventCounts): boolean {
  return calculateReadiness(event, counts).filter(c => c.required).every(c => c.passed)
}

export function getStepNumber(stepId: WizardStepId): number {
  const map: Record<WizardStepId, number> = {
    details: 1,
    groups: 2,
    participants: 3,
    tasks: 4,
    review: 5,
  }
  return map[stepId]
}

export function getStepId(stepNumber: number): WizardStepId {
  const map: Record<number, WizardStepId> = {
    1: 'details',
    2: 'groups',
    3: 'participants',
    4: 'tasks',
    5: 'review',
  }
  return map[stepNumber] || 'details'
}
