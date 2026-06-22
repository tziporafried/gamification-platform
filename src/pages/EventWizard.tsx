import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useEventCounts } from '@/hooks/useEventCounts'
import { useWizardState } from '@/hooks/useWizardState'
import { WizardLayout } from '@/components/wizard/WizardLayout'
import { StepEventDetails } from '@/components/wizard/StepEventDetails'
import { StepParticipants } from '@/components/wizard/StepParticipants'
import { StepGroups } from '@/components/wizard/StepGroups'
import { StepTasks } from '@/components/wizard/StepTasks'
import { StepReviewGenerate } from '@/components/wizard/StepReviewGenerate'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import type { Event } from '@/types'

export function EventWizard() {
  const { id, step } = useParams<{ id: string; step?: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  const { counts, loaded: countsLoaded, refresh: refreshCounts } = useEventCounts(id)
  const {
    currentStep,
    wizardState,
    groupType,
    setGroupType,
    goNext,
    goBack,
    goToStep,
  } = useWizardState(event, counts, countsLoaded)

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single()

      if (!data) {
        navigate('/events', { replace: true })
        return
      }
      setEvent(data)
      setLoading(false)
    }
    fetchEvent()
  }, [id, user, navigate])

  // Sync URL step param → state (on initial load / direct link)
  useEffect(() => {
    if (step) {
      const stepNum = parseInt(step, 10)
      if (stepNum >= 1 && stepNum <= 5 && stepNum !== currentStep) {
        goToStep(stepNum)
      }
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state → URL (keep URL in sync with current step)
  useEffect(() => {
    if (!id || loading) return
    const expectedPath = `/events/${id}/step/${currentStep}`
    if (window.location.pathname !== expectedPath) {
      navigate(expectedPath, { replace: true })
    }
  }, [currentStep, id, loading, navigate])

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
          onBack={goBack}
        />
      )}
    </WizardLayout>
  )
}
