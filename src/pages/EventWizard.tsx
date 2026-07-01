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
  TEMPLATE_SKIP_STEPS,
} from '@/lib/wizard'
import { getTemplateByDraftEventId, fetchActivityTemplateById, seedTemplateDraftEvent, isDraftBehindTemplate } from '@/lib/templates'
import { useTemplateAutoSync } from '@/hooks/useTemplateAutoSync'
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
import type { ActivityTemplate, Event, GroupType } from '@/types'

export function EventWizard() {
  const { id, step: stepParam } = useParams<{ id: string; step?: string }>()
  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  const currentStep = useMemo(() => {
    const n = parseInt(stepParam ?? '', 10)
    return Number.isFinite(n) && n >= 1 && n <= 6 ? n : 1
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
    const clamped = Math.max(1, Math.min(6, normalized))
    if (id) setWizardPrefs(id, { lastStep: clamped })
    navigate(`/events/${id}/step/${clamped}`, { replace: true })
  }, [id, navigate, isTemplateMode])

  const goNext = useCallback(() => {
    goToStep(adjustWizardStep(currentStep, 'next', isTemplateMode))
  }, [currentStep, goToStep, isTemplateMode])

  const goBack = useCallback(() => {
    goToStep(adjustWizardStep(currentStep, 'prev', isTemplateMode))
  }, [currentStep, goToStep, isTemplateMode])

  useEffect(() => {
    if (!isTemplateMode || currentStep !== 3) return
    goToStep(4)
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
  }

  function handleTemplateApplied(appliedGroupType: GroupType, eventName: string) {
    setGroupType(appliedGroupType)
    setStartMethod('template')
    refreshCounts()
    if (eventName) {
      setEvent((prev) => (prev ? { ...prev, name: eventName } : prev))
    }
  }

  if (loading || templateLoading || !event) return <FullPageLoader />

  return (
    <WizardLayout
      event={event}
      currentStep={currentStep}
      wizardState={wizardState}
      onStepClick={goToStep}
      hiddenSteps={isTemplateMode ? [...TEMPLATE_SKIP_STEPS] : undefined}
      headerSuffix={isTemplateMode ? 'עריכת תבנית' : undefined}
    >
      {currentStep === 1 && (
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
      )}

      {visitedSteps.has(2) && (
        <WizardStepPanel active={currentStep === 2}>
          <StepGroups
            eventId={event.id}
            plan={isSuperAdmin ? 'full' : event.plan}
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
            plan={isSuperAdmin ? 'full' : event.plan}
            counts={counts}
            groupType={groupType}
            isActive={currentStep === 3}
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
            plan={isSuperAdmin ? 'full' : event.plan}
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
            plan={isSuperAdmin ? 'full' : event.plan}
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
            isActive={currentStep === 6}
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
        isOpen={showTemplatePicker}
        onChooseScratch={handleChooseScratch}
        onTemplateApplied={handleTemplateApplied}
      />
    </WizardLayout>
  )
}
