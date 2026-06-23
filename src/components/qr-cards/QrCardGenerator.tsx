import { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, Printer, ChevronDown, ChevronUp, User, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import type { Action, Group, ParticipantWithGroups, Event } from '@/types'

interface QrCardGeneratorProps {
  event: Event
}

interface ActionGroupJoin {
  group_id: string
  groups: Group
}

interface ActionWithGroupIds extends Action {
  groupIds: string[]
}

interface ParticipantSheet {
  participant: ParticipantWithGroups
  actions: ActionWithGroupIds[]
}

export function QrCardGenerator({ event }: QrCardGeneratorProps) {
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
      supabase
        .from('participants')
        .select('*, participant_groups(group_id, groups(*))')
        .eq('event_id', event.id)
        .order('name'),
      supabase
        .from('actions')
        .select('*, action_groups(group_id, groups(*))')
        .eq('event_id', event.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('groups')
        .select('*')
        .eq('event_id', event.id)
        .order('name'),
    ])

    const mappedParticipants: ParticipantWithGroups[] = (participantsRes.data ?? []).map((p) => ({
      ...p,
      groups: ((p.participant_groups as unknown as { group_id: string; groups: Group }[]) ?? []).map((pg) => pg.groups),
    }))

    const mappedActions: ActionWithGroupIds[] = (actionsRes.data ?? []).map((a) => ({
      ...a,
      groupIds: ((a.action_groups as unknown as ActionGroupJoin[]) ?? []).map((ag) => ag.group_id),
    }))

    setParticipants(mappedParticipants)
    setActions(mappedActions)
    setGroups((groupsRes.data ?? []) as Group[])
    setLoading(false)
  }, [event.id])

  useEffect(() => { fetchData() }, [fetchData])

  interface GroupBucket {
    id: string
    name: string
    color: string
    participants: ParticipantWithGroups[]
  }

  function getGroupBuckets(): GroupBucket[] {
    const buckets: GroupBucket[] = groups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      participants: participants.filter((p) => p.groups.some((pg) => pg.id === g.id)),
    }))

    const ungrouped = participants.filter((p) => p.groups.length === 0)
    if (ungrouped.length > 0 && groups.length > 0) {
      buckets.push({
        id: '__none__',
        name: 'ללא קבוצה',
        color: '#6b7280',
        participants: ungrouped,
      })
    }

    return buckets.filter((b) => b.participants.length > 0)
  }

  function getRelevantActions(participant: ParticipantWithGroups): ActionWithGroupIds[] {
    const participantGroupIds = new Set(participant.groups.map((g) => g.id))
    return actions.filter((action) => {
      if (action.groupIds.length === 0) return true
      return action.groupIds.some((gid) => participantGroupIds.has(gid))
    })
  }

  function handleGenerate() {
    const built: ParticipantSheet[] = participants
      .map((p) => ({ participant: p, actions: getRelevantActions(p) }))
      .filter((s) => s.actions.length > 0)
    setSheets(built)
    setGenerated(true)
  }

  function handlePrint() {
    const content = printRef.current
    if (!content) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const c = event.theme_color || '#6366f1'

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>כרטיסי QR – ${event.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; direction: rtl; padding: 12mm; }

          .participant-section {
            margin-bottom: 16px;
          }

          .participant-divider {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 12px 0 10px;
            padding: 6px 0;
            border-bottom: 2px solid ${c};
          }
          .participant-divider .name {
            font-size: 14px;
            font-weight: bold;
            color: #222;
          }
          .participant-divider .group-dots {
            display: flex;
            gap: 4px;
          }
          .participant-divider .group-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
          }

          .cards-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }

          .card {
            width: 280px;
            border: 1px solid #ccc;
            padding: 0;
            break-inside: avoid;
            position: relative;
            overflow: hidden;
            display: flex;
            direction: ltr;
          }
          .card .qr-side {
            flex-shrink: 0;
            padding: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-left: 2px solid ${c};
          }
          .card .qr-side svg { display: block; }
          .card .info-side {
            flex: 1;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            direction: rtl;
            min-width: 0;
          }
          .card .event-label {
            font-size: 8px;
            color: #aaa;
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .card .action-name {
            font-size: 13px;
            font-weight: bold;
            color: #111;
            margin-bottom: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .card .participant-label {
            font-size: 11px;
            color: #444;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .card .meta-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 2px;
          }
          .card .points {
            font-size: 11px;
            color: ${c};
            font-weight: bold;
          }
          .card .scan-limit {
            font-size: 9px;
            color: #888;
          }

          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 300)
  }

  const totalCards = sheets.reduce((sum, s) => sum + s.actions.length, 0)

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  if (participants.length === 0 || actions.length === 0) {
    return (
      <div className="rounded-2xl border border-game-border bg-game-card p-6 text-center">
        <QrCode size={32} className="mx-auto text-gray-600 mb-3" />
        <p className="text-sm text-gray-400">
          {participants.length === 0
            ? 'אין משתתפים – הוסיפו משתתפים כדי ליצור כרטיסים'
            : 'אין משימות פעילות – הוסיפו משימות כדי ליצור כרטיסים'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20">
            <QrCode size={18} className="text-brand-400" />
          </div>
          <h2 className="text-lg font-bold text-white">כרטיסי QR למשתתפים</h2>
        </div>
      </div>

      {!generated ? (
        <div className="space-y-4">
          {/* Preview of what will be generated */}
          <div className="rounded-2xl border border-game-border bg-game-card p-5 space-y-3">
            <p className="text-sm text-gray-300">
              לכל משתתף יופק דף נפרד עם כרטיסי QR עבור המשימות הרלוונטיות לקבוצות שלו.
            </p>

            {/* Group → Participant → Tasks hierarchy (or flat collapsible list when no groups) */}
            {groups.length === 0 ? (
              <div className="rounded-xl border border-game-border bg-game-dark">
                <button
                  type="button"
                  onClick={() => setExpandedGroup(expandedGroup === '__flat__' ? null : '__flat__')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-right"
                >
                  <User size={14} className="text-gray-500 shrink-0" />
                  <span className="text-sm text-gray-200 flex-1">{participants.length} משתתפים</span>
                  {expandedGroup === '__flat__' ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </button>
                {expandedGroup === '__flat__' && (
                  <div className="border-t border-game-border space-y-1 p-1.5 max-h-56 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
                    {participants.map((p) => {
                      const relevantActions = getRelevantActions(p)
                      const isExpanded = expandedParticipant === p.id
                      return (
                        <div key={p.id} className="rounded-lg border border-game-border/50 bg-game-card/50">
                          <button
                            type="button"
                            onClick={() => setExpandedParticipant(isExpanded ? null : p.id)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-right"
                          >
                            <User size={12} className="text-gray-600 shrink-0" />
                            <span className="text-sm text-white flex-1 truncate">{p.name}</span>
                            <span className="text-xs text-gray-500 shrink-0">{relevantActions.length} כרטיסים</span>
                            {isExpanded ? <ChevronUp size={12} className="text-gray-600" /> : <ChevronDown size={12} className="text-gray-600" />}
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-2 space-y-1">
                              {relevantActions.map((a) => (
                                <div key={a.id} className="flex items-center gap-2 text-xs text-gray-400 pr-5">
                                  <span className="truncate">{a.name}</span>
                                  <span className="text-gray-600">({a.points >= 0 ? '+' : ''}{a.points} נק׳)</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pl-1" style={{ scrollbarGutter: 'stable' }}>
              {getGroupBuckets().map((bucket) => {
                const isGroupOpen = expandedGroup === bucket.id
                return (
                  <div key={bucket.id} className="rounded-xl border border-game-border bg-game-dark">
                    <button
                      type="button"
                      onClick={() => setExpandedGroup(isGroupOpen ? null : bucket.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-right"
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: bucket.color }} />
                      <span className="text-sm text-gray-200 flex-1 truncate">{bucket.name}</span>
                      <span className="text-xs text-gray-500 shrink-0">{bucket.participants.length} משתתפים</span>
                      {isGroupOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                    </button>

                    {isGroupOpen && (
                      <div className="border-t border-game-border space-y-1 p-1.5">
                        {bucket.participants.map((p) => {
                          const relevantActions = getRelevantActions(p)
                          const isExpanded = expandedParticipant === `${bucket.id}:${p.id}`
                          return (
                            <div key={p.id} className="rounded-lg border border-game-border/50 bg-game-card/50">
                              <button
                                type="button"
                                onClick={() => setExpandedParticipant(isExpanded ? null : `${bucket.id}:${p.id}`)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-right"
                              >
                                <User size={12} className="text-gray-600 shrink-0" />
                                <span className="text-sm text-white flex-1 truncate">{p.name}</span>
                                <span className="text-xs text-gray-500 shrink-0">{relevantActions.length} כרטיסים</span>
                                {isExpanded ? <ChevronUp size={12} className="text-gray-600" /> : <ChevronDown size={12} className="text-gray-600" />}
                              </button>
                              {isExpanded && (
                                <div className="px-3 pb-2 space-y-1">
                                  {relevantActions.map((a) => (
                                    <div key={a.id} className="flex items-center gap-2 text-xs text-gray-400 pr-5">
                                      <span className="truncate">{a.name}</span>
                                      <span className="text-gray-600">({a.points >= 0 ? '+' : ''}{a.points} נק׳)</span>
                                    </div>
                                  ))}
                                  {relevantActions.length === 0 && (
                                    <p className="text-xs text-gray-600 pr-5">אין משימות רלוונטיות</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            )}

            <div className="rounded-xl border border-game-border bg-game-dark/50 p-3 text-center">
              <p className="text-sm text-gray-400">
                <span className="font-bold text-white">{participants.length}</span> משתתפים
                {' × '}
                <span className="font-bold text-white">{actions.length}</span> משימות
                {' = '}
                סה״כ{' '}
                <span className="font-bold text-white">
                  {participants.reduce((sum, p) => sum + getRelevantActions(p).length, 0)}
                </span>
                {' '}כרטיסים (לפי קבוצות)
              </p>
            </div>

            <Button onClick={handleGenerate} className="w-full">
              <QrCode size={16} className="ml-1.5" />
              יצירת כרטיסים
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setGenerated(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-game-border text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
            <Button onClick={handlePrint}>
              <Printer size={16} className="ml-1.5" />
              הדפסה
            </Button>
            <span className="text-sm text-gray-400">
              {sheets.length} משתתפים • {totalCards} כרטיסים
            </span>
          </div>

          {/* On-screen preview */}
          <div className="rounded-2xl border border-game-border bg-white overflow-auto max-h-[70vh]" style={{ scrollbarGutter: 'stable' }}>
            <div ref={printRef} className="p-6">
              {sheets.map((sheet) => (
                <ParticipantPage
                  key={sheet.participant.id}
                  sheet={sheet}
                  event={event}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ParticipantPage({ sheet, event }: { sheet: ParticipantSheet; event: Event }) {
  const { participant, actions } = sheet
  const c = event.theme_color || '#6366f1'

  return (
    <div className="participant-section" style={{ marginBottom: '16px' }}>
      {/* Divider */}
      <div
        className="participant-divider"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: '12px 0 10px',
          padding: '6px 0',
          borderBottom: `2px solid ${c}`,
        }}
      >
        <span className="name" style={{ fontSize: '14px', fontWeight: 'bold', color: '#222' }}>
          {participant.name}
        </span>
        {participant.groups.length > 0 && (
          <div className="group-dots" style={{ display: 'flex', gap: '4px' }}>
            {participant.groups.map((g) => (
              <span
                key={g.id}
                className="group-dot"
                style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: g.color }}
                title={g.name}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cards grid */}
      <div
        className="cards-grid"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        {actions.map((action) => (
          <div
            key={action.id}
            className="card"
            style={{
              width: '280px',
              border: '1px solid #ccc',
              breakInside: 'avoid',
              overflow: 'hidden',
              display: 'flex',
              direction: 'ltr',
            }}
          >
            {/* QR side (right in RTL print) */}
            <div
              className="qr-side"
              style={{
                flexShrink: 0,
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderLeft: `2px solid ${c}`,
              }}
            >
              <QRCodeSVG
                value={JSON.stringify({
                  type: 'combined_score',
                  participantCode: participant.external_id,
                  actionCode: action.code,
                })}
                size={80}
                level="M"
                fgColor="#111"
              />
            </div>

            {/* Info side (left in RTL print) */}
            <div
              className="info-side"
              style={{
                flex: 1,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                direction: 'rtl',
                minWidth: 0,
              }}
            >
              {event.logo_url && (
                <img
                  src={event.logo_url}
                  alt=""
                  style={{ width: '20px', height: '20px', objectFit: 'contain', marginBottom: '4px' }}
                />
              )}
              <div className="event-label" style={{ fontSize: '8px', color: '#aaa', marginBottom: '2px' }}>
                {event.name}
              </div>
              <div className="action-name" style={{ fontSize: '13px', fontWeight: 'bold', color: '#111', marginBottom: '3px' }}>
                {action.name}
              </div>
              <div className="participant-label" style={{ fontSize: '11px', color: '#444', marginBottom: '4px' }}>
                {participant.name}
              </div>
              <div className="meta-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span className="points" style={{ fontSize: '11px', color: c, fontWeight: 'bold' }}>
                  {action.points >= 0 ? '+' : ''}{action.points} נק׳
                </span>
                <span className="scan-limit" style={{ fontSize: '9px', color: '#888' }}>
                  {action.max_completions === null
                    ? 'ללא הגבלה'
                    : action.max_completions === 1
                      ? 'מוגבל לסריקה אחת'
                      : `מוגבל ל-${action.max_completions} סריקות`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
