import { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, Printer, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import type { Action, Group, ParticipantWithGroups, QrScoringMode } from '@/types'

interface QrCardGeneratorProps {
  eventId: string
  qrScoringMode: QrScoringMode
}

interface ParticipantGroupJoin {
  group_id: string
  groups: Group
}

type FilterMode = 'all' | 'group' | 'selected-participants' | 'selected-actions'

export function QrCardGenerator({ eventId, qrScoringMode }: QrCardGeneratorProps) {
  const [participants, setParticipants] = useState<ParticipantWithGroups[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Set<string>>(new Set())
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set())
  const [generated, setGenerated] = useState(false)
  const [separateTab, setSeparateTab] = useState<'participants' | 'actions'>('participants')

  const printRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    const [participantsRes, actionsRes, groupsRes] = await Promise.all([
      supabase
        .from('participants')
        .select('*, participant_groups(group_id, groups(*))')
        .eq('event_id', eventId)
        .order('name'),
      supabase
        .from('actions')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('groups')
        .select('*')
        .eq('event_id', eventId)
        .order('name'),
    ])

    const mappedParticipants: ParticipantWithGroups[] = (participantsRes.data ?? []).map((p) => ({
      ...p,
      groups: ((p.participant_groups as unknown as ParticipantGroupJoin[]) ?? []).map((pg) => pg.groups),
    }))

    setParticipants(mappedParticipants)
    setActions((actionsRes.data ?? []) as Action[])
    setGroups((groupsRes.data ?? []) as Group[])
    setLoading(false)
  }, [eventId])

  useEffect(() => { fetchData() }, [fetchData])

  function getFilteredParticipants(): ParticipantWithGroups[] {
    switch (filterMode) {
      case 'group':
        if (!selectedGroupId) return []
        return participants.filter((p) => p.groups.some((g) => g.id === selectedGroupId))
      case 'selected-participants':
        return participants.filter((p) => selectedParticipantIds.has(p.id))
      default:
        return participants
    }
  }

  function getFilteredActions(): Action[] {
    if (filterMode === 'selected-actions') {
      return actions.filter((a) => selectedActionIds.has(a.id))
    }
    return actions
  }

  function toggleParticipant(id: string) {
    setSelectedParticipantIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAction(id: string) {
    setSelectedActionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleGenerate() {
    setGenerated(true)
  }

  function handlePrint() {
    const content = printRef.current
    if (!content) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>כרטיסי QR</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; direction: rtl; }
          .page {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            padding: 12px;
            page-break-after: always;
          }
          .page:last-child { page-break-after: auto; }
          .card {
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 10px;
            text-align: center;
            break-inside: avoid;
          }
          .card .participant-name {
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .card .action-name {
            font-size: 11px;
            color: #555;
            margin-bottom: 8px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .card .code-label {
            font-size: 10px;
            color: #888;
            margin-bottom: 2px;
          }
          .card .points-label {
            font-size: 10px;
            color: #2d7d46;
            margin-top: 4px;
            font-weight: bold;
          }
          .card svg { display: block; margin: 0 auto; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { padding: 8mm; }
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

  const filteredParticipants = getFilteredParticipants()
  const filteredActions = getFilteredActions()

  const totalCards = qrScoringMode === 'combined'
    ? filteredParticipants.length * filteredActions.length
    : (separateTab === 'participants' ? filteredParticipants.length : filteredActions.length)

  const cardCountLabel = qrScoringMode === 'combined'
    ? `${filteredParticipants.length} משתתפים × ${filteredActions.length} משימות`
    : (separateTab === 'participants'
        ? `${filteredParticipants.length} משתתפים`
        : `${filteredActions.length} משימות`)

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
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
          <h2 className="text-lg font-bold text-white">
            {qrScoringMode === 'combined' ? 'כרטיסי QR משולבים' : 'כרטיסי QR נפרדים'}
          </h2>
        </div>
      </div>

      {!generated ? (
        <div className="space-y-4">
          {qrScoringMode === 'separate' && (
            <div className="flex gap-2">
              <button
                onClick={() => setSeparateTab('participants')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  separateTab === 'participants'
                    ? 'bg-brand-600/20 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                כרטיסי משתתפים
              </button>
              <button
                onClick={() => setSeparateTab('actions')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  separateTab === 'actions'
                    ? 'bg-brand-600/20 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                כרטיסי משימות
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-game-border bg-game-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-300">סינון</h3>
            </div>

            {(qrScoringMode === 'combined' || separateTab === 'participants') && (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">מצב סינון</label>
                <select
                  value={filterMode}
                  onChange={(e) => { setFilterMode(e.target.value as FilterMode); setGenerated(false) }}
                  className="w-full rounded-xl border border-game-border bg-game-dark px-4 py-3 text-sm font-medium text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="all">
                    {qrScoringMode === 'combined' ? 'כל המשתתפים וכל המשימות' : 'כל המשתתפים'}
                  </option>
                  <option value="group">לפי קבוצה</option>
                  <option value="selected-participants">משתתפים נבחרים</option>
                  {qrScoringMode === 'combined' && (
                    <option value="selected-actions">משימות נבחרות</option>
                  )}
                </select>
              </div>
            )}

            {(qrScoringMode === 'separate' && separateTab === 'actions') && (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">מצב סינון</label>
                <select
                  value={filterMode}
                  onChange={(e) => { setFilterMode(e.target.value as FilterMode); setGenerated(false) }}
                  className="w-full rounded-xl border border-game-border bg-game-dark px-4 py-3 text-sm font-medium text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="all">כל המשימות</option>
                  <option value="selected-actions">משימות נבחרות</option>
                </select>
              </div>
            )}

            {filterMode === 'group' && (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">קבוצה</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full rounded-xl border border-game-border bg-game-dark px-4 py-3 text-sm font-medium text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">בחרו קבוצה...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            {filterMode === 'selected-participants' && (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  משתתפים ({selectedParticipantIds.size} נבחרו)
                </label>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-game-border bg-game-dark p-2 space-y-1">
                  {participants.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedParticipantIds.has(p.id)}
                        onChange={() => toggleParticipant(p.id)}
                        className="rounded border-gray-600 bg-game-dark text-brand-500 focus:ring-brand-500"
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {filterMode === 'selected-actions' && (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  משימות ({selectedActionIds.size} נבחרו)
                </label>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-game-border bg-game-dark p-2 space-y-1">
                  {actions.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedActionIds.has(a.id)}
                        onChange={() => toggleAction(a.id)}
                        className="rounded border-gray-600 bg-game-dark text-brand-500 focus:ring-brand-500"
                      />
                      <span>{a.name}</span>
                      <span className="text-xs text-gray-500">({a.code})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-game-border bg-game-dark/50 p-3 text-center">
              <p className="text-sm text-gray-400">
                {totalCards > 0 ? (
                  <>סה״כ <span className="font-bold text-white">{totalCards}</span> כרטיסים ({cardCountLabel})</>
                ) : (
                  'בחרו פריטים ליצירת כרטיסים'
                )}
              </p>
            </div>

            <div className="mt-4">
              <Button
                onClick={handleGenerate}
                disabled={totalCards === 0}
                className="w-full"
              >
                <QrCode size={16} className="ml-1.5" />
                יצירת כרטיסים ({totalCards})
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <Button onClick={handlePrint}>
              <Printer size={16} className="ml-1.5" />
              הדפסה
            </Button>
            <Button variant="outline" onClick={() => setGenerated(false)}>
              חזרה לסינון
            </Button>
            <span className="text-sm text-gray-400">{totalCards} כרטיסים</span>
          </div>

          <div className="rounded-2xl border border-game-border bg-white p-4 overflow-auto max-h-[70vh]">
            <div ref={printRef}>
              {qrScoringMode === 'combined' && (
                renderCombinedCards(filteredParticipants, filteredActions)
              )}
              {qrScoringMode === 'separate' && separateTab === 'participants' && (
                renderParticipantCards(filteredParticipants)
              )}
              {qrScoringMode === 'separate' && separateTab === 'actions' && (
                renderActionCards(filteredActions)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function renderCombinedCards(participants: ParticipantWithGroups[], actions: Action[]) {
  const allCards: { participant: ParticipantWithGroups; action: Action }[] = []
  for (const participant of participants) {
    for (const action of actions) {
      allCards.push({ participant, action })
    }
  }

  return chunkArray(allCards, 9).map((page, pageIdx) => (
    <div key={pageIdx} className="page" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '12px', pageBreakAfter: 'always' }}>
      {page.map(({ participant, action }) => (
        <div
          key={`${participant.id}-${action.id}`}
          className="card"
          style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '10px', textAlign: 'center', breakInside: 'avoid' }}
        >
          <div className="participant-name" style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {participant.name}
          </div>
          <div className="action-name" style={{ fontSize: '11px', color: '#555', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {action.name}
          </div>
          <QRCodeSVG
            value={JSON.stringify({ type: 'combined_score', participantCode: participant.external_id, actionCode: action.code })}
            size={100}
            level="M"
          />
        </div>
      ))}
    </div>
  ))
}

function renderParticipantCards(participants: ParticipantWithGroups[]) {
  return chunkArray(participants, 9).map((page, pageIdx) => (
    <div key={pageIdx} className="page" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '12px', pageBreakAfter: 'always' }}>
      {page.map((participant) => (
        <div
          key={participant.id}
          className="card"
          style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '10px', textAlign: 'center', breakInside: 'avoid' }}
        >
          <div className="participant-name" style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {participant.name}
          </div>
          <QRCodeSVG
            value={JSON.stringify({ type: 'participant', participantCode: participant.external_id })}
            size={100}
            level="M"
          />
        </div>
      ))}
    </div>
  ))
}

function renderActionCards(actions: Action[]) {
  return chunkArray(actions, 9).map((page, pageIdx) => (
    <div key={pageIdx} className="page" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '12px', pageBreakAfter: 'always' }}>
      {page.map((action) => (
        <div
          key={action.id}
          className="card"
          style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '10px', textAlign: 'center', breakInside: 'avoid' }}
        >
          <div className="participant-name" style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {action.name}
          </div>
          <div className="points-label" style={{ fontSize: '10px', color: '#2d7d46', marginBottom: '6px', fontWeight: 'bold' }}>
            {action.points >= 0 ? '+' : ''}{action.points} נק׳
          </div>
          <QRCodeSVG
            value={JSON.stringify({ type: 'action', actionCode: action.code })}
            size={100}
            level="M"
          />
        </div>
      ))}
    </div>
  ))
}

function chunkArray<T>(arr: T[], perPage: number): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < arr.length; i += perPage) {
    pages.push(arr.slice(i, i + perPage))
  }
  return pages
}
