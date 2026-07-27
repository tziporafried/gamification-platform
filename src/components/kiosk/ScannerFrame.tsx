import type { ReactNode } from 'react'
import '@/styles/kiosk.css'

/**
 * The scan surface of the game - the frame the room already knows.
 *
 * It started life inside the kiosk page and now lives here because the lottery
 * projector scans the same cards for the same reason, and a second scan screen
 * that merely resembled this one would read as a different machine. Every
 * screen that asks the room to scan should show this frame.
 */

// ─── Decorative QR - a plausible-looking matrix, not a real code ─────────────
function makeQrMatrix(n: number, seed: number): number[][] {
  let s = seed >>> 0
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  const m: number[][] = []
  for (let r = 0; r < n; r++) {
    const row: number[] = []
    for (let c = 0; c < n; c++) row.push(rnd() > 0.52 ? 1 : 0)
    m.push(row)
  }
  const finder = (R: number, C: number) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const r = R + i, c = C + j
      if (r < 0 || c < 0 || r >= n || c >= n) continue
      const inRange = i >= 0 && i <= 6 && j >= 0 && j <= 6
      if (!inRange) { m[r][c] = 0; continue }
      const edge = i === 0 || i === 6 || j === 0 || j === 6
      const inner = i >= 2 && i <= 4 && j >= 2 && j <= 4
      m[r][c] = edge || inner ? 1 : 0
    }
  }
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0)
  return m
}
export const QR_MATRIX = makeQrMatrix(21, 41)

// ─── "Participant is in, waiting for the task card" overlay ──────────────────
// Greets the scanned participant by name so they can see the machine picked up
// the right card before they commit to a task.

const WAIT_RING_RADIUS = 34
const WAIT_RING_CIRCUMFERENCE = 2 * Math.PI * WAIT_RING_RADIUS

function AwaitingSecondScanOverlay({
  participantName,
  seconds,
  progress,
  /** What the second card buys - points in the game, a ticket in the lottery. */
  rewardLine = 'סרקו עכשיו את כרטיס המשימה כדי לזכות בנקודות',
}: {
  /** Null when the code matched no participant - greeting falls back to neutral. */
  participantName: string | null
  seconds: number
  progress: number
  rewardLine?: string
}) {
  return (
    <div
      className="kiosk-waitPanel"
      style={{
        position: 'absolute', inset: 0, zIndex: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 'clamp(8px, 1.4vh, 16px)',
        background: 'radial-gradient(circle at 50% 42%,rgba(255,250,246,0.95),rgba(255,238,226,0.9))',
        backdropFilter: 'blur(4px)', textAlign: 'center', padding: '0 6%',
      }}
    >
      {/* Card + halo + draining ring */}
      <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
        <div className="kiosk-waitHalo" style={{
          position: 'absolute', inset: -14, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(255,147,102,0.45),transparent 70%)',
        }} />
        <div className="kiosk-waitPing" style={{
          position: 'absolute', inset: -6, borderRadius: '50%',
          border: '2px solid rgba(239,138,78,0.5)',
        }} />

        <svg viewBox="0 0 80 80" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle className="kiosk-waitRingTrack" cx="40" cy="40" r={WAIT_RING_RADIUS} fill="none" strokeWidth="4" />
          <circle
            className="kiosk-waitRingFill"
            cx="40" cy="40" r={WAIT_RING_RADIUS} fill="none" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={WAIT_RING_CIRCUMFERENCE}
            strokeDashoffset={WAIT_RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)))}
          />
        </svg>

        <div className="kiosk-waitCard" style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 38,
        }}>🙋</div>
      </div>

      <div style={{ fontSize: 'clamp(19px, 2.4vh, 26px)', fontWeight: 900, color: '#2E221E' }}>
        {participantName ? `שלום ${participantName}!` : 'שלום!'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 'clamp(14px, 1.8vh, 17px)', fontWeight: 800, color: '#B4552A' }}>
          מחכים לתיקוף שלך
        </span>
        <span style={{ display: 'flex', gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="kiosk-waitDot" style={{
              width: 5, height: 5, borderRadius: '50%', background: '#EF8A4E',
              animationDelay: `${i * 0.16}s`,
            }} />
          ))}
        </span>
      </div>

      {/* The two slots - participant filled, task still waiting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 999,
          background: 'linear-gradient(135deg,#FF9366,#F2B33C)', color: '#fff',
          fontSize: 13, fontWeight: 900, boxShadow: '0 6px 16px rgba(255,147,102,0.35)',
        }}>
          <span>🙋</span>משתתף<span>✓</span>
        </div>

        <span style={{ fontSize: 15, color: '#B4552A', opacity: 0.6 }}>←</span>

        <div className="kiosk-waitSlot" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 999,
          border: '2px dashed rgba(239,138,78,0.6)', color: '#B4552A',
          fontSize: 13, fontWeight: 900,
        }}>
          <span style={{ opacity: 0.65 }}>🎯</span>משימה
        </div>
      </div>

      <div style={{ fontSize: 'clamp(13px, 1.7vh, 15px)', fontWeight: 700, color: '#7D706A', lineHeight: 1.4 }}>
        {rewardLine}
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: '#B4552A', opacity: 0.85 }}>
        ממתין עוד {seconds} שניות
      </div>
    </div>
  )
}

// ─── Decorative scanner frame (design-handoff spec) ──────────────────────────
export function ScannerFrame({
  processing,
  locked,
  lockedTitle = 'הסריקה נעולה',
  lockedHint = 'השתמשו בהזנה ידנית',
  awaiting,
  awaitingName,
  awaitingSeconds = 0,
  awaitingRewardLine,
  waitProgress = 0,
  overlay,
}: {
  processing: boolean
  locked?: boolean
  /** Headline of the locked overlay - why this screen cannot scan. */
  lockedTitle?: string
  lockedHint?: string
  /** A participant card is scanned; the scanner is holding for their task card. */
  awaiting?: boolean
  awaitingName?: string | null
  awaitingSeconds?: number
  /** Overrides the "…כדי לזכות בנקודות" line while holding for the task card. */
  awaitingRewardLine?: string
  waitProgress?: number
  /**
   * Anything the host screen wants to say inside the frame - the last scan's
   * result, an error. Drawn above the frame's own states, so it takes the
   * screen for the beat it is on it.
   */
  overlay?: ReactNode
}) {
  return (
    <div className="kiosk-fadeUp kiosk-scannerFrame" style={{ animationDelay: '0.1s' }}>
      {/* Rotating conic glow ring */}
      <div className="kiosk-hueRing" style={{
        position: 'absolute', inset: '-9%', borderRadius: '50%',
        background: 'conic-gradient(from 0deg,#FF9366,#F2B33C,#FFCB9A,#8FCFA0,#5FB3AA,#FF9366)',
        opacity: 0.20, filter: 'blur(9px)',
      }} />
      {/* Gradient border box */}
      <div className="kiosk-scannerBorderOuter" style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg,#FF9366,#F2B33C 40%,#FFCB9A 70%,#8FCFA0)',
        padding: 5, boxShadow: '0 22px 60px rgba(171,53,0,0.16)',
      }}>
        <div className="kiosk-scannerBorderInner" style={{
          width: '100%', height: '100%', overflow: 'hidden',
          background: 'linear-gradient(160deg,#FFFFFF,#FFF1EC)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {/* Dot grid texture */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(255,147,102,0.09) 1.5px,transparent 1.6px)', backgroundSize: '26px 26px' }} />

          {/* QR card - scales with scanner frame */}
          <div className="kiosk-wobble kiosk-scannerParticipantCard" style={{
            background: '#fff',
            boxShadow: '0 16px 40px rgba(171,53,0,0.18)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            position: 'relative', zIndex: 2,
          }}>
            <div className="kiosk-scannerQrMatrix" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(21, 1fr)',
              gridTemplateRows: 'repeat(21, 1fr)',
            }}>
              {QR_MATRIX.flat().map((v, i) => (
                <div key={i} style={{ background: v ? '#AB3500' : '#ffffff' }} />
              ))}
            </div>
            <div className="kiosk-scannerParticipantLabel" style={{ fontWeight: 800, color: '#7D706A' }}>כרטיס המשתתף</div>
          </div>

          {/* Corner brackets */}
          <div className="kiosk-blink kiosk-scannerCorner kiosk-scannerCorner--tr" style={{ position: 'absolute', borderTop: '5px solid #FF9366', borderRight: '5px solid #FF9366', borderTopRightRadius: 14, boxShadow: '0 0 12px rgba(255,147,102,0.35)' }} />
          <div className="kiosk-blink kiosk-scannerCorner kiosk-scannerCorner--tl" style={{ position: 'absolute', borderTop: '5px solid #F2B33C', borderLeft: '5px solid #F2B33C', borderTopLeftRadius: 14, boxShadow: '0 0 12px rgba(242,179,60,0.35)', animationDelay: '0.6s' }} />
          <div className="kiosk-blink kiosk-scannerCorner kiosk-scannerCorner--br" style={{ position: 'absolute', borderBottom: '5px solid #5FB3AA', borderRight: '5px solid #5FB3AA', borderBottomRightRadius: 14, boxShadow: '0 0 12px rgba(95,179,170,0.35)', animationDelay: '1.2s' }} />
          <div className="kiosk-blink kiosk-scannerCorner kiosk-scannerCorner--bl" style={{ position: 'absolute', borderBottom: '5px solid #8FCFA0', borderLeft: '5px solid #8FCFA0', borderBottomLeftRadius: 14, boxShadow: '0 0 12px rgba(143,207,160,0.35)', animationDelay: '1.8s' }} />

          {/* Scan beam */}
          <div className="kiosk-scanY" style={{
            position: 'absolute', left: '7%', right: '7%', height: 3, borderRadius: 3,
            background: 'linear-gradient(90deg,transparent,#FF9366,#F2B33C,#FFB88A,transparent)',
            boxShadow: '0 0 12px 3px rgba(255,147,102,0.35)',
          }} />

          {/* Processing overlay */}
          {processing && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,248,243,0.75)', backdropFilter: 'blur(4px)',
            }}>
              <div className="kiosk-bob" style={{ fontSize: 40 }}>⏳</div>
            </div>
          )}

          {/* Participant scanned - holding for their task card */}
          {awaiting && !processing && !locked && (
            <AwaitingSecondScanOverlay
              participantName={awaitingName ?? null}
              seconds={awaitingSeconds}
              progress={waitProgress}
              rewardLine={awaitingRewardLine}
            />
          )}

          {/* Locked overlay - scanning not included in this plan */}
          {locked && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 15,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
              background: 'rgba(255,248,243,0.88)', backdropFilter: 'blur(3px)',
              textAlign: 'center', padding: '0 8%',
            }}>
              <div style={{
                width: 76, height: 76, borderRadius: '50%',
                background: 'linear-gradient(135deg,#4A3C36,#2E221E)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 10px 28px rgba(46,34,30,0.32)',
              }}>
                <span style={{ fontSize: 36, lineHeight: 1 }}>🔒</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#2E221E' }}>{lockedTitle}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#7D706A' }}>{lockedHint}</div>
            </div>
          )}

          {/* Host-supplied overlay - above every built-in state */}
          {overlay}
        </div>
      </div>
    </div>
  )
}
