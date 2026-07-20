import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, Printer, ChevronDown, ChevronUp, User, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { PanelCard } from '@/components/ui/PanelCard'
import { theme } from '@/lib/theme'
import { computeCardCounts, isActionRelevantTo, type CardCounts } from '@/lib/cardCounts'

export type { CardCounts }
import type { Action, Group, ParticipantWithGroups, Event, ScanMode } from '@/types'

interface QrCardGeneratorProps {
  event: Event
  /** Which deck to lay out. Chosen at print time; not stored on the event. */
  scanMode: ScanMode
  onReadyChange?: (fn: (() => void) | null) => void
  /**
   * Both deck sizes, computed from the rows actually being printed. Callers must
   * use these rather than deriving from `useEventCounts` — that counts every
   * action row, including inactive ones, and cannot see group targeting.
   */
  onCardCountsChange?: (counts: CardCounts) => void
  onGeneratedChange?: (generated: boolean) => void
}

interface ActionGroupJoin { group_id: string; groups: Group }
interface ActionWithGroupIds extends Action { groupIds: string[] }
interface ParticipantSheet { participant: ParticipantWithGroups; actions: ActionWithGroupIds[] }

/** Palette literals for print/card inline styles (matches design-tokens.css) */
const CARD_PALETTE = {
  primary: '#AB3500',
  foreground: '#2E221E',
  muted: '#7D706A',
  border: '#E7D6CF',
  surface: '#FFFFFF',
} as const

/** Set to true to show the participant/group accordion before card generation. */
const SHOW_PARTICIPANT_ACCORDION = false

export function QrCardGenerator({ event, scanMode, onReadyChange, onCardCountsChange, onGeneratedChange }: QrCardGeneratorProps) {
  const isSplit = scanMode === 'split'
  const [participants, setParticipants] = useState<ParticipantWithGroups[]>([])
  const [actions, setActions] = useState<ActionWithGroupIds[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
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
    if (ungrouped.length > 0 && groups.length > 0) buckets.push({ id: '__none__', name: 'ללא קבוצה', color: 'var(--color-muted)', participants: ungrouped })
    return buckets.filter((b) => b.participants.length > 0)
  }

  const getRelevantActions = useCallback((participant: ParticipantWithGroups): ActionWithGroupIds[] => {
    const participantGroupIds = new Set(participant.groups.map((g) => g.id))
    return actions.filter((action) => isActionRelevantTo(action, participantGroupIds))
  }, [actions])

  // Counted from the same rows and the same targeting rule that lay the deck
  // out, so the advertised number cannot drift from what actually prints.
  const cardCounts = useMemo<CardCounts>(
    () => computeCardCounts(
      participants.map((p) => ({ groupIds: p.groups.map((g) => g.id) })),
      actions,
    ),
    [participants, actions],
  )

  useEffect(() => {
    if (loading) return
    onCardCountsChange?.(cardCounts)
  }, [loading, cardCounts, onCardCountsChange])

  useEffect(() => {
    onGeneratedChange?.(generated)
  }, [generated, onGeneratedChange])

  // Derived, not snapshotted on generate — the scan mode is chosen in the same
  // click that generates, so a snapshot would lay out the previous mode.
  const sheets = useMemo<ParticipantSheet[]>(
    () => isSplit
      ? []
      : participants.map((p) => ({ participant: p, actions: getRelevantActions(p) })).filter((s) => s.actions.length > 0),
    [isSplit, participants, getRelevantActions],
  )

  const handleGenerate = useCallback(() => { setGenerated(true) }, [])

  const showGenerateButton = useMemo(
    () => !loading && participants.length > 0 && actions.length > 0 && !generated,
    [loading, participants.length, actions.length, generated] // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    if (!onReadyChange) return
    onReadyChange(showGenerateButton ? handleGenerate : null)
    return () => { onReadyChange(null) }
  }, [showGenerateButton, handleGenerate, onReadyChange])

  function handlePrint() {
    const content = printRef.current; if (!content) return
    const printWindow = window.open('', '_blank'); if (!printWindow) return
    const c = CARD_PALETTE.primary

    printWindow.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8" />
<title>כרטיסי ברקוד – ${event.name}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; padding: 10mm; }

.participant-section { margin-bottom: 20px; }
.section-heading { font-size: 17px; font-weight: 900; color: ${CARD_PALETTE.foreground}; margin: 18px 0 4px; }
.section-hint { font-size: 11px; color: ${CARD_PALETTE.muted}; margin-bottom: 10px; }
.participant-divider { display: flex; align-items: center; gap: 8px; margin: 14px 0 12px; padding: 6px 0; border-bottom: 2.5px solid ${c}; }
.participant-divider .name { font-size: 15px; font-weight: 800; color: ${CARD_PALETTE.foreground}; }
.participant-divider .group-dots { display: flex; gap: 4px; }
.participant-divider .group-dot { width: 9px; height: 9px; border-radius: 50%; }

.cards-grid { display: flex !important; flex-wrap: wrap !important; gap: 12px; }

.card {
  width: 310px !important; border-radius: 16px; overflow: hidden; display: flex; direction: ltr;
  border: 1.5px solid ${CARD_PALETTE.border}; background: ${CARD_PALETTE.surface}; break-inside: avoid;
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
.card .qr-side .scan-text { font-size: 7px; color: ${CARD_PALETTE.muted}; text-align: center; direction: rtl; letter-spacing: 0.3px; }

.card .info-side {
  flex: 1; padding: 14px 16px; display: flex; flex-direction: column; justify-content: center;
  direction: rtl; min-width: 0; gap: 2px;
}

.card .event-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.card .event-logo { width: 18px; height: 18px; border-radius: 4px; object-fit: cover; }
.card .event-label { font-size: 9px; color: ${CARD_PALETTE.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.card .action-name {
  font-size: 16px; font-weight: 800; color: ${CARD_PALETTE.foreground}; margin-bottom: 4px;
  line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.card .participant-badge {
  display: inline-flex; align-items: center; gap: 4px; background: ${c}12; border: 1px solid ${c}25;
  border-radius: 20px; padding: 3px 10px; font-size: 10px; font-weight: 600; color: ${CARD_PALETTE.foreground};
  width: fit-content; margin-bottom: 6px;
}
.card .participant-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: ${c}; }

.card .points-row {
  display: flex; align-items: center; gap: 5px; margin-top: 2px;
}
.card .points-value {
  font-size: 18px; font-weight: 900; color: ${c}; letter-spacing: -0.5px;
}
.card .points-label { font-size: 10px; color: ${CARD_PALETTE.muted}; font-weight: 500; }
.card .points-icon { font-size: 14px; }

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .card { box-shadow: none; }
}
</style></head><body>${content.innerHTML}</body></html>`)
    printWindow.document.close(); printWindow.focus()
    setTimeout(() => printWindow.print(), 300)
  }

  if (loading) return <CenteredLoader />

  if (participants.length === 0 || actions.length === 0) {
    return (
      <PanelCard size="lg" className="text-center">
        <QrCode size={32} className="mx-auto text-muted mb-3" />
        <p className={cn('text-sm', theme.textMuted)}>
          {participants.length === 0 ? 'אין משתתפים – הוסיפו משתתפים כדי ליצור כרטיסים' : 'אין משימות פעילות – הוסיפו משימות כדי ליצור כרטיסים'}
        </p>
      </PanelCard>
    )
  }

  return (
    <div>
      {!generated ? (
        SHOW_PARTICIPANT_ACCORDION ? (
        <div className="space-y-3">
          {groups.length === 0 ? (
              <div className={theme.surfaceInset}>
                <button type="button" onClick={() => setExpandedGroup(expandedGroup === '__flat__' ? null : '__flat__')} className="flex w-full items-center gap-2 px-3 py-2 text-right">
                  <User size={14} className="text-muted shrink-0" /><span className="text-sm text-foreground flex-1">{participants.length} משתתפים</span>
                  {expandedGroup === '__flat__' ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                </button>
                {expandedGroup === '__flat__' && (
                  <div className="border-t border-border space-y-1 p-1.5 max-h-56 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
                    {participants.map((p) => { const ra = getRelevantActions(p); const isExp = expandedParticipant === p.id; return (
                      <div key={p.id} className="rounded-lg border border-border/50 bg-surface">
                        <button type="button" onClick={() => setExpandedParticipant(isExp ? null : p.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-right">
                          <User size={12} className="text-muted shrink-0" /><span className="text-sm text-foreground flex-1 truncate">{p.name}</span><span className="text-xs text-muted shrink-0">{ra.length} כרטיסים</span>
                          {isExp ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
                        </button>
                        {isExp && <div className="px-3 pb-2 space-y-1">{ra.map((a) => (<div key={a.id} className="flex items-center gap-2 text-xs text-muted pr-5"><span className="truncate">{a.name}</span><span className="text-muted">({a.points >= 0 ? '+' : ''}{a.points} נק׳)</span></div>))}</div>}
                      </div>
                    ) })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {getGroupBuckets().map((bucket) => { const isGO = expandedGroup === bucket.id; return (
                  <div key={bucket.id} className={theme.surfaceInset}>
                    <button type="button" onClick={() => setExpandedGroup(isGO ? null : bucket.id)} className="flex w-full items-center gap-2 px-3 py-2 text-right">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: bucket.color }} /><span className="text-sm text-foreground flex-1 truncate">{bucket.name}</span><span className="text-xs text-muted shrink-0">{bucket.participants.length} משתתפים</span>
                      {isGO ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                    </button>
                    {isGO && (<div className="border-t border-border space-y-1 p-1.5 max-h-48 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
                      {bucket.participants.map((p) => { const ra = getRelevantActions(p); const isExp = expandedParticipant === `${bucket.id}:${p.id}`; return (
                        <div key={p.id} className="rounded-lg border border-border/50 bg-surface">
                          <button type="button" onClick={() => setExpandedParticipant(isExp ? null : `${bucket.id}:${p.id}`)} className="flex w-full items-center gap-2 px-3 py-1.5 text-right">
                            <User size={12} className="text-muted shrink-0" /><span className="text-sm text-foreground flex-1 truncate">{p.name}</span><span className="text-xs text-muted shrink-0">{ra.length} כרטיסים</span>
                            {isExp ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
                          </button>
                          {isExp && (<div className="px-3 pb-2 space-y-1">{ra.map((a) => (<div key={a.id} className="flex items-center gap-2 text-xs text-muted pr-5"><span className="truncate">{a.name}</span><span className="text-muted">({a.points >= 0 ? '+' : ''}{a.points} נק׳)</span></div>))}
                            {ra.length === 0 && <p className="text-xs text-muted pr-5">אין משימות רלוונטיות</p>}
                          </div>)}
                        </div>
                      ) })}
                    </div>)}
                  </div>
                ) })}
              </div>
            )}

        </div>
        ) : null
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <button type="button" onClick={() => setGenerated(false)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-elevated hover:text-foreground transition-colors"><X size={16} /></button>
            <Button onClick={handlePrint}><Printer size={16} className="ml-1.5" />הדפס כרטיסים</Button>
            <span className="text-xs text-muted">אפשר להדפיס שוב כרטיסים בכל שלב במהלך הפעילות.</span>
          </div>

          <div className="rounded-2xl border border-border bg-surface">
            <div ref={printRef} className="p-6">
              {isSplit ? (
                <SplitPages participants={participants} actions={actions} event={event} wizardPreview />
              ) : (
                sheets.map((sheet) => (<ParticipantPage key={sheet.participant.id} sheet={sheet} event={event} wizardPreview />))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Split-mode sheet: participant cards, then action cards. The two are printed
 * as separate decks because scoring pairs one of each at scan time.
 */
function SplitPages({
  participants,
  actions,
  event,
  wizardPreview = false,
}: {
  participants: ParticipantWithGroups[]
  actions: ActionWithGroupIds[]
  event: Event
  wizardPreview?: boolean
}) {
  const c = CARD_PALETTE.primary

  const gridStyle = {
    display: wizardPreview ? 'grid' : 'flex',
    gridTemplateColumns: wizardPreview ? 'repeat(2, minmax(0, 1fr))' : undefined,
    flexWrap: wizardPreview ? undefined : ('wrap' as const),
    gap: '12px',
  }

  return (
    <>
      <div className="participant-section" style={{ marginBottom: '24px' }}>
        <div className="section-heading" style={{ fontSize: '17px', fontWeight: 900, color: CARD_PALETTE.foreground, margin: '0 0 4px' }}>
          כרטיסי משתתפים
        </div>
        <div className="section-hint" style={{ fontSize: '11px', color: CARD_PALETTE.muted, marginBottom: '10px' }}>
          נסרקים ראשונים — לפני כרטיס המשימה.
        </div>
        <div className="cards-grid" style={gridStyle}>
          {participants.map((participant) => (
            <QrCard
              key={participant.id}
              event={event}
              wizardPreview={wizardPreview}
              payload={{ participantCode: participant.external_id }}
              eyebrow="כרטיס משתתף"
              title={participant.name}
              scanHint="סרקו ראשון"
              footer={participant.groups.length > 0 ? (
                <div className="group-dots" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  {participant.groups.map((g) => (
                    <span key={g.id} className="group-dot" style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: g.color }} title={g.name} />
                  ))}
                  <span style={{ fontSize: '10px', color: CARD_PALETTE.muted, marginInlineStart: '2px' }}>
                    {participant.groups.map((g) => g.name).join(' · ')}
                  </span>
                </div>
              ) : null}
            />
          ))}
        </div>
      </div>

      <div className="participant-section" style={{ marginBottom: '20px' }}>
        <div className="section-heading" style={{ fontSize: '17px', fontWeight: 900, color: CARD_PALETTE.foreground, margin: '0 0 4px' }}>
          כרטיסי משימות
        </div>
        <div className="section-hint" style={{ fontSize: '11px', color: CARD_PALETTE.muted, marginBottom: '10px' }}>
          נסרקים אחרי כרטיס המשתתף כדי לזכות בנקודות.
        </div>
        <div className="cards-grid" style={gridStyle}>
          {actions.map((action) => (
            <QrCard
              key={action.id}
              event={event}
              wizardPreview={wizardPreview}
              payload={{ actionCode: action.code }}
              eyebrow="כרטיס משימה"
              title={action.name}
              scanHint="סרקו שני"
              footer={(
                <div className="points-row" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                  <span className="points-icon" style={{ fontSize: '14px' }}>⭐</span>
                  <span className="points-value" style={{ fontSize: wizardPreview ? '16px' : '18px', fontWeight: 900, color: c, letterSpacing: '-0.5px' }}>
                    {action.points >= 0 ? '+' : ''}{action.points}
                  </span>
                  <span className="points-label" style={{ fontSize: '10px', color: CARD_PALETTE.muted, fontWeight: 500 }}>נקודות</span>
                </div>
              )}
            />
          ))}
        </div>
      </div>
    </>
  )
}

/** One split-mode card — same chrome as the combined card, single code inside. */
function QrCard({
  event,
  payload,
  eyebrow,
  title,
  scanHint,
  footer,
  wizardPreview = false,
}: {
  event: Event
  payload: { participantCode: string } | { actionCode: string }
  eyebrow: string
  title: string
  scanHint: string
  footer?: ReactNode
  wizardPreview?: boolean
}) {
  const c = CARD_PALETTE.primary

  return (
    <div
      className="card"
      style={{
        width: wizardPreview ? '100%' : '310px',
        minWidth: 0,
        borderRadius: '16px',
        border: `1.5px solid ${CARD_PALETTE.border}`,
        overflow: 'hidden',
        display: 'flex',
        direction: 'ltr',
        background: CARD_PALETTE.surface,
        breakInside: 'avoid',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div className="qr-side" style={{ flexShrink: 0, width: wizardPreview ? '96px' : '120px', padding: wizardPreview ? '10px' : '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', background: `linear-gradient(135deg, ${c}08 0%, ${c}03 100%)`, borderLeft: `3px solid ${c}` }}>
        <QRCodeSVG value={JSON.stringify(payload)} size={wizardPreview ? 72 : 90} level="M" fgColor={CARD_PALETTE.foreground} />
        <span className="scan-text" style={{ fontSize: '7px', color: CARD_PALETTE.muted, textAlign: 'center', direction: 'rtl', letterSpacing: '0.3px' }}>{scanHint}</span>
      </div>

      <div className="info-side" style={{ flex: 1, padding: wizardPreview ? '10px 12px' : '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: 'rtl', minWidth: 0, gap: '2px' }}>
        <div className="event-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          {event.logo_url && <img src={event.logo_url} alt="" className="event-logo" style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }} />}
          <span className="event-label" style={{ fontSize: '9px', color: CARD_PALETTE.muted }}>{event.name}</span>
        </div>

        <div className="participant-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${c}12`, border: `1px solid ${c}25`, borderRadius: '20px', padding: '3px 10px', fontSize: '10px', fontWeight: 600, color: CARD_PALETTE.foreground, width: 'fit-content', marginBottom: '6px' }}>
          <span className="dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />
          {eyebrow}
        </div>

        <div className="action-name" style={{ fontSize: wizardPreview ? '14px' : '16px', fontWeight: 800, color: CARD_PALETTE.foreground, marginBottom: '4px', lineHeight: 1.2 }}>
          {title}
        </div>

        {footer}
      </div>
    </div>
  )
}

function ParticipantPage({
  sheet,
  event,
  wizardPreview = false,
}: {
  sheet: ParticipantSheet
  event: Event
  wizardPreview?: boolean
}) {
  const { participant, actions } = sheet
  const c = CARD_PALETTE.primary

  return (
    <div className="participant-section" style={{ marginBottom: '20px' }}>
      <div className="participant-divider" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0 12px', padding: '6px 0', borderBottom: `2.5px solid ${c}` }}>
        <span className="name" style={{ fontSize: '15px', fontWeight: 800, color: CARD_PALETTE.foreground }}>{participant.name}</span>
        {participant.groups.length > 0 && (
          <div className="group-dots" style={{ display: 'flex', gap: '4px' }}>
            {participant.groups.map((g) => (<span key={g.id} className="group-dot" style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: g.color }} title={g.name} />))}
          </div>
        )}
      </div>

      <div
        className="cards-grid"
        style={{
          display: wizardPreview ? 'grid' : 'flex',
          gridTemplateColumns: wizardPreview ? 'repeat(2, minmax(0, 1fr))' : undefined,
          flexWrap: wizardPreview ? undefined : 'wrap',
          gap: '12px',
        }}
      >
        {actions.map((action) => (
          <div
            key={action.id}
            className="card"
            style={{
              width: wizardPreview ? '100%' : '310px',
              minWidth: 0,
              borderRadius: '16px',
              border: `1.5px solid ${CARD_PALETTE.border}`,
              overflow: 'hidden',
              display: 'flex',
              direction: 'ltr',
              background: CARD_PALETTE.surface,
              breakInside: 'avoid',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            {/* QR side */}
            <div className="qr-side" style={{ flexShrink: 0, width: wizardPreview ? '96px' : '120px', padding: wizardPreview ? '10px' : '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', background: `linear-gradient(135deg, ${c}08 0%, ${c}03 100%)`, borderLeft: `3px solid ${c}` }}>
              <QRCodeSVG
                value={JSON.stringify({ participantCode: participant.external_id, actionCode: action.code })}
                size={wizardPreview ? 72 : 90}
                level="M"
                fgColor={CARD_PALETTE.foreground}
              />
              <span className="scan-text" style={{ fontSize: '7px', color: CARD_PALETTE.muted, textAlign: 'center', direction: 'rtl', letterSpacing: '0.3px' }}>סרקו לקבלת הנקודות</span>
            </div>

            {/* Info side */}
            <div className="info-side" style={{ flex: 1, padding: wizardPreview ? '10px 12px' : '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: 'rtl', minWidth: 0, gap: '2px' }}>
              {/* Event row */}
              <div className="event-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                {event.logo_url && <img src={event.logo_url} alt="" className="event-logo" style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }} />}
                <span className="event-label" style={{ fontSize: '9px', color: CARD_PALETTE.muted }}>{event.name}</span>
              </div>

              {/* Task title */}
              <div className="action-name" style={{ fontSize: wizardPreview ? '14px' : '16px', fontWeight: 800, color: CARD_PALETTE.foreground, marginBottom: '4px', lineHeight: 1.2 }}>
                {action.name}
              </div>

              {/* Participant badge */}
              <div className="participant-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${c}12`, border: `1px solid ${c}25`, borderRadius: '20px', padding: '3px 10px', fontSize: '10px', fontWeight: 600, color: CARD_PALETTE.foreground, width: 'fit-content', marginBottom: '6px' }}>
                <span className="dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />
                {participant.name}
              </div>

              {/* Points */}
              <div className="points-row" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                <span className="points-icon" style={{ fontSize: '14px' }}>⭐</span>
                <span className="points-value" style={{ fontSize: wizardPreview ? '16px' : '18px', fontWeight: 900, color: c, letterSpacing: '-0.5px' }}>
                  +{action.points}
                </span>
                <span className="points-label" style={{ fontSize: '10px', color: CARD_PALETTE.muted, fontWeight: 500 }}>נקודות</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
