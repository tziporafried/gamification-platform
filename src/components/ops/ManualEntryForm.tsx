import { useState, useEffect, useRef, useCallback, useMemo, FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Send, Flame } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { AutocompleteField } from '@/components/scoring/AutocompleteField'
import type { AccentRgb } from '@/lib/accentColor'
import { rgba } from '@/lib/accentColor'
import type { Action } from '@/types'
import { getMissionStatus } from '@/lib/missionUtils'
import type { CatalogAction, CatalogParticipant } from '@/hooks/useEventCatalog'
import { cn } from '@/lib/utils'

interface ParticipantOption { id: string; name: string; externalId: string }
interface ActionOption { id: string; name: string; code: string; points: number }

interface Props {
  eventId: string
  accent: AccentRgb
  bonusMissions: Action[]
  submitting: boolean
  onSubmit: (participantExternalId: string, actionCode: string) => Promise<void>
  catalog?: {
    participants: CatalogParticipant[]
    actions: CatalogAction[]
    loading: boolean
  }
}

function filterByQuery<T extends { name: string }>(items: T[], query: string, limit = 8): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return items.filter((item) => item.name.toLowerCase().includes(q)).slice(0, limit)
}

export function ManualEntryForm({ eventId, accent, bonusMissions, submitting, onSubmit, catalog }: Props) {
  const [participantQuery, setParticipantQuery] = useState('')
  const [actionQuery, setActionQuery] = useState('')
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantOption | null>(null)
  const [selectedAction, setSelectedAction] = useState<ActionOption | null>(null)
  const [localParticipants, setLocalParticipants] = useState<ParticipantOption[]>([])
  const [localActions, setLocalActions] = useState<ActionOption[]>([])
  const [localCatalogLoading, setLocalCatalogLoading] = useState(!catalog)
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

  const allParticipants = catalog?.participants ?? localParticipants
  const allActions = catalog?.actions ?? localActions
  const catalogLoading = catalog?.loading ?? localCatalogLoading

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

  const participantSuggestions = useMemo(() => {
    if (selectedParticipant) return []
    return filterByQuery(allParticipants, participantQuery)
  }, [allParticipants, participantQuery, selectedParticipant])

  const actionSuggestions = useMemo(() => {
    if (selectedAction) return []
    return filterByQuery(allActions, actionQuery)
  }, [allActions, actionQuery, selectedAction])

  const participantSearching = catalogLoading && !selectedParticipant && participantQuery.trim().length > 0
  const actionSearching = catalogLoading && !selectedAction && actionQuery.trim().length > 0

  useEffect(() => {
    if (selectedParticipant) return
    setShowParticipantDropdown(participantQuery.trim().length > 0 && participantSuggestions.length > 0)
  }, [participantQuery, participantSuggestions, selectedParticipant])

  useEffect(() => {
    if (selectedAction) return
    setShowActionDropdown(actionQuery.trim().length > 0 && actionSuggestions.length > 0)
  }, [actionQuery, actionSuggestions, selectedAction])

  function selectParticipant(p: ParticipantOption) {
    setSelectedParticipant(p); setParticipantQuery(p.name); setShowParticipantDropdown(false); setParticipantBlurred(false)
  }
  function clearParticipant() {
    setSelectedParticipant(null); setParticipantQuery(''); setParticipantBlurred(false); participantInputRef.current?.focus()
  }
  function selectAction(a: ActionOption) {
    setSelectedAction(a); setActionQuery(a.name); setShowActionDropdown(false); setActionBlurred(false)
  }
  function clearAction() { setSelectedAction(null); setActionQuery(''); setActionBlurred(false) }

  const activeBonus = useMemo(() => {
    if (!selectedAction) return null
    const bm = bonusMissions.find(b => b.id === selectedAction.id && getMissionStatus(b) === 'active')
    if (!bm) return null
    const mult = Math.max(2, bm.speed_multiplier ?? 2)
    const boostedPoints = bm.speed_bonus_flat_points != null
      ? selectedAction.points + bm.speed_bonus_flat_points
      : Math.round(selectedAction.points * mult)
    return { mult, boostedPoints, label: bm.speed_bonus_flat_points != null ? `+${bm.speed_bonus_flat_points}` : `×${mult}` }
  }, [selectedAction, bonusMissions])

  const bothValid = selectedParticipant && selectedAction

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedParticipant || !selectedAction) return
    await onSubmit(selectedParticipant.externalId, selectedAction.code)
    setSelectedParticipant(null); setParticipantQuery('')
    setSelectedAction(null); setActionQuery('')
  }, [selectedParticipant, selectedAction, onSubmit])

  return (
    <form onSubmit={handleSubmit}
      className={cn(
        'w-full max-w-sm rounded-2xl border bg-surface p-4 space-y-3 transition-colors duration-400',
        activeBonus ? 'border-warning' : 'border-border',
      )}>

      <p className="text-xs font-black text-muted text-right">הזנה ידנית</p>

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
        placeholder="הקלידו שם משימה..."
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
        renderSelected={a => (
          <>
            <span className="truncate text-sm font-medium text-foreground">{a.name}</span>
            <span className={cn('text-[10px] font-bold', a.points >= 0 ? 'text-success' : 'text-danger')}>
              {a.points >= 0 ? '+' : ''}{a.points}
            </span>
          </>
        )}
        renderOption={a => (
          <div className="flex w-full items-center justify-between gap-2">
            <span className="truncate">{a.name}</span>
            <span className={cn('shrink-0 text-xs font-bold', a.points >= 0 ? 'text-success' : 'text-danger')}>
              {a.points >= 0 ? '+' : ''}{a.points}
            </span>
          </div>
        )}
      />

      {selectedAction && (
        <motion.div
          className="text-right text-xs"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}>
          {activeBonus ? (
            <span className="text-warning font-bold">
              <span className="line-through text-muted mr-1">+{selectedAction.points}</span>
              🔥 +{activeBonus.boostedPoints} נק׳ ({activeBonus.label} בונוס!)
            </span>
          ) : (
            <span style={{ color: rgba(accent, 0.9) }} className="font-bold">
              +{selectedAction.points} נקודות
            </span>
          )}
        </motion.div>
      )}

      <div className="relative">
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
        {activeBonus && (
          <motion.div
            className="absolute -top-2.5 -right-2 flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[10px] font-black text-foreground"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}>
            <Flame size={9} />
            {activeBonus.label}
          </motion.div>
        )}
      </div>
    </form>
  )
}
