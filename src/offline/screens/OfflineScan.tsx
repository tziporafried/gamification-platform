import { useCallback, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Camera, Ban, ScanLine } from 'lucide-react'
import { useHardwareScanner } from '@/hooks/useHardwareScanner'
import { useScanSequence } from '@/hooks/useScanSequence'
import { getParticipantLeaderboard } from '@/lib/offline/leaderboard'
import type { GamePack } from '@/lib/offline/types'
import type { ScoreSubmitResult } from '@/hooks/useScoreSubmit'

type Feedback =
  | { kind: 'idle' }
  | { kind: 'success'; result: ScoreSubmitResult }
  | { kind: 'error'; message: string }

const FEEDBACK_MS = 3200

interface OfflineScanProps {
  pack: GamePack
  scans: { participantId: string; points: number }[]
  scanCount: number
  onSubmitCodes: (participantCode: string, actionCode: string) =>
    | { ok: true; result: ScoreSubmitResult }
    | { ok: false; error: string }
  onBack: () => void
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

export function OfflineScan({ pack, scans, scanCount, onSubmitCodes, onBack }: OfflineScanProps) {
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' })
  const [manualP, setManualP] = useState('')
  const [manualA, setManualA] = useState('')
  const clearTimer = useRef<ReturnType<typeof setTimeout>>()

  const showFeedback = useCallback((next: Feedback) => {
    setFeedback(next)
    clearTimeout(clearTimer.current)
    clearTimer.current = setTimeout(() => setFeedback({ kind: 'idle' }), FEEDBACK_MS)
  }, [])

  const handleCodes = useCallback(
    (p: string, a: string) => {
      const res = onSubmitCodes(p, a)
      showFeedback(res.ok ? { kind: 'success', result: res.result } : { kind: 'error', message: res.error })
    },
    [onSubmitCodes, showFeedback],
  )

  const handleScanError = useCallback(
    (message: string) => showFeedback({ kind: 'error', message }),
    [showFeedback],
  )

  const { handleScan, pending, remainingSeconds } = useScanSequence({
    onPair: handleCodes,
    onError: handleScanError,
  })

  const bindScanner = useHardwareScanner(true, handleScan)

  const awaiting = feedback.kind === 'idle' ? pending : null

  // Unknown codes still arm - they are only validated on submit - so the
  // greeting falls back to a neutral one rather than blocking.
  const awaitingName = useMemo(
    () => awaiting
      ? pack.participants.find((p) => p.external_id === awaiting.participantCode)?.name ?? null
      : null,
    [awaiting, pack.participants],
  )

  const submitManual = useCallback(() => {
    if (!manualP.trim() || !manualA.trim()) return
    handleCodes(manualP.trim(), manualA.trim())
    setManualP('')
    setManualA('')
  }, [manualP, manualA, handleCodes])

  const topFive = useMemo(
    () => getParticipantLeaderboard(pack, scans as never).slice(0, 5),
    [pack, scans],
  )

  return (
    <div className="pl-scan">
      <div className="pl-topbar">
        <div className="pl-brand">
          <button className="pl-btn" onClick={onBack}>
            <ArrowRight size={18} strokeWidth={2.5} />
            חזרה
          </button>
          <span className="pl-brand-name">{pack.event.name}</span>
        </div>
        <div className="pl-topbar-actions">
          <div className="pl-stat">
            <div className="pl-stat-num">{scanCount}</div>
            <div className="pl-stat-label">סריקות</div>
          </div>
        </div>
      </div>

      <div className="pl-scan-body">
        <div className="pl-stage">
          <input ref={bindScanner} className="pl-hidden-input" aria-hidden="true" tabIndex={-1} />

          <AnimatePresence>
            {feedback.kind === 'idle' && !awaiting && (
              <motion.div key="idle" className="pl-prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="pl-prompt-badge"><Camera size={52} strokeWidth={2} /></div>
                <div className="pl-prompt-title">מוכנים לסריקה</div>
                <div className="pl-prompt-sub">סרקו את הברקוד של המשתתף</div>
              </motion.div>
            )}

            {awaiting && (
              <motion.div
                key="awaiting"
                className="pl-prompt pl-prompt--awaiting"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              >
                <motion.div
                  className="pl-prompt-badge"
                  animate={{ y: [0, -8, 0], rotate: [-3, 3, -3] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ScanLine size={52} strokeWidth={2} />
                </motion.div>
                <div className="pl-prompt-title">
                  {awaitingName ? `שלום ${awaitingName}!` : 'שלום!'}
                </div>
                <div className="pl-prompt-sub">מחכים לתיקוף שלך - סרקו את כרטיס המשימה</div>
                <div className="pl-prompt-dots" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
                    />
                  ))}
                </div>
                <div className="pl-prompt-countdown">ממתין עוד {remainingSeconds} שניות</div>
              </motion.div>
            )}

            {feedback.kind === 'success' && (
              <motion.div
                key={feedback.result.transactionId}
                className="pl-fb"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              >
                <div className="pl-fb-avatar">{initials(feedback.result.participantName)}</div>
                <div className="pl-fb-name">{feedback.result.participantName}</div>
                <div className="pl-fb-action">{feedback.result.actionName}</div>
                <motion.div
                  className="pl-fb-points"
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  +{feedback.result.points}
                </motion.div>
                <div className="pl-fb-total">סה״כ {feedback.result.participantTotalPoints} נקודות</div>
                {feedback.result.celebrationRewards.map((r) => (
                  <motion.div key={r.out_reward_id} className="pl-fb-reward" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    🏆 זכית בפרס: {r.out_reward_name}
                  </motion.div>
                ))}
              </motion.div>
            )}

            {feedback.kind === 'error' && (
              <motion.div key="error" className="pl-err" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -8, 8, -4, 0] }} exit={{ opacity: 0 }}>
                <div className="pl-err-badge"><Ban size={50} strokeWidth={2} /></div>
                <div className="pl-err-msg">{feedback.message}</div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pl-manual">
            <input value={manualP} onChange={(e) => setManualP(e.target.value)} placeholder="קוד משתתף" onKeyDown={(e) => e.key === 'Enter' && submitManual()} />
            <input value={manualA} onChange={(e) => setManualA(e.target.value)} placeholder="קוד משימה" onKeyDown={(e) => e.key === 'Enter' && submitManual()} />
            <button className="pl-btn pl-btn--primary" onClick={submitManual} disabled={!manualP.trim() || !manualA.trim()}>
              הוספה
            </button>
          </div>
        </div>

        <aside className="pl-rail">
          <h3><ScanLine size={14} style={{ display: 'inline', verticalAlign: '-2px', marginInlineEnd: 6 }} />מובילים</h3>
          {topFive.length === 0 ? (
            <div className="pl-empty">עדיין אין סריקות</div>
          ) : (
            topFive.map((row, i) => (
              <div key={row.participant_id} className={`pl-crow pl-crow--${i + 1}`}>
                <span className="pl-crow-rank">{i + 1}</span>
                <span className="pl-crow-name">{row.participant_name}</span>
                <span className="pl-crow-pts">{row.total_points}</span>
              </div>
            ))
          )}
        </aside>
      </div>
    </div>
  )
}
