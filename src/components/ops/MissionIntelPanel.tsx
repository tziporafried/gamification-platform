import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Clock, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { getMissionStatus, getMinutesLeft, getSecondsLeft } from '@/lib/missionUtils'
import type { Action } from '@/types'
import type { MissionStatus } from '@/lib/missionUtils'

interface Props {
  primaryMission: Action | null
  bonusMissions: Action[]
  sortedMissions: Action[]
  secondNow: Date
}

const STATUS_STYLE: Record<MissionStatus, { label: string; color: string; bg: string; border: string }> = {
  upcoming:  { label: 'מתחילה בעוד', color: '#fbbf24', bg: 'rgba(234,179,8,0.15)',   border: 'rgba(234,179,8,0.35)' },
  active:    { label: 'פעילה עכשיו', color: '#4ade80', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.35)' },
  ending:    { label: 'מסתיימת',     color: '#f87171', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.35)' },
  available: { label: 'זמינה',       color: '#818cf8', bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.35)' },
  ended:     { label: 'הסתיימה',     color: '#71717a', bg: 'rgba(63,63,70,0.12)',    border: 'rgba(63,63,70,0.3)' },
}

function DigitBox({ digit, isRed }: { digit: string; isRed: boolean }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl font-black tabular-nums transition-colors duration-700"
      style={{
        width: 56, height: 68,
        background: isRed ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)',
        border: `1px solid ${isRed ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
        fontSize: 40,
        color: isRed ? '#f87171' : '#ffffff',
        fontVariantNumeric: 'tabular-nums',
      }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={digit}
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}>
          {digit}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

function CountdownDigits({ secsLeft }: { secsLeft: number | null }) {
  const isRed = secsLeft !== null && secsLeft < 5 * 60
  const mm = secsLeft !== null ? String(Math.floor(secsLeft / 60)).padStart(2, '0') : '--'
  const ss = secsLeft !== null ? String(secsLeft % 60).padStart(2, '0') : '--'
  const digits = `${mm}:${ss}`

  return (
    <div className="flex items-center gap-1 justify-center" dir="ltr">
      {digits.split('').map((ch, i) => (
        ch === ':' ? (
          <span key={i} className="text-4xl font-black pb-1 transition-colors duration-700"
            style={{ color: isRed ? '#f87171' : 'rgba(255,255,255,0.5)', lineHeight: 1 }}>:</span>
        ) : (
          <DigitBox key={i} digit={ch} isRed={isRed} />
        )
      ))}
    </div>
  )
}

export function MissionIntelPanel({ primaryMission, bonusMissions, sortedMissions, secondNow }: Props) {
  const secsLeft = primaryMission ? getSecondsLeft(primaryMission, secondNow) : null
  const status = primaryMission ? getMissionStatus(primaryMission) : null
  const isBonus = !!primaryMission?.speed_bonus_enabled
  const isEnding = status === 'ending'
  const mult = primaryMission ? Math.max(2, primaryMission.speed_multiplier ?? 2) : 2

  const borderColor = isEnding
    ? 'rgba(239,68,68,0.4)'
    : isBonus
      ? 'rgba(249,115,22,0.4)'
      : 'rgba(139,92,246,0.3)'

  const glowStyle = isBonus
    ? { boxShadow: '0 0 30px rgba(249,115,22,0.15)' }
    : {}

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Primary Mission Card */}
      <div className="rounded-2xl p-4 flex flex-col gap-3"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${borderColor}`,
          transition: 'border-color 0.6s ease',
          ...glowStyle,
        }}>

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-gray-500 shrink-0" />
            <span className="text-xs font-bold text-gray-400">משימה פעילה</span>
          </div>
          {status && (
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black"
              style={{
                backgroundColor: STATUS_STYLE[status].bg,
                color: STATUS_STYLE[status].color,
                border: `1px solid ${STATUS_STYLE[status].border}`,
              }}>
              {STATUS_STYLE[status].label}
            </span>
          )}
        </div>

        {/* Mission name */}
        <p className="text-base font-black text-white leading-snug line-clamp-2 text-right">
          {primaryMission?.name ?? 'אין משימה פעילה כרגע'}
        </p>

        {/* Countdown */}
        {primaryMission && (
          <CountdownDigits secsLeft={secsLeft} />
        )}

        {/* Bonus badge */}
        <AnimatePresence>
          {isBonus && (
            <motion.div
              className="flex items-center justify-center gap-2 rounded-xl py-2 px-3"
              style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)' }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 1.05, 1], opacity: 1 }}
              transition={{
                scale: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
                opacity: { duration: 0.3 },
              }}>
              <Flame size={16} className="text-orange-400" />
              <span className="text-sm font-black text-orange-300">×{mult} בונוס פעיל!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bonus missions compact list */}
      {bonusMissions.length > 0 && (
        <div className="rounded-2xl p-3" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Flame size={11} className="text-orange-400" />
            <span className="text-[11px] font-black text-orange-300">משימות בונוס</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {bonusMissions.slice(0, 3).map(m => {
              const ms = getMissionStatus(m)
              const mStyle = STATUS_STYLE[ms]
              return (
                <div key={m.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0"
                  style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-[10px] rounded px-1.5 py-0.5 font-bold"
                    style={{ background: mStyle.bg, color: mStyle.color, border: `1px solid ${mStyle.border}` }}>
                    {mStyle.label}
                  </span>
                  <span className="text-xs font-bold text-white truncate text-right flex-1 mr-1">{m.name}</span>
                  <span className="text-[10px] font-black text-orange-400 shrink-0">×{Math.max(2, m.speed_multiplier ?? 2)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming missions */}
      {sortedMissions.length > 0 && (
        <div className="rounded-2xl p-3 flex-1" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={11} className="text-gray-500" />
            <span className="text-[11px] font-black text-gray-400">לוח משימות</span>
          </div>
          <div className="flex flex-col">
            {sortedMissions.slice(0, 5).map(m => {
              const ms = getMissionStatus(m)
              const mins = getMinutesLeft(m)
              const startTime = m.start_at ? format(new Date(m.start_at), 'HH:mm') : null
              return (
                <div key={m.id} className="flex items-center gap-2 py-1.5 border-b last:border-0 text-right"
                  style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  {startTime && (
                    <span className="shrink-0 text-[10px] font-mono text-gray-600 w-9">{startTime}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{m.name}</p>
                    <p className="text-[10px] text-gray-500">
                      {ms === 'active' ? 'פעילה' : ms === 'ending' ? `${mins} דק׳ נשארו` : ms === 'upcoming' && mins !== null ? `בעוד ${mins} דק׳` : 'זמינה'}
                    </p>
                  </div>
                  {m.speed_bonus_enabled && <Flame size={10} className="text-orange-400 shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
