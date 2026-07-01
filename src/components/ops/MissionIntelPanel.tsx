import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Clock, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { getMissionStatus, getMinutesLeft, getSecondsLeft } from '@/lib/missionUtils'
import type { Action } from '@/types'
import type { MissionStatus } from '@/lib/missionUtils'
import { cn } from '@/lib/utils'

interface Props {
  primaryMission: Action | null
  bonusMissions: Action[]
  sortedMissions: Action[]
  secondNow: Date
}

const STATUS_STYLE: Record<MissionStatus, { label: string; className: string }> = {
  upcoming:  { label: 'מתחילה בעוד', className: 'text-warning bg-surface-elevated border-warning' },
  active:    { label: 'פעילה עכשיו', className: 'text-success bg-surface-elevated border-success' },
  ending:    { label: 'מסתיימת',     className: 'text-danger bg-surface-elevated border-danger' },
  available: { label: 'זמינה',       className: 'text-secondary bg-surface-elevated border-secondary' },
  ended:     { label: 'הסתיימה',     className: 'text-muted bg-surface border-border' },
}

function DigitBox({ digit, isRed }: { digit: string; isRed: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-xl border font-black tabular-nums transition-colors duration-700',
        isRed
          ? 'border-danger bg-surface-elevated text-danger'
          : 'border-border bg-surface-elevated text-foreground',
      )}
      style={{ width: 56, height: 68, fontSize: 40, fontVariantNumeric: 'tabular-nums' }}>
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
          <span key={i} className={cn('text-4xl font-black pb-1 transition-colors duration-700', isRed ? 'text-danger' : 'text-muted')}
            style={{ lineHeight: 1 }}>:</span>
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

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className={cn(
        'rounded-2xl border bg-surface p-4 flex flex-col gap-3 transition-colors duration-600',
        isEnding && 'border-danger',
        !isEnding && isBonus && 'border-warning',
        !isEnding && !isBonus && 'border-border',
      )}>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-muted shrink-0" />
            <span className="text-xs font-bold text-muted">משימה פעילה</span>
          </div>
          {status && (
            <span className={cn(
              'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black',
              STATUS_STYLE[status].className,
            )}>
              {STATUS_STYLE[status].label}
            </span>
          )}
        </div>

        <p className="text-base font-black text-foreground leading-snug line-clamp-2 text-right">
          {primaryMission?.name ?? 'אין משימה פעילה כרגע'}
        </p>

        {primaryMission && (
          <CountdownDigits secsLeft={secsLeft} />
        )}

        <AnimatePresence>
          {isBonus && (
            <motion.div
              className="flex items-center justify-center gap-2 rounded-xl border border-warning bg-surface-elevated py-2 px-3"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 1.05, 1], opacity: 1 }}
              transition={{
                scale: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
                opacity: { duration: 0.3 },
              }}>
              <Flame size={16} className="text-warning" />
              <span className="text-sm font-black text-warning">×{mult} בונוס פעיל!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {bonusMissions.length > 0 && (
        <div className="rounded-2xl border border-warning bg-surface-elevated p-3">
          <div className="flex items-center gap-2 mb-2">
            <Flame size={11} className="text-warning" />
            <span className="text-[11px] font-black text-warning">משימות בונוס</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {bonusMissions.slice(0, 3).map(m => {
              const ms = getMissionStatus(m)
              const mStyle = STATUS_STYLE[ms]
              return (
                <div key={m.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                  <span className={cn('text-[10px] rounded border px-1.5 py-0.5 font-bold', mStyle.className)}>
                    {mStyle.label}
                  </span>
                  <span className="text-xs font-bold text-foreground truncate text-right flex-1 mr-1">{m.name}</span>
                  <span className="text-[10px] font-black text-warning shrink-0">×{Math.max(2, m.speed_multiplier ?? 2)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {sortedMissions.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-3 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={11} className="text-muted" />
            <span className="text-[11px] font-black text-muted">לוח משימות</span>
          </div>
          <div className="flex flex-col">
            {sortedMissions.slice(0, 5).map(m => {
              const ms = getMissionStatus(m)
              const mins = getMinutesLeft(m)
              const startTime = m.start_at ? format(new Date(m.start_at), 'HH:mm') : null
              return (
                <div key={m.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0 text-right">
                  {startTime && (
                    <span className="shrink-0 text-[10px] font-mono text-muted w-9">{startTime}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate">{m.name}</p>
                    <p className="text-[10px] text-muted">
                      {ms === 'active' ? 'פעילה' : ms === 'ending' ? `${mins} דק׳ נשארו` : ms === 'upcoming' && mins !== null ? `בעוד ${mins} דק׳` : 'זמינה'}
                    </p>
                  </div>
                  {m.speed_bonus_enabled && <Flame size={10} className="text-warning shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
