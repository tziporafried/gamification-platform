import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useEventCounts } from '@/hooks/useEventCounts'
import { useWizardState } from '@/hooks/useWizardState'
import { getWizardPrefs, setWizardPrefs } from '@/lib/wizard'
import { WizardLayout } from '@/components/wizard/WizardLayout'
import { StepEventDetails } from '@/components/wizard/StepEventDetails'
import { StepParticipants } from '@/components/wizard/StepParticipants'
import { StepGroups } from '@/components/wizard/StepGroups'
import { StepTasks } from '@/components/wizard/StepTasks'
import { StepReviewGenerate } from '@/components/wizard/StepReviewGenerate'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import type { Event } from '@/types'

export function EventWizard() {
  const { id, step: stepParam } = useParams<{ id: string; step?: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  // currentStep is derived directly from the URL — no state, no sync effects
  const currentStep = useMemo(() => {
    const n = parseInt(stepParam ?? '', 10)
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 1
  }, [stepParam])

  const { counts, loaded: countsLoaded, refresh: refreshCounts } = useEventCounts(id)
  const { wizardState, groupType, setGroupType } = useWizardState(event, counts, countsLoaded)

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

  // Redirect /events/:id (no step param) to last saved step
  useEffect(() => {
    if (!id || loading || !event || stepParam) return
    const { lastStep } = getWizardPrefs(id)
    navigate(`/events/${id}/step/${lastStep}`, { replace: true })
  }, [id, loading, event, stepParam, navigate])

  const goToStep = useCallback((s: number) => {
    const clamped = Math.max(1, Math.min(5, s))
    if (id) setWizardPrefs(id, { lastStep: clamped })
    navigate(`/events/${id}/step/${clamped}`, { replace: true })
  }, [id, navigate])

  const goNext = useCallback(() => goToStep(currentStep + 1), [currentStep, goToStep])
  const goBack = useCallback(() => goToStep(currentStep - 1), [currentStep, goToStep])

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

      {currentStep === 2 && (
        <StepGroups
          eventId={event.id}
          groupType={groupType}
          counts={counts}
          onGroupTypeSelect={setGroupType}
          onCountsRefresh={refreshCounts}
          onNext={goNext}
          onBack={goBack}
        />
      )}

      {currentStep === 3 && (
        <StepParticipants
          eventId={event.id}
          counts={counts}
          groupType={groupType}
          onCountsRefresh={refreshCounts}
          onNext={goNext}
          onBack={goBack}
        />
      )}

      {currentStep === 4 && (
        <StepTasks
          eventId={event.id}
          counts={counts}
          onCountsRefresh={refreshCounts}
          onNext={goNext}
          onBack={goBack}
        />
      )}

      {currentStep === 5 && (
        <StepReviewGenerate
          event={event}
          counts={counts}
          groupType={groupType}
          onGoToStep={goToStep}
          onBack={goBack}
        />
      )}
    </WizardLayout>
  )
}
