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

interface ParticipantOption { id: string; name: string; externalId: string }
interface ActionOption { id: string; name: string; code: string; points: number }

interface Props {
  eventId: string
  accent: AccentRgb
  bonusMissions: Action[]
  submitting: boolean
  onSubmit: (participantExternalId: string, actionCode: string) => Promise<void>
}

export function ManualEntryForm({ eventId, accent, bonusMissions, submitting, onSubmit }: Props) {
  const [participantQuery, setParticipantQuery] = useState('')
  const [actionQuery, setActionQuery] = useState('')
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantOption | null>(null)
  const [selectedAction, setSelectedAction] = useState<ActionOption | null>(null)
  const [participantSuggestions, setParticipantSuggestions] = useState<ParticipantOption[]>([])
  const [actionSuggestions, setActionSuggestions] = useState<ActionOption[]>([])
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false)
  const [showActionDropdown, setShowActionDropdown] = useState(false)
  const [participantSearching, setParticipantSearching] = useState(false)
  const [actionSearching, setActionSearching] = useState(false)
  const [participantBlurred, setParticipantBlurred] = useState(false)
  const [actionBlurred, setActionBlurred] = useState(false)

  const participantInputRef = useRef<HTMLInputElement>(null)
  const participantDropdownRef = useRef<HTMLDivElement>(null)
  const actionDropdownRef = useRef<HTMLDivElement>(null)
  const pSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close dropdowns on outside click
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

  // Participant search
  useEffect(() => {
    if (pSearchRef.current) clearTimeout(pSearchRef.current)
    if (selectedParticipant) return
    const q = participantQuery.trim()
    if (!q) { setParticipantSuggestions([]); setShowParticipantDropdown(false); setParticipantSearching(false); return }
    setParticipantSearching(true); setShowParticipantDropdown(true)
    pSearchRef.current = setTimeout(async () => {
      const { data } = await supabase.from('participants').select('id, name, external_id').eq('event_id', eventId).ilike('name', `%${q}%`).limit(8)
      setParticipantSuggestions((data ?? []).map(p => ({ id: p.id, name: p.name, externalId: p.external_id })))
      setParticipantSearching(false); setShowParticipantDropdown(true)
    }, 300)
    return () => { if (pSearchRef.current) clearTimeout(pSearchRef.current) }
  }, [participantQuery, selectedParticipant, eventId])

  // Action search
  useEffect(() => {
    if (aSearchRef.current) clearTimeout(aSearchRef.current)
    if (selectedAction) return
    const q = actionQuery.trim()
    if (!q) { setActionSuggestions([]); setShowActionDropdown(false); setActionSearching(false); return }
    setActionSearching(true); setShowActionDropdown(true)
    aSearchRef.current = setTimeout(async () => {
      const { data } = await supabase.from('actions').select('id, name, code, points, is_active').eq('event_id', eventId).eq('is_active', true).ilike('name', `%${q}%`).limit(8)
      setActionSuggestions((data ?? []).map(a => ({ id: a.id, name: a.name, code: a.code, points: a.points })))
      setActionSearching(false); setShowActionDropdown(true)
    }, 300)
    return () => { if (aSearchRef.current) clearTimeout(aSearchRef.current) }
  }, [actionQuery, selectedAction, eventId])

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

  // Bonus detection
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
      className="w-full max-w-sm rounded-2xl border p-4 space-y-3"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: activeBonus ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.08)',
        transition: 'border-color 0.4s ease',
      }}>

      <p className="text-xs font-black text-gray-400 text-right">הזנה ידנית</p>

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
        renderSelected={p => <span className="truncate text-sm font-medium text-white">{p.name}</span>}
        renderOption={p => (
          <>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: rgba(accent, 0.22) }}>
              {p.name.slice(0, 2)}
            </div>
            <span className="truncate">{p.name}</span>
            <span className="mr-auto font-mono text-[10px] text-gray-500">{p.externalId}</span>
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
            <span className="truncate text-sm font-medium text-white">{a.name}</span>
            <span className={`text-[10px] font-bold ${a.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {a.points >= 0 ? '+' : ''}{a.points}
            </span>
          </>
        )}
        renderOption={a => (
          <div className="flex w-full items-center justify-between gap-2">
            <span className="truncate">{a.name}</span>
            <span className={`shrink-0 text-xs font-bold ${a.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {a.points >= 0 ? '+' : ''}{a.points}
            </span>
          </div>
        )}
      />

      {/* Points preview */}
      {selectedAction && (
        <motion.div
          className="text-right text-xs"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}>
          {activeBonus ? (
            <span className="text-orange-300 font-bold">
              <span className="line-through text-gray-500 mr-1">+{selectedAction.points}</span>
              🔥 +{activeBonus.boostedPoints} נק׳ ({activeBonus.label} בונוס!)
            </span>
          ) : (
            <span style={{ color: rgba(accent, 0.9) }} className="font-bold">
              +{selectedAction.points} נקודות
            </span>
          )}
        </motion.div>
      )}

      {/* Submit button with optional bonus badge */}
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
            className="absolute -top-2.5 -right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black"
            style={{ background: 'rgba(249,115,22,0.9)', color: '#fff' }}
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
