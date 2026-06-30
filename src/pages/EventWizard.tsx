import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useEventCounts } from '@/hooks/useEventCounts'
import { useWizardState } from '@/hooks/useWizardState'
import { getWizardPrefs, setWizardPrefs } from '@/lib/wizard'
import { WizardLayout } from '@/components/wizard/WizardLayout'
import { WizardStepPanel } from '@/components/wizard/WizardStepPanel'
import { StepEventDetails } from '@/components/wizard/StepEventDetails'
import { StepParticipants } from '@/components/wizard/StepParticipants'
import { StepGroups } from '@/components/wizard/StepGroups'
import { StepTasks } from '@/components/wizard/StepTasks'
import { StepRewards } from '@/components/wizard/StepRewards'
import { StepReviewGenerate } from '@/components/wizard/StepReviewGenerate'
import { TemplatePickerModal } from '@/components/wizard/TemplatePickerModal'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import type { Event, GroupType } from '@/types'

export function EventWizard() {
  const { id, step: stepParam } = useParams<{ id: string; step?: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  const currentStep = useMemo(() => {
    const n = parseInt(stepParam ?? '', 10)
    return Number.isFinite(n) && n >= 1 && n <= 6 ? n : 1
  }, [stepParam])

  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(() => new Set([currentStep]))
  const [startMethod, setStartMethod] = useState<'scratch' | 'template' | null>(null)

  const { counts, loaded: countsLoaded, refresh: refreshCounts, patchCounts } = useEventCounts(id)
  const { wizardState, groupType, setGroupType } = useWizardState(event, counts, countsLoaded)

  useEffect(() => {
    setVisitedSteps((prev) => {
      if (prev.has(currentStep)) return prev
      const next = new Set(prev)
      next.add(currentStep)
      return next
    })
  }, [currentStep])

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .neq('status', 'archived')
        .single()

      if (!data) {
        navigate('/events', { replace: true })
        return
      }
      setEvent(data)
      setLoading(false)
    }
    fetchEvent()
  }, [id, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id || loading || !event || stepParam) return
    const { lastStep } = getWizardPrefs(id)
    navigate(`/events/${id}/step/${lastStep}`, { replace: true })
  }, [id, loading, event, stepParam, navigate])

  const goToStep = useCallback((s: number) => {
    const clamped = Math.max(1, Math.min(6, s))
    if (id) setWizardPrefs(id, { lastStep: clamped })
    navigate(`/events/${id}/step/${clamped}`, { replace: true })
  }, [id, navigate])

  const goNext = useCallback(() => goToStep(currentStep + 1), [currentStep, goToStep])
  const goBack = useCallback(() => goToStep(currentStep - 1), [currentStep, goToStep])

  const showTemplatePicker =
    currentStep === 1 &&
    startMethod === null &&
    !event?.name &&
    counts.tasks === 0 &&
    counts.groups === 0 &&
    countsLoaded

  function handleChooseScratch() {
    setStartMethod('scratch')
  }

  function handleTemplateApplied(appliedGroupType: GroupType) {
    setGroupType(appliedGroupType)
    setStartMethod('template')
    refreshCounts()
  }

  if (loading || !event) return <FullPageLoader />

  return (
    <WizardLayout
      event={event}
      currentStep={currentStep}
      wizardState={wizardState}
      onStepClick={goToStep}
    >
      {currentStep === 1 && (
        <StepEventDetails
          event={event}
          onEventUpdated={setEvent}
          onNext={goNext}
        />
      )}

      {visitedSteps.has(2) && (
        <WizardStepPanel active={currentStep === 2}>
          <StepGroups
            eventId={event.id}
            groupType={groupType}
            counts={counts}
            onGroupTypeSelect={setGroupType}
            onCountsPatch={patchCounts}
            onCountsRefresh={refreshCounts}
            onNext={goNext}
            onBack={goBack}
          />
        </WizardStepPanel>
      )}

      {visitedSteps.has(3) && (
        <WizardStepPanel active={currentStep === 3}>
          <StepParticipants
            eventId={event.id}
            counts={counts}
            groupType={groupType}
            onCountsPatch={patchCounts}
            onCountsRefresh={refreshCounts}
            onNext={goNext}
            onBack={goBack}
          />
        </WizardStepPanel>
      )}

      {visitedSteps.has(4) && (
        <WizardStepPanel active={currentStep === 4}>
          <StepTasks
            eventId={event.id}
            counts={counts}
            onCountsPatch={patchCounts}
            onCountsRefresh={refreshCounts}
            onNext={goNext}
            onBack={goBack}
          />
        </WizardStepPanel>
      )}

      {visitedSteps.has(5) && (
        <WizardStepPanel active={currentStep === 5}>
          <StepRewards
            eventId={event.id}
            counts={counts}
            onCountsPatch={patchCounts}
            onCountsRefresh={refreshCounts}
            onNext={goNext}
            onBack={goBack}
          />
        </WizardStepPanel>
      )}

      {visitedSteps.has(6) && (
        <WizardStepPanel active={currentStep === 6}>
          <StepReviewGenerate
            event={event}
            counts={counts}
            groupType={groupType}
            onGoToStep={goToStep}
            onBack={goBack}
          />
        </WizardStepPanel>
      )}

      <TemplatePickerModal
        eventId={event.id}
        isOpen={showTemplatePicker}
        onChooseScratch={handleChooseScratch}
        onTemplateApplied={handleTemplateApplied}
      />
    </WizardLayout>
  )
}
