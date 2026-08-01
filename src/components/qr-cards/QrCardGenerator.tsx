import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Barcode from 'react-barcode'
import { QrCode } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { PanelCard } from '@/components/ui/PanelCard'
import { theme } from '@/lib/theme'
import { isActionRelevantTo } from '@/lib/cardCounts'
import { encodeCardPayload } from '@/lib/cardPayload'
import { isTriviaAction } from '@/lib/tasks/triviaScan'

import type { Action, ActionOption, Group, ParticipantWithGroups, Event, ScanMode, BarcodeType } from '@/types'

interface QrCardGeneratorProps {
  event: Event
  /** Which deck to lay out - the event's saved scan_mode (079). */
  scanMode: ScanMode
  /**
   * Whether the laid-out deck is on screen. The deck is only built once this
   * turns true (or a print is asked for), and once built it stays mounted -
   * hidden rather than unmounted - because printing reads it from the DOM.
   */
  previewOpen?: boolean
  /**
   * Handed the print action once there is a deck worth printing, and null while
   * it is loading or when the game has no participants or no active tasks. The
   * print button belongs to the step around this component, not to it.
   */
  onPrintReady?: (print: (() => void) | null) => void
  /** Fired once a print window has been handed to the browser. */
  onPrinted?: () => void
}

interface ActionGroupJoin { group_id: string; groups: Group }
interface ActionWithGroupIds extends Action { groupIds: string[]; options: ActionOption[] }
interface ParticipantSheet { participant: ParticipantWithGroups; actions: ActionWithGroupIds[] }

/**
 * One physical card's worth of task, after questions have been unfolded.
 *
 * A standard task is one of these; a trivia question is one per answer, each
 * carrying its own code. Everything downstream lays out cards, not tasks, which
 * is what keeps the two decks from having to know what a question is.
 */
interface PrintableTaskCard {
  key: string
  /** What the barcode encodes - the task's code, or one answer's. */
  code: string
  /** The line printed large: the task name, or the answer. */
  title: string
  /** Printed small underneath, on all three cards of a question. */
  question: string | null
  points: number
  isTrivia: boolean
}

/**
 * A question that would print a card nobody can win on is not printed at all.
 *
 * The composer cannot save one, so this is reached only if answers were removed
 * behind its back. The readiness list names it; here it is simply left out of
 * the deck rather than printed as a task with no way to score.
 */
function isPrintableAction(action: ActionWithGroupIds): boolean {
  if (!isTriviaAction(action)) return true
  return action.options.length >= 2 && action.options.filter((o) => o.is_correct).length === 1
}

function cardsForAction(action: ActionWithGroupIds): PrintableTaskCard[] {
  if (!isTriviaAction(action)) {
    return [{
      key: action.id,
      code: action.code,
      title: action.name,
      question: null,
      points: action.points,
      isTrivia: false,
    }]
  }

  return [...action.options]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((option) => ({
      key: option.id,
      code: option.code,
      // The answer is what the participant chooses between, so it is the line
      // they have to be able to read across a room.
      title: option.label,
      question: action.name,
      points: action.points,
      isTrivia: true,
    }))
}

/** Palette literals for print/card inline styles (matches design-tokens.css) */
const CARD_PALETTE = {
  primary: '#AB3500',
  foreground: '#2E221E',
  muted: '#7D706A',
  border: '#E7D6CF',
  surface: '#FFFFFF',
} as const

/**
 * How a task name is sized on a card, by how long it is. A fixed size clamped
 * to two lines used to print long names with an ellipsis, so a card could go
 * out saying "משימת ניקיון החצר האחורית של..." and nothing more. Each tier
 * trades a point of font size for another line instead, so the name always
 * prints in full; the clamp on the last tier is a guard against absurd input,
 * not a normal step.
 *
 * Widths the thresholds assume: ~187px of text on a side-by-side card (310px
 * less the code column and padding), the full card width when the code is
 * stacked above the details.
 */
const NAME_TIERS = [
  { maxChars: 28, fontSize: 16, lines: 2 },
  { maxChars: 45, fontSize: 14, lines: 3 },
  { maxChars: 70, fontSize: 12, lines: 4 },
  { maxChars: Infinity, fontSize: 11, lines: 5 },
] as const

/** A stacked card gives the name the full width, so it holds ~60% more per line. */
const STACKED_WIDTH_BONUS = 1.6

function actionNameStyle(name: string, { stacked }: { stacked: boolean }) {
  const length = name.trim().length
  const budget = stacked ? STACKED_WIDTH_BONUS : 1
  const tier = NAME_TIERS.find((t) => length <= t.maxChars * budget) ?? NAME_TIERS[NAME_TIERS.length - 1]

  return {
    fontSize: `${tier.fontSize}px`,
    fontWeight: 800,
    color: CARD_PALETTE.foreground,
    marginBottom: '4px',
    lineHeight: 1.2,
    // Kept inline rather than in the print stylesheet so the preview shows the
    // same wrapping the printer will produce.
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: tier.lines,
    overflow: 'hidden',
    // An unbroken run - a URL, an id - must not push past the card edge.
    overflowWrap: 'anywhere',
  } as const
}

export function QrCardGenerator({ event, scanMode, previewOpen = false, onPrintReady, onPrinted }: QrCardGeneratorProps) {
  const isSplit = scanMode === 'split'
  const [participants, setParticipants] = useState<ParticipantWithGroups[]>([])
  const [actions, setActions] = useState<ActionWithGroupIds[]>([])
  const [loading, setLoading] = useState(true)
  // Laying out a deck means rendering a QR for every card, which is heavy for a
  // large game. It is put off until something actually needs it: the preview
  // being opened, or a print being asked for.
  const [mountedForPrint, setMountedForPrint] = useState(false)
  const [pendingPrint, setPendingPrint] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    const [participantsRes, actionsRes, optionsRes] = await Promise.all([
      supabase.from('participants').select('*, participant_groups(group_id, groups(*))').eq('event_id', event.id).order('name'),
      supabase.from('actions').select('*, action_groups(group_id, groups(*))').eq('event_id', event.id).eq('is_active', true).order('name'),
      // Errors to an empty list on a database without 088 - a game with no
      // questions in it then prints exactly the deck it always did.
      supabase.from('action_options').select('*').eq('event_id', event.id).order('sort_order'),
    ])
    const optionsByAction = new Map<string, ActionOption[]>()
    for (const option of (optionsRes.data ?? []) as ActionOption[]) {
      const list = optionsByAction.get(option.action_id)
      if (list) list.push(option)
      else optionsByAction.set(option.action_id, [option])
    }
    const mappedParticipants: ParticipantWithGroups[] = (participantsRes.data ?? []).map((p) => ({
      ...p, groups: ((p.participant_groups as unknown as { group_id: string; groups: Group }[]) ?? []).map((pg) => pg.groups),
    }))
    const mappedActions: ActionWithGroupIds[] = (actionsRes.data ?? []).map((a) => ({
      ...a,
      groupIds: ((a.action_groups as unknown as ActionGroupJoin[]) ?? []).map((ag) => ag.group_id),
      options: optionsByAction.get(a.id) ?? [],
    })).filter(isPrintableAction)
    setParticipants(mappedParticipants); setActions(mappedActions); setLoading(false)
  }, [event.id])

  useEffect(() => { fetchData() }, [fetchData])

  const getRelevantActions = useCallback((participant: ParticipantWithGroups): ActionWithGroupIds[] => {
    const participantGroupIds = new Set(participant.groups.map((g) => g.id))
    return actions.filter((action) => isActionRelevantTo(action, participantGroupIds))
  }, [actions])

  // Derived, not snapshotted when the preview opens - the scan mode can change
  // under this component, and a snapshot would lay out the previous one.
  const sheets = useMemo<ParticipantSheet[]>(
    () => isSplit
      ? []
      : participants.map((p) => ({ participant: p, actions: getRelevantActions(p) })).filter((s) => s.actions.length > 0),
    [isSplit, participants, getRelevantActions],
  )

  const hasDeck = !loading && participants.length > 0 && actions.length > 0
  const showDeck = previewOpen && hasDeck
  const deckInDom = showDeck || mountedForPrint

  const printDeck = useCallback(() => {
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

/* Sizing and line count come from actionNameStyle() inline, so the preview and
   the print agree; nothing here may restate them. */
.card .action-name { font-weight: 800; color: ${CARD_PALETTE.foreground}; margin-bottom: 4px; line-height: 1.2; }

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
    onPrinted?.()
  }, [event.name, onPrinted])

  /**
   * Print on demand. When the preview has never been opened there is no deck in
   * the DOM to read, so this mounts it and leaves the printing to the effect
   * below - one render later, when the ref is filled.
   */
  const requestPrint = useCallback(() => {
    if (printRef.current) { printDeck(); return }
    setMountedForPrint(true)
    setPendingPrint(true)
  }, [printDeck])

  useEffect(() => {
    if (!pendingPrint || !printRef.current) return
    setPendingPrint(false)
    printDeck()
  }, [pendingPrint, deckInDom, printDeck])

  useEffect(() => {
    if (!onPrintReady) return
    onPrintReady(hasDeck ? requestPrint : null)
    return () => { onPrintReady(null) }
  }, [hasDeck, requestPrint, onPrintReady])

  if (loading) return previewOpen ? <CenteredLoader /> : null

  if (!hasDeck) {
    if (!previewOpen) return null
    return (
      <PanelCard size="lg" className="text-center">
        <QrCode size={32} className="mx-auto text-muted mb-3" />
        <p className={cn('text-sm', theme.textMuted)}>
          {participants.length === 0 ? 'אין משתתפים – הוסיפו משתתפים כדי ליצור כרטיסים' : 'אין משימות פעילות – הוסיפו משימות כדי ליצור כרטיסים'}
        </p>
      </PanelCard>
    )
  }

  if (!deckInDom) return null

  return (
    // Kept in the DOM but hidden when the preview is closed: printing copies
    // the laid-out markup straight out of the ref, so it has to exist even when
    // nobody is looking at it.
    <div className={cn(!showDeck && 'hidden')} aria-hidden={!showDeck}>
      <PrintSheet active={showDeck}>
        <div ref={printRef}>
          {isSplit ? (
            <SplitPages participants={participants} actions={actions} event={event} />
          ) : (
            sheets.map((sheet) => (<ParticipantPage key={sheet.participant.id} sheet={sheet} event={event} />))
          )}
        </div>
      </PrintSheet>
    </div>
  )
}

/** A4's width, and the page margin the print window sets on `body`. */
const SHEET_WIDTH = '210mm'
const SHEET_PADDING = '10mm'

/**
 * The deck on the paper it is going to come out on: a sheet of A4, at the width
 * and margin the printer will use, holding cards at their printed size. The
 * preview used to reflow them into a two-column grid that stretched each card to
 * whatever space was going - it fit any panel, and told nobody how many cards
 * land on a page or how small a long task name comes out.
 *
 * The sheet keeps its real width and is scaled down to whatever room it is
 * given, so what is on screen is the printout, just smaller. Length is left to
 * the content: a four-card deck is four cards of paper, not a page of it with
 * an empty two thirds. Nor is it split into pages - where the printer breaks
 * depends on its own margins, and drawing page edges here would be a guess.
 */
function PrintSheet({ active, children }: { active: boolean; children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [scaledHeight, setScaledHeight] = useState<number>()

  useLayoutEffect(() => {
    const host = hostRef.current
    const sheet = sheetRef.current
    if (!active || !host || !sheet) return

    function measure() {
      const available = host!.clientWidth
      // Untransformed, so scaling never feeds back into what we measure.
      const natural = sheet!.offsetWidth
      if (!available || !natural) return
      const next = Math.min(1, available / natural)
      setScale(next)
      setScaledHeight(sheet!.offsetHeight * next)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [active])

  return (
    // The sheet is wider than the box it sits in until it is scaled, and the
    // outer height is the scaled one - otherwise the scroller would offer the
    // full-size sheet's worth of empty space under it.
    <div ref={hostRef} className="overflow-hidden">
      {/* items-start: the box is the scaled height, which is shorter than the
          sheet it holds - stretching the sheet to it would squash the cards and
          feed a new height straight back into the measurement below. */}
      <div style={{ height: scaledHeight }} className="flex items-start justify-center">
        <div
          ref={sheetRef}
          className="rounded-sm shadow-card"
          style={{
            width: SHEET_WIDTH,
            padding: SHEET_PADDING,
            background: CARD_PALETTE.surface,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
          }}
        >
          {children}
        </div>
      </div>
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
}: {
  participants: ParticipantWithGroups[]
  actions: ActionWithGroupIds[]
  event: Event
}) {
  const c = CARD_PALETTE.primary

  const gridStyle = { display: 'flex', flexWrap: 'wrap' as const, gap: '12px' }

  return (
    <>
      <div className="participant-section" style={{ marginBottom: '24px' }}>
        <div className="section-heading" style={{ fontSize: '17px', fontWeight: 900, color: CARD_PALETTE.foreground, margin: '0 0 4px' }}>
          כרטיסי משתתפים
        </div>
        <div className="section-hint" style={{ fontSize: '11px', color: CARD_PALETTE.muted, marginBottom: '10px' }}>
          נסרקים ראשונים - לפני כרטיס המשימה.
        </div>
        <div className="cards-grid" style={gridStyle}>
          {participants.map((participant) => (
            <QrCard
              key={participant.id}
              event={event}
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
          {actions.filter((action) => !isTriviaAction(action)).map((action) => (
            <QrCard
              key={action.id}
              event={event}
              payload={{ actionCode: action.code }}
              eyebrow="כרטיס משימה"
              title={action.name}
              scanHint="סרקו שני"
              footer={(
                <div className="points-row" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                  <span className="points-icon" style={{ fontSize: '14px' }}>⭐</span>
                  <span className="points-value" style={{ fontSize: '18px', fontWeight: 900, color: c, letterSpacing: '-0.5px' }}>
                    {action.points >= 0 ? '+' : ''}{action.points}
                  </span>
                  <span className="points-label" style={{ fontSize: '10px', color: CARD_PALETTE.muted, fontWeight: 500 }}>נקודות</span>
                </div>
              )}
            />
          ))}
        </div>
      </div>

      {/* A question's cards are cut apart and handed out as a set, so they are
          laid out as a set - under a heading naming the question, in the order
          they will be cut. The heading is for whoever is holding the scissors;
          it is not part of any card, and it does not say which answer is right. */}
      {actions.filter(isTriviaAction).map((action) => (
        <div key={action.id} className="participant-section" style={{ marginBottom: '20px' }}>
          <div className="section-heading" style={{ fontSize: '15px', fontWeight: 900, color: CARD_PALETTE.foreground, margin: '0 0 4px' }}>
            ❓ {action.name}
          </div>
          <div className="section-hint" style={{ fontSize: '11px', color: CARD_PALETTE.muted, marginBottom: '10px' }}>
            {action.options.length} תשובות · רק אחת מהן מזכה ב-{action.points} נקודות, ולכל משתתף ניסיון אחד.
          </div>
          <div className="cards-grid" style={gridStyle}>
            {cardsForAction(action).map((card) => (
              <QrCard
                key={card.key}
                event={event}
                payload={{ actionCode: card.code }}
                eyebrow="שאלת טריוויה"
                question={card.question}
                title={card.title}
                scanHint="סרקו את התשובה שנראית לכם נכונה"
                footer={<TriviaPointsRow points={card.points} />}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

/**
 * The question, above the answer it belongs to, on every one of its cards.
 *
 * It used to print at 10px in the muted grey, below the answer - the size a
 * card uses for its footnotes. But the answer means nothing without it: three
 * cards saying "תשובה 1 / 2 / 3" are unreadable on their own, and whoever is
 * holding one has to be able to tell what it answers at arm's length. So it
 * leads the card, in the text colour, at a size meant to be read.
 *
 * Still smaller than the answer, which stays the largest line: the question is
 * identical on all three cards, and the answer is the only thing that tells
 * them apart in a pile.
 */
function TriviaQuestionLine({ question }: { question: string | null }) {
  if (!question) return null
  return (
    <div
      className="trivia-question"
      style={{
        fontSize: '13px',
        fontWeight: 700,
        lineHeight: 1.3,
        color: CARD_PALETTE.foreground,
        direction: 'rtl',
        marginBottom: '3px',
        overflowWrap: 'anywhere',
      }}
    >
      ❓ {question}
    </div>
  )
}

/**
 * What the question pays, on all three of its cards.
 *
 * The card cannot print "+50 נקודות" the way a task does: two of the three are
 * worth nothing, and a number on a wrong answer is a promise the participant
 * only finds out was false after it has cost them their one attempt. So the
 * number is attributed to the question rather than to the card - the same
 * sentence the sheet's heading makes - which is true on the right card and on
 * the wrong ones alike, and still tells the participant what is at stake.
 */
function TriviaPointsRow({ points }: { points: number }) {
  return (
    <div className="points-row" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
      <span className="points-icon" style={{ fontSize: '14px' }}>⭐</span>
      <span className="points-value" style={{ fontSize: '18px', fontWeight: 900, color: CARD_PALETTE.primary, letterSpacing: '-0.5px' }}>
        {points}
      </span>
      <span className="points-label" style={{ fontSize: '10px', color: CARD_PALETTE.muted, fontWeight: 500 }}>
        נקודות לתשובה הנכונה
      </span>
    </div>
  )
}

/**
 * The scannable code inside a card. A QR holds the JSON payload as always; a
 * `code128` event renders a one-dimensional barcode of the compact string
 * instead - wide and short, with the human-readable code beneath it so an
 * operator can always type it in if a print is too faint to scan.
 */
function CardCode({ value, type }: { value: string; type: BarcodeType }) {
  if (type === 'code128') {
    return (
      <Barcode
        value={value}
        format="CODE128"
        renderer="svg"
        width={1.5}
        height={54}
        margin={4}
        background="transparent"
        lineColor={CARD_PALETTE.foreground}
        displayValue={false}
      />
    )
  }
  return <QRCodeSVG value={value} size={90} level="M" fgColor={CARD_PALETTE.foreground} />
}

/**
 * Shared card chrome. QR events keep the code in a fixed side column; a linear
 * barcode is too wide for that, so `code128` stacks it full-width across the top
 * with the details below. Info content is passed in by each caller.
 */
function CardFrame({
  type,
  codeValue,
  scanHint,
  children,
}: {
  type: BarcodeType
  codeValue: string
  scanHint: string
  children: ReactNode
}) {
  const c = CARD_PALETTE.primary
  const stacked = type === 'code128'

  return (
    <div
      className="card"
      style={{
        width: '310px',
        minWidth: 0,
        borderRadius: '16px',
        border: `1.5px solid ${CARD_PALETTE.border}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: stacked ? 'column' : 'row',
        direction: 'ltr',
        background: CARD_PALETTE.surface,
        breakInside: 'avoid',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div
        className="qr-side"
        style={{
          flexShrink: 0,
          width: stacked ? '100%' : '120px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          background: `linear-gradient(135deg, ${c}08 0%, ${c}03 100%)`,
          borderLeft: stacked ? 'none' : `3px solid ${c}`,
          borderBottom: stacked ? `3px solid ${c}` : 'none',
        }}
      >
        <CardCode value={codeValue} type={type} />
        <span className="scan-text" style={{ fontSize: '7px', color: CARD_PALETTE.muted, textAlign: 'center', direction: 'rtl', letterSpacing: '0.3px' }}>{scanHint}</span>
      </div>

      <div className="info-side" style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', direction: 'rtl', minWidth: 0, gap: '2px' }}>
        {children}
      </div>
    </div>
  )
}

/** One split-mode card - same chrome as the combined card, single code inside. */
function QrCard({
  event,
  payload,
  eyebrow,
  question,
  title,
  scanHint,
  footer,
}: {
  event: Event
  payload: { participantCode: string } | { actionCode: string }
  eyebrow: string
  /** A trivia answer card leads with the question its title answers. */
  question?: string | null
  title: string
  scanHint: string
  footer?: ReactNode
}) {
  const c = CARD_PALETTE.primary

  return (
    <CardFrame
      type={event.barcode_type}
      codeValue={encodeCardPayload(payload, event.barcode_type)}
      scanHint={scanHint}
    >
      <div className="event-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        {event.logo_url && <img src={event.logo_url} alt="" className="event-logo" style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }} />}
        <span className="event-label" style={{ fontSize: '9px', color: CARD_PALETTE.muted }}>{event.name}</span>
      </div>

      <div className="participant-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${c}12`, border: `1px solid ${c}25`, borderRadius: '20px', padding: '3px 10px', fontSize: '10px', fontWeight: 600, color: CARD_PALETTE.foreground, width: 'fit-content', marginBottom: '6px' }}>
        <span className="dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />
        {eyebrow}
      </div>

      <TriviaQuestionLine question={question ?? null} />

      <div className="action-name" style={actionNameStyle(title, { stacked: event.barcode_type === 'code128' })}>
        {title}
      </div>

      {footer}
    </CardFrame>
  )
}

function ParticipantPage({ sheet, event }: { sheet: ParticipantSheet; event: Event }) {
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
        style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}
      >
        {/* A question unfolds here too - three cards, for this one participant.
            This is the multiplication the cards step warns about: a combined
            card names its participant, so nothing about it can be shared. */}
        {actions.flatMap(cardsForAction).map((card) => (
          <CardFrame
            key={card.key}
            type={event.barcode_type}
            codeValue={encodeCardPayload({ participantCode: participant.external_id, actionCode: card.code }, event.barcode_type)}
            scanHint={card.isTrivia ? 'סרקו את התשובה שנראית לכם נכונה' : 'סרקו לקבלת הנקודות'}
          >
            {/* Event row */}
            <div className="event-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              {event.logo_url && <img src={event.logo_url} alt="" className="event-logo" style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }} />}
              <span className="event-label" style={{ fontSize: '9px', color: CARD_PALETTE.muted }}>{event.name}</span>
            </div>

            {/* The question first, when there is one - the answer under it is
                meaningless on its own once the sheet has been cut up. */}
            <TriviaQuestionLine question={card.question} />

            {/* The task, or the answer being offered */}
            <div className="action-name" style={actionNameStyle(card.title, { stacked: event.barcode_type === 'code128' })}>
              {card.title}
            </div>

            {/* Participant badge */}
            <div className="participant-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${c}12`, border: `1px solid ${c}25`, borderRadius: '20px', padding: '3px 10px', fontSize: '10px', fontWeight: 600, color: CARD_PALETTE.foreground, width: 'fit-content', marginBottom: '6px' }}>
              <span className="dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />
              {participant.name}
            </div>

            {card.isTrivia ? (
              <TriviaPointsRow points={card.points} />
            ) : (
              <div className="points-row" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                <span className="points-icon" style={{ fontSize: '14px' }}>⭐</span>
                <span className="points-value" style={{ fontSize: '18px', fontWeight: 900, color: c, letterSpacing: '-0.5px' }}>
                  +{card.points}
                </span>
                <span className="points-label" style={{ fontSize: '10px', color: CARD_PALETTE.muted, fontWeight: 500 }}>נקודות</span>
              </div>
            )}
          </CardFrame>
        ))}
      </div>
    </div>
  )
}
