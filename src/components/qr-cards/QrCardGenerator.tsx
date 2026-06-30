import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, Printer, ChevronDown, ChevronUp, User, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import type { Action, Group, ParticipantWithGroups, Event } from '@/types'

interface QrCardGeneratorProps {
  event: Event
  variant?: 'default' | 'wizard'
  onReadyChange?: (fn: (() => void) | null) => void
}

interface ActionGroupJoin { group_id: string; groups: Group }
interface ActionWithGroupIds extends Action { groupIds: string[] }
interface ParticipantSheet { participant: ParticipantWithGroups; actions: ActionWithGroupIds[] }

function formatCardsReadyLabel(count: number): string {
  return count === 1 ? '1 כרטיס מוכן להדפסה' : `${count} כרטיסים מוכנים להדפיסה`
}

export function QrCardGenerator({ event, variant = 'default', onReadyChange }: QrCardGeneratorProps) {
  const isWizard = variant === 'wizard'
  const [participants, setParticipants] = useState<ParticipantWithGroups[]>([])
  const [actions, setActions] = useState<ActionWithGroupIds[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [sheets, setSheets] = useState<ParticipantSheet[]>([])
  const [generated, setGenerated] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    const [participantsRes, actionsRes, groupsRes] = await Promise.all([
      supabase.from('participants').select('*, participant_groups(group_id, groups(*))').eq('event_id', event.id).order('name'),
      supabase.from('actions').select('*, action_groups(group_id, groups(*))').eq('event_id', event.id).eq('is_active', true).order('name'),
      supabase.from('groups').select('*').eq('event_id', event.id).order('name'),
    ])
    const mappedParticipants: ParticipantWithGroups[] = (participantsRes.data ?? []).map((p) => ({
      ...p, groups: ((p.participant_groups as unknown as { group_id: string; groups: Group }[]) ?? []).map((pg) => pg.groups),
    }))
    const mappedActions: ActionWithGroupIds[] = (actionsRes.data ?? []).map((a) => ({
      ...a, groupIds: ((a.action_groups as unknown as ActionGroupJoin[]) ?? []).map((ag) => ag.group_id),
    }))
    setParticipants(mappedParticipants); setActions(mappedActions); setGroups((groupsRes.data ?? []) as Group[]); setLoading(false)
  }, [event.id])

  useEffect(() => { fetchData() }, [fetchData])

  interface GroupBucket { id: string; name: string; color: string; participants: ParticipantWithGroups[] }

  function getGroupBuckets(): GroupBucket[] {
    const buckets: GroupBucket[] = groups.map((g) => ({ id: g.id, name: g.name, color: g.color, participants: participants.filter((p) => p.groups.some((pg) => pg.id === g.id)) }))
    const ungrouped = participants.filter((p) => p.groups.length === 0)
    if (ungrouped.length > 0 && groups.length > 0) buckets.push({ id: '__none__', name: 'ללא קבוצה', color: '#6b7280', participants: ungrouped })
    return buckets.filter((b) => b.participants.length > 0)
  }

  const getRelevantActions = useCallback((participant: ParticipantWithGroups): ActionWithGroupIds[] => {
    const participantGroupIds = new Set(participant.groups.map((g) => g.id))
    return actions.filter((action) => action.groupIds.length === 0 || action.groupIds.some((gid) => participantGroupIds.has(gid)))
  }, [actions])

  const handleGenerate = useCallback(() => {
    const built: ParticipantSheet[] = participants.map((p) => ({ participant: p, actions: getRelevantActions(p) })).filter((s) => s.actions.length > 0)
    setSheets(built); setGenerated(true)
  }, [participants, getRelevantActions])

  const showGenerateButton = useMemo(
    () => !loading && participants.length > 0 && actions.length > 0 && !generated,
    [loading, participants.length, actions.length, generated] // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    if (!onReadyChange || !isWizard) return
    onReadyChange(showGenerateButton ? handleGenerate : null)
    return () => { onReadyChange(null) }
  }, [showGenerateButton, handleGenerate, isWizard, onReadyChange])

  function handlePrint() {
    const content = printRef.current; if (!content) return
    const printWindow = window.open('', '_blank'); if (!printWindow) return
    const c = '#7c3aed'

    printWindow.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8" />
<title>כרטיסי QR – ${event.name}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; padding: 10mm; }

.participant-section { margin-bottom: 20px; }
.participant-divider { display: flex; align-items: center; gap: 8px; margin: 14px 0 12px; padding: 6px 0; border-bottom: 2.5px solid ${c}; }
.participant-divider .name { font-size: 15px; font-weight: 800; color: #111; }
.participant-divider .group-dots { display: flex; gap: 4px; }
.participant-divider .group-dot { width: 9px; height: 9px; border-radius: 50%; }

.cards-grid { display: flex; flex-wrap: wrap; gap: 12px; }

.card {
  width: 310px; border-radius: 16px; overflow: hidden; display: flex; direction: ltr;
  border: 1.5px solid #e0e0e0; background: #fff; break-inside: avoid;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card .qr-side {
  flex-shrink: 0; width: 120px; padding: 14px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 6px;
  background: linear-gradient(135deg, ${c}08 0%, ${c}03 100%);
  border-left: 3px solid ${c};
}
.card .qr-side svg { display: block; }
.card .qr-side .scan-text { font-size: 7px; color: #999; text-align: center; direction: rtl; letter-spacing: 0.3px; }

.card .info-side {
  flex: 1; padding: 14px 16px; display: flex; flex-direction: column; justify-content: center;
  direction: rtl; min-width: 0; gap: 2px;
}

.card .event-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.card .event-logo { width: 18px; height: 18px; border-radius: 4px; object-fit: cover; }
.card .event-label { font-size: 9px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.card .action-name {
  font-size: 16px; font-weight: 800; color: #111; margin-bottom: 4px;
  line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.card .participant-badge {
  display: inline-flex; align-items: center; gap: 4px; background: ${c}12; border: 1px solid ${c}25;
  border-radius: 20px; padding: 3px 10px; font-size: 10px; font-weight: 600; color: #333;
  width: fit-content; margin-bottom: 6px;
}
.card .participant-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: ${c}; }

.card .points-row {
  display: flex; align-items: center; gap: 5px; margin-top: 2px;
}
.card .points-value {
  font-size: 18px; font-weight: 900; color: ${c}; letter-spacing: -0.5px;
}
.card .points-label { font-size: 10px; color: #666; font-weight: 500; }
.card .points-icon { font-size: 14px; }

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .card { box-shadow: none; }
}
</style></head><body>${content.innerHTML}</body></html>`)
    printWindow.document.close(); printWindow.focus()
    setTimeout(() => printWindow.print(), 300)
  }

  const totalCards = sheets.reduce((sum, s) => sum + s.actions.length, 0)
  const previewTotalCards = participants.reduce((sum, p) => sum + getRelevantActions(p).length, 0)

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>

  if (participants.length === 0 || actions.length === 0) {
    return (
      <div className="rounded-2xl border border-game-border bg-game-card p-6 text-center">
        <QrCode size={32} className="mx-auto text-gray-600 mb-3" />
        <p className="text-sm text-gray-400">
          {participants.length === 0 ? 'אין משתתפים – הוסיפו משתתפים כדי ליצור כרטיסים' : 'אין משימות פעילות – הוסיפו משימות כדי ליצור כרטיסים'}
        </p>
      </div>
    )
  }

  return (
    <div>
      {!isWizard && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20"><QrCode size={18} className="text-brand-400" /></div>
            <h2 className="text-lg font-bold text-white">כרטיסי QR למשתתפים</h2>
          </div>
        </div>
      )}

      {!generated ? (
        <div>
          {/* Card is its own scroll region so nothing can bleed past its bottom edge */}
          <div className="rounded-2xl border border-game-border bg-game-card p-5 space-y-3 overflow-y-auto max-h-[42vh]" style={{ scrollbarGutter: 'stable' }}>
            <p className="text-sm text-gray-300">{isWizard ? 'לכל משתתף ייווצר דף כרטיסים אישי עם כל הפעילויות הזמינות עבורו.' : 'לכל משתתף יופק דף נפרד עם כרטיסי QR עבור המשימות הרלוונטיות לקבוצות שלו.'}</p>

            {groups.length === 0 ? (
              <div className="rounded-xl border border-game-border bg-game-dark">
                <button type="button" onClick={() => setExpandedGroup(expandedGroup === '__flat__' ? null : '__flat__')} className="flex w-full items-center gap-2 px-3 py-2 text-right">
                  <User size={14} className="text-gray-500 shrink-0" /><span className="text-sm text-gray-200 flex-1">{participants.length} משתתפים</span>
                  {expandedGroup === '__flat__' ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </button>
                {expandedGroup === '__flat__' && (
                  <div className="border-t border-game-border space-y-1 p-1.5 max-h-56 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
                    {participants.map((p) => { const ra = getRelevantActions(p); const isExp = expandedParticipant === p.id; return (
                      <div key={p.id} className="rounded-lg border border-game-border/50 bg-game-card/50">
                        <button type="button" onClick={() => setExpandedParticipant(isExp ? null : p.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-right">
                          <User size={12} className="text-gray-600 shrink-0" /><span className="text-sm text-white flex-1 truncate">{p.name}</span><span className="text-xs text-gray-500 shrink-0">{ra.length} כרטיסים</span>
                          {isExp ? <ChevronUp size={12} className="text-gray-600" /> : <ChevronDown size={12} className="text-gray-600" />}
                        </button>
                        {isExp && <div className="px-3 pb-2 space-y-1">{ra.map((a) => (<div key={a.id} className="flex items-center gap-2 text-xs text-gray-400 pr-5"><span className="truncate">{a.name}</span><span className="text-gray-600">({a.points >= 0 ? '+' : ''}{a.points} נק׳)</span></div>))}</div>}
                      </div>
                    ) })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {getGroupBuckets().map((bucket) => { const isGO = expandedGroup === bucket.id; return (
                  <div key={bucket.id} className="rounded-xl border border-game-border bg-game-dark">
                    <button type="button" onClick={() => setExpandedGroup(isGO ? null : bucket.id)} className="flex w-full items-center gap-2 px-3 py-2 text-right">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: bucket.color }} /><span className="text-sm text-gray-200 flex-1 truncate">{bucket.name}</span><span className="text-xs text-gray-500 shrink-0">{bucket.participants.length} משתתפים</span>
                      {isGO ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                    </button>
                    {isGO && (<div className="border-t border-game-border space-y-1 p-1.5 max-h-48 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
                      {bucket.participants.map((p) => { const ra = getRelevantActions(p); const isExp = expandedParticipant === `${bucket.id}:${p.id}`; return (
                        <div key={p.id} className="rounded-lg border border-game-border/50 bg-game-card/50">
                          <button type="button" onClick={() => setExpandedParticipant(isExp ? null : `${bucket.id}:${p.id}`)} className="flex w-full items-center gap-2 px-3 py-1.5 text-right">
                            <User size={12} className="text-gray-600 shrink-0" /><span className="text-sm text-white flex-1 truncate">{p.name}</span><span className="text-xs text-gray-500 shrink-0">{ra.length} כרטיסים</span>
                            {isExp ? <ChevronUp size={12} className="text-gray-600" /> : <ChevronDown size={12} className="text-gray-600" />}
                          </button>
                          {isExp && (<div className="px-3 pb-2 space-y-1">{ra.map((a) => (<div key={a.id} className="flex items-center gap-2 text-xs text-gray-400 pr-5"><span className="truncate">{a.name}</span><span className="text-gray-600">({a.points >= 0 ? '+' : ''}{a.points} נק׳)</span></div>))}
                            {ra.length === 0 && <p className="text-xs text-gray-600 pr-5">אין משימות רלוונטיות</p>}
                          </div>)}
                        </div>
                      ) })}
                    </div>)}
                  </div>
                ) })}
              </div>
            )}

            <div className="rounded-xl border border-game-border bg-game-dark/50 p-3 text-center">
              <p className="text-sm text-gray-400">{isWizard ? formatCardsReadyLabel(previewTotalCards) : (<><span className="font-bold text-white">{participants.length}</span> משתתפים × <span className="font-bold text-white">{actions.length}</span> משימות = סה״כ <span className="font-bold text-white">{previewTotalCards}</span> כרטיסים (לפי קבוצות)</>)}</p>
            </div>
          </div>

          {/* Sticky print button — non-wizard mode only; wizard mode uses footerBar slot */}
          {!isWizard && (
            <div className="sticky bottom-0 z-10 pt-10 pb-2 border-t border-game-border" style={{ background: '#0f0b1e' }}>
              <Button onClick={handleGenerate} className="w-full"><Printer size={16} className="ml-1.5" />יצירת כרטיסים</Button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <button type="button" onClick={() => setGenerated(false)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-game-border text-gray-400 hover:bg-white/5 hover:text-white transition-colors"><X size={16} /></button>
            <Button onClick={handlePrint}><Printer size={16} className="ml-1.5" />{isWizard ? 'הדפס כרטיסים' : 'הדפסה'}</Button>
            <span className="text-sm text-gray-400">{sheets.length} משתתפים • {totalCards} כרטיסים</span>
          </div>

          <div className="rounded-2xl border border-game-border bg-white overflow-auto max-h-[70vh]" style={{ scrollbarGutter: 'stable' }}>
            <div ref={printRef} className="p-6">
              {sheets.map((sheet) => (<ParticipantPage key={sheet.participant.id} sheet={sheet} event={event} />))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ParticipantPage({ sheet, event }: { sheet: ParticipantSheet; event: Event }) {
  const { participant, actions } = sheet
  const c = '#7c3aed'

  return (
    <div className="participant-section" style={{ marginBottom: '20px' }}>
      <div className="participant-divider" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0 12px', padding: '6px 0', borderBottom: `2.5px solid ${c}` }}>
        <span className="name" style={{ fontSize: '15px', fontWeight: 800, color: '#111' }}>{participant.name}</span>
        {participant.groups.length > 0 && (
          <div className="group-dots" style={{ display: 'flex', gap: '4px' }}>
            {participant.groups.map((g) => (<span key={g.id} className="group-dot" style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: g.color }} title={g.name} />))}
          </div>
        )}
      </div>

      <div className="cards-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {actions.map((action) => (
          <div key={action.id} className="card" style={{ width: '310px', borderRadius: '16px', border: '1.5px solid #e0e0e0', overflow: 'hidden', display: 'flex', direction: 'ltr', background: '#fff', breakInside: 'avoid', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            {/* QR side */}
            <div className="qr-side" style={{ flexShrink: 0, width: '120px', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', background: `linear-gradient(135deg, ${c}08 0%, ${c}03 100%)`, borderLeft: `3px solid ${c}` }}>
              <QRCodeSVG
                value={JSON.stringify({ participantCode: participant.external_id, actionCode: action.code })}
                size={90} level="M" fgColor="#111"
              />
              <span className="scan-text" style={{ fontSize: '7px', color: '#999', textAlign: 'center', direction: 'rtl', letterSpacing: '0.3px' }}>סרקו לקבלת הנקודות</span>
            </div>

            {/* Info side */}
            <div className="info-side" style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: 'rtl', minWidth: 0, gap: '2px' }}>
              {/* Event row */}
              <div className="event-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                {event.logo_url && <img src={event.logo_url} alt="" className="event-logo" style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }} />}
                <span className="event-label" style={{ fontSize: '9px', color: '#999' }}>{event.name}</span>
              </div>

              {/* Task title */}
              <div className="action-name" style={{ fontSize: '16px', fontWeight: 800, color: '#111', marginBottom: '4px', lineHeight: 1.2 }}>
                {action.name}
              </div>

              {/* Participant badge */}
              <div className="participant-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${c}12`, border: `1px solid ${c}25`, borderRadius: '20px', padding: '3px 10px', fontSize: '10px', fontWeight: 600, color: '#333', width: 'fit-content', marginBottom: '6px' }}>
                <span className="dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />
                {participant.name}
              </div>

              {/* Points */}
              <div className="points-row" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                <span className="points-icon" style={{ fontSize: '14px' }}>⭐</span>
                <span className="points-value" style={{ fontSize: '18px', fontWeight: 900, color: c, letterSpacing: '-0.5px' }}>
                  +{action.points}
                </span>
                <span className="points-label" style={{ fontSize: '10px', color: '#666', fontWeight: 500 }}>נקודות</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
