import { useState, useEffect, useRef, useCallback, useMemo, FormEvent } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { AutocompleteField } from '@/components/scoring/AutocompleteField'
import type { AccentRgb } from '@/lib/accentColor'
import { rgba } from '@/lib/accentColor'
import type { CatalogAction, CatalogParticipant } from '@/hooks/useEventCatalog'
import {
  buildActionCompletionIndex,
  filterActionsForParticipant,
  type ActionCompletionIndex,
  type KioskAvailabilityParticipant,
} from '@/lib/canPerformAction'
import { cn } from '@/lib/utils'

interface ParticipantOption { id: string; name: string; externalId: string }
interface ActionOption { id: string; name: string; code: string; points: number }

export type ManualEntryActionAvailability = {
  id: string
  is_active: boolean
  max_completions: number | null
  daily_limit: boolean
  daily_start_hour: number | null
  daily_start_minute: number | null
  daily_end_hour: number | null
  daily_end_minute: number | null
  allowedGroupIds: string[]
}

export interface ManualEntryAvailability {
  actions: ManualEntryActionAvailability[]
  participants: KioskAvailabilityParticipant[]
  completionIndex: ActionCompletionIndex
}

interface Props {
  eventId: string
  accent: AccentRgb
  submitting: boolean
  onSubmit: (participantExternalId: string, actionCode: string) => Promise<void>
  catalog?: {
    participants: CatalogParticipant[]
    actions: CatalogAction[]
    loading: boolean
  }
  /** When provided (e.g. from kiosk data), task suggestions are filtered per selected player. */
  availability?: ManualEntryAvailability
  /** When true, drops the card chrome + heading so the form can sit inside a custom container. */
  bare?: boolean
}

function filterByQuery<T extends { name: string }>(items: T[], query: string, limit = 8): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return items.filter((item) => item.name.toLowerCase().includes(q)).slice(0, limit)
}

function suggestActions(items: ActionOption[], query: string, limit = 12): ActionOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return items.slice(0, limit)
  return items.filter((item) => item.name.toLowerCase().includes(q)).slice(0, limit)
}

export function ManualEntryForm({
  eventId,
  accent,
  submitting,
  onSubmit,
  catalog,
  availability: availabilityProp,
  bare = false,
}: Props) {
  const [participantQuery, setParticipantQuery] = useState('')
  const [actionQuery, setActionQuery] = useState('')
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantOption | null>(null)
  const [selectedAction, setSelectedAction] = useState<ActionOption | null>(null)
  const [localParticipants, setLocalParticipants] = useState<ParticipantOption[]>([])
  const [localActions, setLocalActions] = useState<ActionOption[]>([])
  const [localCatalogLoading, setLocalCatalogLoading] = useState(!catalog)
  const [localAvailability, setLocalAvailability] = useState<ManualEntryAvailability | null>(null)
  const [localAvailabilityLoading, setLocalAvailabilityLoading] = useState(false)
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false)
  const [showActionDropdown, setShowActionDropdown] = useState(false)
  const [participantBlurred, setParticipantBlurred] = useState(false)
  const [actionBlurred, setActionBlurred] = useState(false)

  const participantInputRef = useRef<HTMLInputElement>(null)
  const participantDropdownRef = useRef<HTMLDivElement>(null)
  const actionDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (catalog) return
    let cancelled = false
    async function loadCatalog() {
      setLocalCatalogLoading(true)
      const [pRes, aRes] = await Promise.all([
        supabase.from('participants').select('id, name, external_id').eq('event_id', eventId).order('name'),
        supabase.from('actions').select('id, name, code, points').eq('event_id', eventId).eq('is_active', true).order('name'),
      ])
      if (cancelled) return
      setLocalParticipants((pRes.data ?? []).map((p) => ({ id: p.id, name: p.name, externalId: p.external_id })))
      setLocalActions((aRes.data ?? []).map((a) => ({ id: a.id, name: a.name, code: a.code, points: a.points })))
      setLocalCatalogLoading(false)
    }
    loadCatalog()
    return () => { cancelled = true }
  }, [eventId, catalog])

  // Fallback eligibility data when parent did not pass live kiosk availability
  useEffect(() => {
    if (availabilityProp || !selectedParticipant) {
      if (!selectedParticipant) setLocalAvailability(null)
      return
    }
    let cancelled = false
    async function loadAvailability() {
      setLocalAvailabilityLoading(true)
      const [actRes, partRes, completionRes] = await Promise.all([
        supabase
          .from('actions')
          .select('id, is_active, max_completions, daily_limit, daily_start_hour, daily_start_minute, daily_end_hour, daily_end_minute, action_groups(group_id)')
          .eq('event_id', eventId)
          .eq('is_active', true),
        supabase
          .from('participants')
          .select('id, participant_groups(group_id)')
          .eq('event_id', eventId)
          .eq('id', selectedParticipant!.id)
          .maybeSingle(),
        supabase
          .from('point_transactions')
          .select('participant_id, action_id, created_at')
          .eq('event_id', eventId)
          .eq('participant_id', selectedParticipant!.id),
      ])
      if (cancelled) return

      const actions: ManualEntryActionAvailability[] = (actRes.data ?? []).map((a) => {
        const joins = (a.action_groups as unknown as { group_id: string }[]) ?? []
        return {
          id: a.id,
          is_active: a.is_active ?? true,
          max_completions: a.max_completions,
          daily_limit: a.daily_limit,
          daily_start_hour: a.daily_start_hour,
          daily_start_minute: a.daily_start_minute,
          daily_end_hour: a.daily_end_hour,
          daily_end_minute: a.daily_end_minute,
          allowedGroupIds: joins.map((j) => j.group_id).filter(Boolean),
        }
      })

      const joins = (partRes.data?.participant_groups as unknown as { group_id: string }[]) ?? []
      const participants: KioskAvailabilityParticipant[] = partRes.data
        ? [{ id: partRes.data.id, groupIds: joins.map((j) => j.group_id).filter(Boolean) }]
        : []

      setLocalAvailability({
        actions,
        participants,
        completionIndex: buildActionCompletionIndex(completionRes.data ?? []),
      })
      setLocalAvailabilityLoading(false)
    }
    loadAvailability()
    return () => { cancelled = true }
  }, [availabilityProp, selectedParticipant, eventId])

  const allParticipants = catalog?.participants ?? localParticipants
  const allActions = catalog?.actions ?? localActions
  const catalogLoading = catalog?.loading ?? localCatalogLoading
  const availability = availabilityProp ?? localAvailability

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (participantDropdownRef.current && !participantDropdownRef.current.contains(e.target as Node))
        setShowParticipantDropdown(false)
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target as Node))
        setShowActionDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const eligibleActions = useMemo(() => {
    if (!selectedParticipant) return []
    if (!availability) {
      // Wait for local eligibility fetch; avoid briefly listing ineligible tasks
      if (!availabilityProp) return []
      return allActions
    }

    const participant = availability.participants.find((p) => p.id === selectedParticipant.id)
    const groupIds = participant?.groupIds ?? []
    const eligibleIds = new Set(
      filterActionsForParticipant(
        availability.actions,
        selectedParticipant.id,
        groupIds,
        availability.completionIndex,
      ).map((a) => a.id),
    )
    return allActions.filter((a) => eligibleIds.has(a.id))
  }, [selectedParticipant, availability, availabilityProp, allActions])

  // Drop a previously chosen task if it is no longer eligible for the current player
  useEffect(() => {
    if (!selectedAction) return
    if (!selectedParticipant || !eligibleActions.some((a) => a.id === selectedAction.id)) {
      setSelectedAction(null)
      setActionQuery('')
      setActionBlurred(false)
    }
  }, [selectedParticipant, eligibleActions, selectedAction])

  const participantSuggestions = useMemo(() => {
    if (selectedParticipant) return []
    return filterByQuery(allParticipants, participantQuery)
  }, [allParticipants, participantQuery, selectedParticipant])

  const actionSuggestions = useMemo(() => {
    if (selectedAction || !selectedParticipant) return []
    return suggestActions(eligibleActions, actionQuery, 12)
  }, [eligibleActions, actionQuery, selectedAction, selectedParticipant])

  const participantSearching = catalogLoading && !selectedParticipant && participantQuery.trim().length > 0
  const actionSearching =
    !!selectedParticipant &&
    !selectedAction &&
    (catalogLoading || (!availabilityProp && localAvailabilityLoading))

  useEffect(() => {
    if (selectedParticipant) return
    setShowParticipantDropdown(participantQuery.trim().length > 0 && participantSuggestions.length > 0)
  }, [participantQuery, participantSuggestions, selectedParticipant])

  useEffect(() => {
    if (selectedAction || !selectedParticipant) {
      if (!selectedParticipant) setShowActionDropdown(false)
      return
    }
    setShowActionDropdown(actionQuery.trim().length > 0 || actionSuggestions.length > 0 || actionSearching)
  }, [actionQuery, actionSuggestions, selectedAction, selectedParticipant, actionSearching])

  function selectParticipant(p: ParticipantOption) {
    setSelectedParticipant(p)
    setParticipantQuery(p.name)
    setShowParticipantDropdown(false)
    setParticipantBlurred(false)
    setSelectedAction(null)
    setActionQuery('')
    setActionBlurred(false)
    setShowActionDropdown(false)
  }
  function clearParticipant() {
    setSelectedParticipant(null)
    setParticipantQuery('')
    setParticipantBlurred(false)
    setSelectedAction(null)
    setActionQuery('')
    setActionBlurred(false)
    setShowActionDropdown(false)
    participantInputRef.current?.focus()
  }
  function selectAction(a: ActionOption) {
    setSelectedAction(a); setActionQuery(a.name); setShowActionDropdown(false); setActionBlurred(false)
  }
  function clearAction() { setSelectedAction(null); setActionQuery(''); setActionBlurred(false) }

  const bothValid = selectedParticipant && selectedAction

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedParticipant || !selectedAction) return
    await onSubmit(selectedParticipant.externalId, selectedAction.code)
    setSelectedParticipant(null); setParticipantQuery('')
    setSelectedAction(null); setActionQuery('')
  }, [selectedParticipant, selectedAction, onSubmit])

  const actionEmptyMessage = !selectedParticipant
    ? 'בחרו שחקן תחילה'
    : actionSearching
      ? 'טוען משימות...'
      : 'אין משימות זמינות למשתתף זה'

  return (
    <form onSubmit={handleSubmit}
      className={cn(
        'space-y-3',
        bare ? 'w-full' : 'w-full max-w-sm rounded-2xl border border-border bg-surface p-4',
      )}>

      {!bare && <p className="text-xs font-black text-muted text-right">הזנה ידנית</p>}

      <AutocompleteField
        label="שחקן"
        placeholder="הקלידו שם משתתף..."
        query={participantQuery}
        onQueryChange={v => { setParticipantQuery(v); setSelectedParticipant(null); setParticipantBlurred(false) }}
        selected={selectedParticipant}
        onSelect={selectParticipant}
        onClear={clearParticipant}
        suggestions={participantSuggestions}
        searching={participantSearching}
        showDropdown={showParticipantDropdown}
        onShowDropdown={setShowParticipantDropdown}
        blurred={participantBlurred}
        onBlurred={() => setParticipantBlurred(true)}
        accent={accent}
        dropdownRef={participantDropdownRef}
        inputRef={participantInputRef}
        getKey={p => p.id}
        renderSelected={p => <span className="truncate text-sm font-medium text-foreground">{p.name}</span>}
        renderOption={p => (
          <>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-foreground"
              style={{ backgroundColor: rgba(accent, 0.22) }}>
              {p.name.slice(0, 2)}
            </div>
            <span className="truncate">{p.name}</span>
            <span className="mr-auto font-mono text-[10px] text-muted">{p.externalId}</span>
          </>
        )}
      />

      <AutocompleteField
        label="משימה"
        placeholder={selectedParticipant ? 'בחרו משימה זמינה...' : 'בחרו שחקן תחילה...'}
        query={actionQuery}
        onQueryChange={v => { setActionQuery(v); setSelectedAction(null); setActionBlurred(false) }}
        selected={selectedAction}
        onSelect={selectAction}
        onClear={clearAction}
        suggestions={actionSuggestions}
        searching={actionSearching}
        showDropdown={showActionDropdown}
        onShowDropdown={setShowActionDropdown}
        blurred={actionBlurred}
        onBlurred={() => setActionBlurred(true)}
        accent={accent}
        dropdownRef={actionDropdownRef}
        getKey={a => a.id}
        listOnFocus={!!selectedParticipant}
        disabled={!selectedParticipant}
        emptyMessage={actionEmptyMessage}
        renderSelected={a => (
          <>
            <span className="truncate text-sm font-medium text-foreground">{a.name}</span>
            <span className={cn('text-[10px] font-bold', a.points >= 0 ? 'text-success-text' : 'text-danger-text')}>
              {a.points >= 0 ? '+' : ''}{a.points}
            </span>
          </>
        )}
        renderOption={a => (
          <div className="flex w-full items-center justify-between gap-2">
            <span className="truncate">{a.name}</span>
            <span className={cn('shrink-0 text-xs font-bold', a.points >= 0 ? 'text-success-text' : 'text-danger-text')}>
              {a.points >= 0 ? '+' : ''}{a.points}
            </span>
          </div>
        )}
      />

      {selectedAction && (
        <p className="text-right text-xs font-bold" style={{ color: rgba(accent, 0.9) }}>
          +{selectedAction.points} נקודות
        </p>
      )}

      <Button
        type="submit"
        variant="gradient"
        size="md"
        loading={submitting}
        disabled={!bothValid}
        className="w-full h-11 font-black text-base">
        <Send size={18} />
        <span>שלח</span>
      </Button>
    </form>
  )
}
