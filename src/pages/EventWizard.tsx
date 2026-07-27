import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useEventCounts } from '@/hooks/useEventCounts'
import { useWizardState } from '@/hooks/useWizardState'
import {
  getWizardPrefs,
  setWizardPrefs,
  adjustWizardStep,
  normalizeWizardStep,
  isTemplateSkippedStep,
  TEMPLATE_SKIP_STEPS,
} from '@/lib/wizard'
import { getTemplateByDraftEventId, fetchActivityTemplateById, seedTemplateDraftEvent, isDraftBehindTemplate } from '@/lib/templates'
import { useTemplateAutoSync } from '@/hooks/useTemplateAutoSync'
import { WizardLayout } from '@/components/wizard/WizardLayout'
import { WizardStepPanel } from '@/components/wizard/WizardStepPanel'
import { FloatingContactButton } from '@/components/layout/FloatingContactButton'
import { StepEventDetails } from '@/components/wizard/StepEventDetails'
import { StepParticipants } from '@/components/wizard/StepParticipants'
import { StepGroups } from '@/components/wizard/StepGroups'
import { StepTasks } from '@/components/wizard/StepTasks'
import { StepRewards } from '@/components/wizard/StepRewards'
import { StepCards } from '@/components/wizard/StepCards'
import { StepReviewGenerate } from '@/components/wizard/StepReviewGenerate'
import { TemplatePickerModal } from '@/components/wizard/TemplatePickerModal'
import { EventFeaturesProvider } from '@/contexts/EventFeaturesContext'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import {
  trackWizardStepView,
  trackWizardStepComplete,
  trackWizardBack,
  trackEventStartMethod,
} from '@/lib/analytics'
import type { ActivityTemplate, Event, GroupType } from '@/types'
import { WIZARD_STEPS } from '@/types'

function stepNameFor(stepNumber: number): string {
  return WIZARD_STEPS.find((s) => s.step === stepNumber)?.id ?? `step_${stepNumber}`
}

export function EventWizard() {
  const { id, step: stepParam } = useParams<{ id: string; step?: string }>()
  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  const currentStep = useMemo(() => {
    const n = parseInt(stepParam ?? '', 10)
    return Number.isFinite(n) && n >= 1 && n <= WIZARD_STEPS.length ? n : 1
  }, [stepParam])

  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(() => new Set([currentStep]))
  const [startMethod, setStartMethod] = useState<'scratch' | 'template' | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<ActivityTemplate | null>(null)
  const [templateLoading, setTemplateLoading] = useState(true)
  const [draftSynced, setDraftSynced] = useState(false)

  const isTemplateMode = editingTemplate !== null

  const { counts, loaded: countsLoaded, refresh: refreshCounts, patchCounts } = useEventCounts(id)
  const { wizardState, groupType, setGroupType } = useWizardState(event, counts, countsLoaded, isTemplateMode)

  useTemplateAutoSync({
    enabled: isTemplateMode && draftSynced,
    eventId: id,
    templateId: editingTemplate?.id,
    groupType,
    counts,
    countsLoaded,
  })

  useEffect(() => {
    setVisitedSteps((prev) => {
      if (prev.has(currentStep)) return prev
      const next = new Set(prev)
      next.add(currentStep)
      return next
    })
  }, [currentStep])

  useEffect(() => {
    if (loading || !event) return
    trackWizardStepView(currentStep, stepNameFor(currentStep))
  }, [currentStep, loading, event])

  useEffect(() => {
    async function detectTemplateMode() {
      if (!id) return
      setTemplateLoading(true)
      const template = await getTemplateByDraftEventId(id)
      setEditingTemplate(template)
      setTemplateLoading(false)
    }
    detectTemplateMode()
  }, [id])

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
    setDraftSynced(false)
  }, [id])

  useEffect(() => {
    if (!isTemplateMode || !countsLoaded || !editingTemplate || !id || draftSynced) return

    const eventId: string = id

    async function syncStaleDraft() {
      const full = await fetchActivityTemplateById(editingTemplate!.id)
      if (!full) {
        setDraftSynced(true)
        return
      }

      const needsSync = isDraftBehindTemplate(full, counts)

      if (needsSync) {
        try {
          await seedTemplateDraftEvent(editingTemplate!.id, eventId, full)
          refreshCounts()
          setGroupType(full.group_type as GroupType)
        } catch {
          // Stale sync is best-effort; admin can re-open from the templates tab.
        }
      }

      setDraftSynced(true)
    }

    syncStaleDraft()
  }, [
    isTemplateMode,
    countsLoaded,
    editingTemplate,
    id,
    draftSynced,
    counts.rewards,
    counts.tasks,
    counts.groups,
    refreshCounts,
    setGroupType,
  ])

  useEffect(() => {
    if (!id || loading || !event || stepParam || isTemplateMode) return
    const { lastStep } = getWizardPrefs(id)
    navigate(`/events/${id}/step/${lastStep}`, { replace: true })
  }, [id, loading, event, stepParam, navigate, isTemplateMode])

  const goToStep = useCallback((s: number) => {
    const normalized = normalizeWizardStep(s, isTemplateMode)
    const clamped = Math.max(1, Math.min(WIZARD_STEPS.length, normalized))
    if (id) setWizardPrefs(id, { lastStep: clamped })
    navigate(`/events/${id}/step/${clamped}`, { replace: true })
  }, [id, navigate, isTemplateMode])

  const goNext = useCallback(() => {
    trackWizardStepComplete(currentStep, stepNameFor(currentStep))
    goToStep(adjustWizardStep(currentStep, 'next', isTemplateMode))
  }, [currentStep, goToStep, isTemplateMode])

  const goBack = useCallback(() => {
    const toStep = adjustWizardStep(currentStep, 'prev', isTemplateMode)
    trackWizardBack(currentStep, toStep)
    goToStep(toStep)
  }, [currentStep, goToStep, isTemplateMode])

  // A template has no participants (3) and no cards to print (6); landing on
  // either - by URL or by a stale lastStep - falls through to the next step.
  useEffect(() => {
    if (!isTemplateMode || !isTemplateSkippedStep(currentStep)) return
    goToStep(currentStep)
  }, [isTemplateMode, currentStep, goToStep])

  const showTemplatePicker =
    !isTemplateMode &&
    currentStep === 1 &&
    startMethod === null &&
    !event?.name &&
    counts.tasks === 0 &&
    counts.groups === 0 &&
    countsLoaded

  function handleChooseScratch() {
    setStartMethod('scratch')
    trackEventStartMethod('scratch')
  }

  function handleTemplateApplied(appliedGroupType: GroupType, eventName: string) {
    setGroupType(appliedGroupType)
    setStartMethod('template')
    trackEventStartMethod('template')
    refreshCounts()
    if (eventName) {
      setEvent((prev) => (prev ? { ...prev, name: eventName } : prev))
    }
  }

  if (loading || templateLoading || !event) return <FullPageLoader />

  const isTrial = !isSuperAdmin && event.plan === 'free'

  return (
    <EventFeaturesProvider eventId={event.id} plan={event.plan}>
    <WizardLayout
      event={event}
      currentStep={currentStep}
      wizardState={wizardState}
      onStepClick={goToStep}
      hiddenSteps={isTemplateMode ? [...TEMPLATE_SKIP_STEPS] : undefined}
      headerSuffix={isTemplateMode ? 'עריכת תבנית' : undefined}
    >
      <WizardStepPanel active={currentStep === 1}>
        <StepEventDetails
          event={event}
          onEventUpdated={setEvent}
          onNext={goNext}
          templateMode={isTemplateMode ? {
            templateId: editingTemplate!.id,
            description: editingTemplate!.description,
            onDescriptionUpdated: (description) => {
              setEditingTemplate((prev) => prev ? { ...prev, description } : prev)
            },
          } : undefined}
        />
      </WizardStepPanel>

      {visitedSteps.has(2) && (
        <WizardStepPanel active={currentStep === 2}>
          <StepGroups
            eventId={event.id}
            plan={isSuperAdmin ? 'full' : event.plan}
            groupType={groupType}
            counts={counts}
            isActive={currentStep === 2}
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
            plan={isSuperAdmin ? 'full' : event.plan}
            counts={counts}
            groupType={groupType}
            isActive={currentStep === 3}
            onCountsPatch={patchCounts}
            onCountsRefresh={refreshCounts}
            onGroupTypeSelect={setGroupType}
            onNext={goNext}
            onBack={goBack}
          />
        </WizardStepPanel>
      )}

      {visitedSteps.has(4) && (
        <WizardStepPanel active={currentStep === 4}>
          <StepTasks
            eventId={event.id}
            plan={isSuperAdmin ? 'full' : event.plan}
            counts={counts}
            groupType={groupType}
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
            plan={isSuperAdmin ? 'full' : event.plan}
            counts={counts}
            isActive={currentStep === 5}
            onCountsPatch={patchCounts}
            onCountsRefresh={refreshCounts}
            onNext={goNext}
            onBack={goBack}
          />
        </WizardStepPanel>
      )}

      {!isTemplateMode && visitedSteps.has(6) && (
        <WizardStepPanel active={currentStep === 6}>
          <StepCards
            event={event}
            isActive={currentStep === 6}
            onEventUpdated={setEvent}
            onNext={goNext}
            onBack={goBack}
          />
        </WizardStepPanel>
      )}

      {visitedSteps.has(7) && (
        <WizardStepPanel active={currentStep === 7}>
          <StepReviewGenerate
            event={event}
            counts={counts}
            groupType={groupType}
            isActive={currentStep === 7}
            onGoToStep={goToStep}
            onBack={goBack}
            templateMode={isTemplateMode ? {
              templateId: editingTemplate!.id,
            } : undefined}
          />
        </WizardStepPanel>
      )}

      <TemplatePickerModal
        eventId={event.id}
        plan={event.plan}
        isOpen={showTemplatePicker}
        onChooseScratch={handleChooseScratch}
        onTemplateApplied={handleTemplateApplied}
      />
      {isTrial && (
        <FloatingContactButton
          variant="compact"
          location="wizard"
          eventId={event.id}
          eventName={event.name}
        />
      )}
    </WizardLayout>
    </EventFeaturesProvider>
  )
}
