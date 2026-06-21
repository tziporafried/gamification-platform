import { useState, useCallback, useMemo, useEffect } from 'react'
import { getWizardPrefs, setWizardPrefs, computeWizardState, getStepId } from '@/lib/wizard'
import type { Event, EventCounts, WizardState, GroupType, WizardStepId } from '@/types'

export function useWizardState(event: Event | null, counts: EventCounts, countsLoaded: boolean) {
  const prefs = event ? getWizardPrefs(event.id) : { lastStep: 1, groupType: null }

  const [currentStep, setCurrentStepRaw] = useState(prefs.lastStep)
  const [groupType, setGroupTypeRaw] = useState<GroupType | null>(prefs.groupType)

  // Once counts are loaded from DB, resolve groupType if user hasn't saved a preference
  useEffect(() => {
    if (!countsLoaded) return
    if (prefs.groupType !== null) return // user already made a choice stored in localStorage
    if (groupType !== null && groupType !== prefs.groupType) return // already resolved in this session

    if (counts.groups > 0) {
      setGroupTypeRaw('custom')
    } else {
      setGroupTypeRaw('none')
    }
  }, [countsLoaded, counts.groups]) // eslint-disable-line react-hooks/exhaustive-deps

  const wizardState: WizardState = useMemo(() => {
    if (!event) return { details: 'not_started', groups: 'not_started', participants: 'not_started', tasks: 'not_started', review: 'not_started' }
    return computeWizardState(event, counts, groupType)
  }, [event, counts, groupType])

  const setCurrentStep = useCallback((step: number) => {
    setCurrentStepRaw(step)
    if (event) setWizardPrefs(event.id, { lastStep: step })
  }, [event])

  const setGroupType = useCallback((type: GroupType) => {
    setGroupTypeRaw(type)
    if (event) setWizardPrefs(event.id, { groupType: type })
  }, [event])

  const goNext = useCallback(() => {
    setCurrentStep(Math.min(currentStep + 1, 5))
  }, [currentStep, setCurrentStep])

  const goBack = useCallback(() => {
    setCurrentStep(Math.max(currentStep - 1, 1))
  }, [currentStep, setCurrentStep])

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= 5) setCurrentStep(step)
  }, [setCurrentStep])

  const currentStepId: WizardStepId = getStepId(currentStep)

  return {
    currentStep,
    currentStepId,
    wizardState,
    groupType,
    setGroupType,
    goNext,
    goBack,
    goToStep,
  }
}
