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
  isSkippedWizardStep,
  hiddenWizardSteps,
  resolveEventEntryPath,
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
import { StepSmsSettings } from '@/components/wizard/StepSmsSettings'
import { StepCards } from '@/components/wizard/StepCards'
import { StepTemplateSummary } from '@/components/wizard/StepTemplateSummary'
import { TemplatePickerModal } from '@/components/wizard/TemplatePickerModal'
import { EventFeaturesProvider } from '@/contexts/EventFeaturesContext'
import { useEventFeatures } from '@/hooks/useEventFeatures'
import { isFeatureOn } from '@/lib/eventFeatures'
import { SMS_NOTIFICATIONS_FLAG } from '@/lib/smsNotifications'
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

  // Read straight from the hook rather than through the provider below, because
  // this component renders that provider and so sits outside it. Both go
  // through the same module-level cache, so this is the same answer and not a
  // second query. A template is never sold anything, so it never asks.
  const { features, loading: featuresLoading } = useEventFeatures(
    isTemplateMode ? undefined : id,
    event?.plan,
  )
  const smsEnabled = !isTemplateMode && !featuresLoading && isFeatureOn(features, SMS_NOTIFICATIONS_FLAG)
  const scope = useMemo(() => ({ isTemplateMode, smsEnabled }), [isTemplateMode, smsEnabled])

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
    const normalized = normalizeWizardStep(s, scope)
    const clamped = Math.max(1, Math.min(WIZARD_STEPS.length, normalized))
    if (id) setWizardPrefs(id, { lastStep: clamped })
    navigate(`/events/${id}/step/${clamped}`, { replace: true })
  }, [id, navigate, scope])

  const goNext = useCallback(() => {
    trackWizardStepComplete(currentStep, stepNameFor(currentStep))
    goToStep(adjustWizardStep(currentStep, 'next', scope))
  }, [currentStep, goToStep, scope])

  const goBack = useCallback(() => {
    const toStep = adjustWizardStep(currentStep, 'prev', scope)
    trackWizardBack(currentStep, toStep)
    goToStep(toStep)
  }, [currentStep, goToStep, scope])

  // Not every run walks every step - a template has no participants (3), no SMS
  // (6) and no cards (7); a game has no template summary (8), and no SMS step
  // unless it was sold one. Landing on one of them, by URL or by a lastStep
  // saved under different flags, falls through to the nearest real step.
  //
  // Held until the flags have arrived: until then every game reads as "no SMS",
  // and acting on that would bounce somebody off step 6 of the game that does
  // have it, half a second before we knew better.
  useEffect(() => {
    if (featuresLoading) return
    if (!isSkippedWizardStep(currentStep, scope)) return
    goToStep(currentStep)
  }, [scope, featuresLoading, currentStep, goToStep])

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

  // Template editing has no step 7 to send anyone to - its ending is the step-8
  // summary - so it keeps the plain control-board link.
  const breadcrumbEventPath = isTemplateMode
    ? undefined
    : resolveEventEntryPath(event, counts, groupType)

  return (
    <EventFeaturesProvider eventId={event.id} plan={event.plan}>
    <WizardLayout
      event={event}
      currentStep={currentStep}
      wizardState={wizardState}
      onStepClick={goToStep}
      hiddenSteps={hiddenWizardSteps(scope)}
      headerSuffix={isTemplateMode ? 'עריכת תבנית' : undefined}
      eventPath={breadcrumbEventPath}
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

      {smsEnabled && visitedSteps.has(6) && (
        <WizardStepPanel active={currentStep === 6}>
          <StepSmsSettings
            event={event}
            onEventUpdated={setEvent}
            onNext={goNext}
            onBack={goBack}
          />
        </WizardStepPanel>
      )}

      {!isTemplateMode && visitedSteps.has(7) && (
        <WizardStepPanel active={currentStep === 7}>
          <StepCards
            event={event}
            counts={counts}
            groupType={groupType}
            isActive={currentStep === 7}
            onEventUpdated={setEvent}
            onGoToStep={goToStep}
            onBack={goBack}
          />
        </WizardStepPanel>
      )}

      {isTemplateMode && visitedSteps.has(8) && (
        <WizardStepPanel active={currentStep === 8}>
          <StepTemplateSummary
            event={event}
            counts={counts}
            groupType={groupType}
            isActive={currentStep === 8}
            templateId={editingTemplate!.id}
            onGoToStep={goToStep}
            onBack={goBack}
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
