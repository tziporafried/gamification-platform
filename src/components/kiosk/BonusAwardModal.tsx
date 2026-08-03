import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BONUS_REASON_MAX_LENGTH,
  bonusErrorMessage,
  sanitizeBonusPoints,
  validateBonus,
  type BonusDraft,
} from '@/lib/bonusPoints'

/**
 * The operator's side of a bonus: who, what for, how much.
 *
 * Lives on the scan screen because that is where the operator already is when
 * something happens that no card covers - and because everything downstream of
 * the award (the confirmation card, the orange feed, the prize celebration) is
 * already built there. Reaching it from the live-events popup is a link to this
 * screen with ?bonus=1 on it, not a screen of its own.
 *
 * Deliberately not the manual-entry form with a third field: that form's whole
 * job is picking a task the player is still eligible for, and a bonus has no
 * task, no eligibility and no limit. What it does borrow is the shape - pick
 * the player first, then say what they get.
 *
 * Styled inline like the rest of the kiosk rather than with the app's Tailwind
 * components: this screen is a full-bleed display with its own palette, and a
 * dialog built out of the admin UI's cards reads as a different product on it.
 */

export interface BonusParticipantOption {
  id: string
  name: string
  /** Current total, shown once one is chosen so the operator can confirm it. */
  points: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  participants: BonusParticipantOption[]
  loadingParticipants: boolean
  submitting: boolean
  onSubmit: (draft: BonusDraft) => Promise<void>
}

/** Sized for a kiosk keypad, not a keyboard: four taps cover most awards. */
const POINT_PRESETS = [10, 25, 50, 100]

const FIELD_LABEL: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: '#B4552A',
}

/**
 * Fixed rather than padding-derived, so the three fields line up.
 *
 * The points box carries a much bigger font than the other two - it is the
 * number the operator checks before committing - and vertical padding would
 * have made it the tallest of the three. A set height lets it keep the type
 * size without breaking the column.
 */
const FIELD_HEIGHT = 50

const FIELD_BOX: React.CSSProperties = {
  height: FIELD_HEIGHT,
  padding: '0 14px',
  borderRadius: 14,
  border: '2px solid #FFE1CC',
  background: '#fff',
  fontSize: 15.5,
  fontWeight: 700,
  color: '#3F2B22',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

/**
 * The player picker draws its own chevron: the native one is a black triangle,
 * the one bit of the popup that is not on the brand's warm scale.
 */
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%23B4552A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")"

export function BonusAwardModal({
  isOpen,
  onClose,
  participants,
  loadingParticipants,
  submitting,
  onSubmit,
}: Props) {
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [points, setPoints] = useState('')
  const [touched, setTouched] = useState(false)
  const playerRef = useRef<HTMLSelectElement>(null)

  // A fresh popup every time it is opened - a half-typed bonus from the last
  // one reappearing behind a different operator is how the wrong player gets
  // points.
  useEffect(() => {
    if (!isOpen) return
    setParticipantId(null)
    setReason('')
    setPoints('')
    setTouched(false)
    const t = setTimeout(() => playerRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const selected = useMemo(
    () => participants.find((p) => p.id === participantId) ?? null,
    [participants, participantId],
  )

  const draft: BonusDraft = { participantId, reason, points }
  const validation = validateBonus(draft)
  // Only after a failed attempt: a message telling the operator the form is
  // incomplete before they have touched it is noise.
  const error = touched && !validation.ok ? bonusErrorMessage(validation.error) : null

  if (!isOpen) return null

  async function handleSubmit() {
    setTouched(true)
    if (!validation.ok || submitting) return
    await onSubmit(draft)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="הענקת נקודות בונוס"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(12px, 2vw, 28px)',
        // Warm brown at the app modal's weight, not a near-black wash: the
        // scan screen behind it should still read as the game's own colours.
        background: 'rgba(74,42,26,0.42)',
        backdropFilter: 'blur(10px)',
        direction: 'rtl',
      }}
    >
      {/* Gradient border card, the same frame the manual-entry panel uses */}
      <div style={{
        position: 'relative',
        width: 'min(520px, 100%)',
        maxHeight: '100%',
        borderRadius: 32, padding: 4,
        background: 'linear-gradient(135deg,#FF9366,#F2B33C 40%,#FFCB9A 70%,#8FCFA0)',
        boxShadow: '0 28px 70px rgba(171,53,0,0.34)',
        animation: 'kiosk-cardBounceIn 0.45s cubic-bezier(0.2,0.9,0.25,1.15) both',
        display: 'flex',
      }}>
        <div style={{
          flex: 1, minHeight: 0,
          borderRadius: 28,
          background: 'linear-gradient(160deg,#FFFFFF,#FFF6F0)',
          padding: 'clamp(18px, 2vw, 26px)',
          display: 'flex', flexDirection: 'column', gap: 16,
          overflowY: 'auto',
        }}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <div className="kiosk-bob" style={{
              width: 54, height: 54, borderRadius: 18, flexShrink: 0,
              background: 'linear-gradient(135deg,#FF9366,#F2B33C)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, boxShadow: '0 10px 24px rgba(255,147,102,0.4)',
            }}>⚡</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'clamp(20px, 2.2vw, 25px)', fontWeight: 900, color: '#2E221E' }}>
                נקודות בונוס
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#A08172', marginTop: 2 }}>
                בחרו משתתף, כתבו על מה, וקבעו כמה
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className="kiosk-bonusClose"
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: '#FFF1E7', color: '#B4552A',
                border: '1.5px solid #FFE1CC', cursor: 'pointer', fontSize: 19,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>

          {/* ── Who ────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="bonus-player" style={FIELD_LABEL}>משתתף</label>
            {/* A native select rather than a search box over a list: the roster
                is the whole of the choice, the browser gives an operator
                type-ahead and a touch-sized picker for free, and it keeps the
                popup one column of three fields. */}
            <select
              id="bonus-player"
              ref={playerRef}
              value={participantId ?? ''}
              disabled={loadingParticipants || participants.length === 0}
              onChange={(e) => { setParticipantId(e.target.value || null); setTouched(false) }}
              className="kiosk-bonusField"
              style={{
                ...FIELD_BOX,
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundImage: CHEVRON,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'left 14px center',
                backgroundSize: '12px 8px',
                paddingLeft: 38,
              }}
            >
              <option value="">
                {loadingParticipants
                  ? 'טוען משתתפים...'
                  : participants.length === 0
                    ? 'אין משתתפים במשחק'
                    : 'בחרו משתתף...'}
              </option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {selected && (
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#3E8F88' }}>
                {selected.points.toLocaleString('he-IL')} נקודות כרגע
              </div>
            )}
          </div>

          {/* ── What for ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="bonus-reason" style={FIELD_LABEL}>על מה הבונוס</label>
            <input
              id="bonus-reason"
              value={reason}
              onChange={(e) => { setReason(e.target.value.slice(0, BONUS_REASON_MAX_LENGTH)); setTouched(false) }}
              placeholder="למשל: עזרה בהקמת התחנה"
              maxLength={BONUS_REASON_MAX_LENGTH}
              className="kiosk-bonusField"
              style={FIELD_BOX}
            />
          </div>

          {/* ── How much ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="bonus-points" style={FIELD_LABEL}>כמה נקודות</label>
            <input
              id="bonus-points"
              value={points}
              // inputMode rather than type=number: a kiosk gets the numeric
              // keypad without the spinner arrows and the scroll-wheel edit
              // that come with it.
              inputMode="numeric"
              onChange={(e) => { setPoints(sanitizeBonusPoints(e.target.value)); setTouched(false) }}
              placeholder="0"
              className="kiosk-bonusField"
              style={{
                ...FIELD_BOX,
                fontSize: 22,
                fontWeight: 900,
                color: '#B4552A',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {POINT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => { setPoints(String(preset)); setTouched(false) }}
                  style={{
                    padding: '6px 14px', borderRadius: 999,
                    border: '1.5px solid #FFE1CC',
                    background: points === String(preset) ? '#FFE6D3' : '#fff',
                    fontSize: 13, fontWeight: 900, color: '#B4552A',
                    cursor: 'pointer', fontFamily: 'inherit',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>

          {/* What is about to happen, in one line, before it does */}
          <div style={{
            borderRadius: 14, padding: '10px 14px',
            background: validation.ok
              ? 'linear-gradient(135deg,#EAF7F1,#E0F2EC)'
              : 'linear-gradient(135deg,#FFF4EC,#FFEADD)',
            fontSize: 13.5, fontWeight: 800, lineHeight: 1.45,
            color: validation.ok ? '#2F7A5E' : '#A8806B',
          }}>
            {validation.ok && selected
              ? `${selected.name} יקבל/תקבל ${validation.points.toLocaleString('he-IL')} נקודות על ${validation.reason}`
              : 'מלאו את שלושת השדות כדי להעניק בונוס'}
          </div>

          {error && (
            <div role="alert" style={{ fontSize: 13.5, fontWeight: 900, color: '#C4432B' }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              // Flex rather than an emoji inside the string: in an RTL row the
              // first child sits on the right, so the label leads and the bolt
              // lands on its left - where the string form put it on whichever
              // side the bidi algorithm decided.
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px 24px', borderRadius: 999, border: 'none',
              background: validation.ok && !submitting
                ? 'linear-gradient(135deg,#FF9366,#F2B33C)'
                // Sand rather than grey: an unfilled form should look like it
                // is waiting, not like a disabled control from another product.
                : 'linear-gradient(135deg,#FBE0CE,#F4D2BB)',
              color: validation.ok && !submitting ? '#fff' : '#C08560',
              fontSize: 17, fontWeight: 900,
              cursor: submitting ? 'wait' : 'pointer',
              boxShadow: validation.ok && !submitting ? '0 8px 22px rgba(255,147,102,0.42)' : 'none',
              fontFamily: 'inherit',
            }}
          >
            <span>{submitting ? 'מעניק...' : 'העניקו בונוס'}</span>
            {!submitting && <span aria-hidden="true">⚡</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
