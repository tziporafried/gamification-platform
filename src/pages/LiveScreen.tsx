import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Clock, Bell, Activity, Camera, MapPin, HelpCircle,
  Star, Trophy, Users, Copy, ChevronDown, ArrowRight,
  RotateCcw, Zap, TrendingUp, Check, Flame,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, differenceInMinutes, isPast, isFuture } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import type { Event, Action, ParticipantLeaderboardEntry, GroupLeaderboardEntry } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface TxRow {
  id: string; participant_id: string; action_id: string; points: number; created_at: string
  participant: { name: string; external_id: string }
  action: { name: string; code: string; points: number }
}
interface ActionGroup { action_id: string; group: { id: string; name: string; color: string } | null }

type MissionStatus = 'upcoming' | 'active' | 'ending' | 'available' | 'ended'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeRanks<T extends { total_points: number }>(entries: T[]): (T & { rank: number })[] {
  let r = 1
  return entries.map((e, i) => { if (i > 0 && e.total_points < entries[i - 1].total_points) r = i + 1; return { ...e, rank: r } })
}

function getMissionStatus(action: Action): MissionStatus {
  if (!action.time_enabled || !action.start_at) return 'available'
  const now = new Date()
  const start = new Date(action.start_at)
  const end = action.end_at ? new Date(action.end_at) : null
  if (isFuture(start)) return 'upcoming'
  if (end && isPast(end)) return 'ended'
  if (end && differenceInMinutes(end, now) <= 20) return 'ending'
  return 'active'
}

function getMinutesLeft(action: Action): number | null {
  const now = new Date()
  if (action.end_at) { const m = differenceInMinutes(new Date(action.end_at), now); return m >= 0 ? m : null }
  if (action.start_at && isFuture(new Date(action.start_at))) return differenceInMinutes(new Date(action.start_at), now)
  return null
}

function formatTxTime(iso: string) {
  try { return format(new Date(iso), 'HH:mm') } catch { return '' }
}

const MISSION_ICON_SET = [
  { icon: <Camera size={20} />, bg: '#f97316', light: 'rgba(249,115,22,0.18)' },
  { icon: <MapPin size={20} />, bg: '#a855f7', light: 'rgba(168,85,247,0.18)' },
  { icon: <HelpCircle size={20} />, bg: '#ec4899', light: 'rgba(236,72,153,0.18)' },
  { icon: <Star size={20} />, bg: '#eab308', light: 'rgba(234,179,8,0.18)' },
  { icon: <Zap size={20} />, bg: '#06b6d4', light: 'rgba(6,182,212,0.18)' },
  { icon: <Trophy size={20} />, bg: '#22c55e', light: 'rgba(34,197,94,0.18)' },
]

const ACTIVITY_ICON_SET = [
  { icon: <Trophy size={16} />, bg: '#ef4444', light: 'rgba(239,68,68,0.2)' },
  { icon: <Star size={16} />, bg: '#6366f1', light: 'rgba(99,102,241,0.2)' },
  { icon: <TrendingUp size={16} />, bg: '#22c55e', light: 'rgba(34,197,94,0.2)' },
  { icon: <Trophy size={16} />, bg: '#eab308', light: 'rgba(234,179,8,0.2)' },
  { icon: <Star size={16} />, bg: '#ec4899', light: 'rgba(236,72,153,0.2)' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, onSeeAll }: { icon: React.ReactNode; title: string; onSeeAll?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <button onClick={onSeeAll} className="text-xs font-semibold text-brand-400 transition-colors hover:text-brand-300">ראה הכל</button>
      <div className="flex items-center gap-2">
        <span className="text-sm font-black text-white">{title}</span>
        <div className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>{icon}</div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: MissionStatus }) {
  const map = {
    upcoming: { label: 'מתחילה בעוד', bg: 'rgba(234,179,8,0.18)', color: '#fbbf24', border: 'rgba(234,179,8,0.35)' },
    active: { label: 'פעילה עכשיו', bg: 'rgba(34,197,94,0.18)', color: '#4ade80', border: 'rgba(34,197,94,0.35)' },
    ending: { label: 'מסתיימת בעוד', bg: 'rgba(239,68,68,0.18)', color: '#f87171', border: 'rgba(239,68,68,0.35)' },
    available: { label: 'זמינה', bg: 'rgba(99,102,241,0.18)', color: '#818cf8', border: 'rgba(99,102,241,0.35)' },
    ended: { label: 'הסתיימה', bg: 'rgba(63,63,70,0.18)', color: '#71717a', border: 'rgba(63,63,70,0.35)' },
  }
  const s = map[status]
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  )
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
    </span>
  )
}

// ─── Countdown helpers ────────────────────────────────────────────────────────

function getSecondsLeft(action: Action, now: Date): number | null {
  if (action.end_at) {
    const diff = Math.floor((new Date(action.end_at).getTime() - now.getTime()) / 1000)
    return diff >= 0 ? diff : null
  }
  if (action.start_at && new Date(action.start_at) > now) {
    return Math.floor((new Date(action.start_at).getTime() - now.getTime()) / 1000)
  }
  return null
}

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── Hero particles (fixed positions to avoid Math.random in render) ──────────

const HERO_PARTICLES = [
  { id: 0, x: '8%',  delay: 0,    dur: 3.2, size: 3, color: '#a78bfa' },
  { id: 1, x: '18%', delay: 0.6,  dur: 2.8, size: 2, color: '#ec4899' },
  { id: 2, x: '27%', delay: 1.3,  dur: 3.6, size: 4, color: '#8b5cf6' },
  { id: 3, x: '38%', delay: 0.2,  dur: 2.5, size: 2, color: '#f97316' },
  { id: 4, x: '49%', delay: 1.9,  dur: 3.0, size: 3, color: '#a78bfa' },
  { id: 5, x: '59%', delay: 0.8,  dur: 3.4, size: 4, color: '#06b6d4' },
  { id: 6, x: '70%', delay: 1.5,  dur: 2.7, size: 2, color: '#ec4899' },
  { id: 7, x: '80%', delay: 0.4,  dur: 3.1, size: 3, color: '#8b5cf6' },
  { id: 8, x: '91%', delay: 1.1,  dur: 2.9, size: 4, color: '#f97316' },
]

// ─── Clock face SVG (ticks live with secondNow prop) ─────────────────────────

function ClockFaceSVG({ now, remaining }: { now: Date; remaining: number }) {
  const h = now.getHours() % 12
  const m = now.getMinutes()
  const s = now.getSeconds()
  const hourDeg  = ((h + m / 60) / 12) * 360
  const minuteDeg = ((m + s / 60) / 60) * 360
  const secondDeg = (s / 60) * 360

  function toXY(deg: number, len: number) {
    const rad = (deg - 90) * (Math.PI / 180)
    return { x: 80 + len * Math.cos(rad), y: 80 + len * Math.sin(rad) }
  }

  const r = 62
  const circ = 2 * Math.PI * r
  const strokeDash = `${remaining * circ} ${circ}`

  const hr  = toXY(hourDeg,  32)
  const min = toXY(minuteDeg, 46)
  const sec = toXY(secondDeg, 53)

  return (
    <svg width="168" height="168" viewBox="0 0 160 160" style={{ overflow: 'visible' }}>
      <defs>
        <filter id="glow-v">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-p">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="face-bg" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(139,92,246,0.12)" />
          <stop offset="100%" stopColor="rgba(10,6,22,0.95)" />
        </radialGradient>
      </defs>

      {/* Outer ambient rings */}
      <circle cx="80" cy="80" r="78" fill="none" stroke="rgba(139,92,246,0.08)" strokeWidth="1" />
      <circle cx="80" cy="80" r="72" fill="none" stroke="rgba(236,72,153,0.06)" strokeWidth="1" />

      {/* Countdown progress track */}
      <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(167,139,250,0.12)" strokeWidth="7" />
      {/* Countdown progress fill */}
      <g transform="rotate(-90,80,80)">
        <circle cx="80" cy="80" r={r} fill="none"
          stroke="#a78bfa" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={strokeDash}
          style={{ filter: 'drop-shadow(0 0 10px rgba(167,139,250,0.9))' }} />
      </g>

      {/* Clock face background */}
      <circle cx="80" cy="80" r="56" fill="url(#face-bg)" stroke="rgba(139,92,246,0.2)" strokeWidth="1" />

      {/* Hour tick marks */}
      {Array.from({ length: 12 }, (_, i) => {
        const p1 = toXY((i / 12) * 360, i % 3 === 0 ? 44 : 48)
        const p2 = toXY((i / 12) * 360, 55)
        return (
          <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke={i % 3 === 0 ? 'rgba(167,139,250,0.65)' : 'rgba(167,139,250,0.25)'}
            strokeWidth={i % 3 === 0 ? 2 : 1} strokeLinecap="round" />
        )
      })}

      {/* Hour hand */}
      <line x1="80" y1="80" x2={hr.x} y2={hr.y}
        stroke="#a78bfa" strokeWidth="3.5" strokeLinecap="round" filter="url(#glow-v)" />
      {/* Minute hand */}
      <line x1="80" y1="80" x2={min.x} y2={min.y}
        stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow-p)" />
      {/* Second hand */}
      <line x1="80" y1="80" x2={sec.x} y2={sec.y}
        stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />

      {/* Center cap */}
      <circle cx="80" cy="80" r="5.5" fill="#1a0b2e" stroke="#a78bfa" strokeWidth="2" filter="url(#glow-v)" />
    </svg>
  )
}

// ─── Memoized panel sub-components ───────────────────────────────────────────
// These only re-render when their specific data changes, not on every secondNow tick.

type Reminder = { id: string; groupName: string; groupColor: string; isAllGroups: boolean; message: string; isBonus: boolean }

const RemindersPanel = React.memo(function RemindersPanel({
  reminders, copiedId, onCopy,
}: { reminders: Reminder[]; copiedId: string | null; onCopy: (msg: string, id: string) => void }) {
  return (
    <motion.div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <SectionHeader icon={<Bell size={13} />} title="צריך להזכיר?" />
      {reminders.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-600">אין תזכורות כרגע</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reminders.slice(0, 4).map(r => (
            <div key={r.id} className="flex flex-col gap-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                  style={{ background: r.groupColor, boxShadow: `0 0 8px ${r.groupColor}50` }}>
                  {r.isAllGroups ? '★' : r.groupName.slice(0, 2)}
                </div>
                <p className="text-xs leading-relaxed text-gray-300 flex-1">{r.message}</p>
              </div>
              <button onClick={() => onCopy(r.message, r.id)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-white transition-all hover:opacity-80"
                style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(236,72,153,0.18))', border: '1px solid rgba(167,139,250,0.3)' }}>
                {copiedId === r.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                {copiedId === r.id ? 'הועתק!' : 'שלח תזכורת'}
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
})

type RankedGroup = GroupLeaderboardEntry & { rank: number }

const GroupLeaderboardPanel = React.memo(function GroupLeaderboardPanel({ rankedG }: { rankedG: RankedGroup[] }) {
  return (
    <motion.div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <SectionHeader icon={<Trophy size={13} />} title="דירוג קבוצות" />
      {rankedG.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-600">אין נתוני קבוצות</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {rankedG.slice(0, 5).map((g, idx) => {
              const maxPts = rankedG[0]?.total_points || 1
              const pct = Math.round((g.total_points / maxPts) * 100)
              const RC = ['#eab308', '#a1a1aa', '#ea580c']
              const rc = RC[g.rank - 1] || 'rgba(99,102,241,0.7)'
              return (
                <motion.div key={g.group_id} layout layoutId={`group-lb-${g.group_id}`}
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                  transition={{ layout: { duration: 0.35, ease: 'easeInOut' }, opacity: { duration: 0.2 }, x: { duration: 0.2, delay: 0.15 + idx * 0.04 } }}>
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                    style={{ background: rc, boxShadow: g.rank <= 3 ? `0 0 8px ${rc}60` : 'none' }}>{g.rank}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: g.group_color }} />
                        <span className="text-xs font-bold text-white truncate">{g.group_name}</span>
                      </div>
                      <span className="text-xs font-black text-white shrink-0 mr-1 tabular-nums">{g.total_points.toLocaleString('he-IL')}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <motion.div className="h-full rounded-full" style={{ background: g.group_color }}
                        animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
                    </div>
                  </div>
                  {g.rank === 1 && <span className="text-sm">🔥</span>}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
})

const UpcomingMissionsPanel = React.memo(function UpcomingMissionsPanel({ sortedMissions }: { sortedMissions: Action[] }) {
  return (
    <motion.div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <SectionHeader icon={<Clock size={13} />} title="משימות קרובות" />
      {sortedMissions.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-600">אין משימות</p>
      ) : (
        <div className="flex flex-col">
          {sortedMissions.slice(0, 5).map((m, idx) => {
            const mStatus = getMissionStatus(m)
            const mMins = getMinutesLeft(m)
            const mIcon = MISSION_ICON_SET[idx % MISSION_ICON_SET.length]
            const startTime = m.start_at ? format(new Date(m.start_at), 'HH:mm') : null
            return (
              <div key={m.id} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {startTime && <span className="shrink-0 text-xs font-mono font-bold text-gray-500 w-10">{startTime}</span>}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: mIcon.bg, boxShadow: `0 0 8px ${mIcon.bg}40` }}>
                  {React.cloneElement(mIcon.icon as React.ReactElement, { size: 16 })}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{m.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {mStatus === 'active' ? 'פעילה עכשיו' : mStatus === 'ending' ? `מסתיימת בעוד ${mMins} דק׳` : mStatus === 'upcoming' && mMins !== null ? `מתחילה בעוד ${mMins} דק׳` : 'זמינה'}
                  </p>
                </div>
                {m.speed_bonus_enabled && <Flame size={11} className="text-orange-400 shrink-0" />}
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
})

const RecentActivityPanel = React.memo(function RecentActivityPanel({
  transactions, showMore, onToggleMore,
}: { transactions: TxRow[]; showMore: boolean; onToggleMore: () => void }) {
  return (
    <motion.div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <SectionHeader icon={<Activity size={13} />} title="פעילויות אחרונות" />
      {transactions.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-600">טרם נרשמה פעילות</p>
      ) : (
        <div className="flex flex-col">
          <AnimatePresence initial={false}>
            {transactions.slice(0, showMore ? 12 : 6).map((item, idx) => {
              const basePoints = (item.action as unknown as { points?: number })?.points ?? 0
              const isItemBonus = basePoints > 0 && item.points > basePoints
              const initials = (item.participant?.name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
              const iconDef = ACTIVITY_ICON_SET[idx % ACTIVITY_ICON_SET.length]
              return (
                <motion.div key={item.id} className="flex items-center gap-2 py-2 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}>
                  <span className="shrink-0 text-[10px] font-mono text-gray-600 w-10">{formatTxTime(item.created_at)}</span>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white" style={{ background: iconDef.bg }}>{initials}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{item.participant?.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{item.action?.name}</p>
                  </div>
                  <div className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-black"
                    style={isItemBonus ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' } : { background: 'rgba(255,255,255,0.07)', color: '#d1d5db' }}>
                    {isItemBonus ? '×' : ''}{item.points > 0 ? '+' : ''}{item.points}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
          {transactions.length > 6 && (
            <button onClick={onToggleMore} className="pt-2 text-center text-xs font-semibold text-gray-500 hover:text-gray-300">
              {showMore ? 'הצג פחות' : 'הצג עוד'}
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
})

// ─── Main page ────────────────────────────────────────────────────────────────

function LiveScreenContent({ event }: { event: Event }) {
  const navigate = useNavigate()
  const [participantData, setParticipantData] = useState<ParticipantLeaderboardEntry[]>([])
  const [groupData, setGroupData] = useState<GroupLeaderboardEntry[]>([])
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [actionGroupsMap, setActionGroupsMap] = useState<Map<string, { id: string; name: string; color: string }[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [showMoreActivity, setShowMoreActivity] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  const [secondNow, setSecondNow] = useState(new Date())

  // Track whether the first fetch has completed — background refreshes must never show the spinner
  const isInitialFetch = useRef(true)

  // Tick every minute for mission status recalculation
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t) }, [])
  // Tick every second for hero countdown
  useEffect(() => { const t = setInterval(() => setSecondNow(new Date()), 1_000); return () => clearInterval(t) }, [])

  const fetchAll = useCallback(async () => {
    // No setLoading(true) here — only the very first render shows a spinner
    try {
      const [pRes, gRes, txRes, actRes] = await Promise.all([
        supabase.rpc('get_participant_leaderboard', { p_event_id: event.id }),
        supabase.rpc('get_group_leaderboard', { p_event_id: event.id }),
        supabase.from('point_transactions')
          .select('id, participant_id, action_id, points, created_at, participant:participants(name,external_id), action:actions(name,code,points)')
          .eq('event_id', event.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('actions').select('*').eq('event_id', event.id).eq('is_active', true),
      ])

      const pData = (pRes.data ?? []) as ParticipantLeaderboardEntry[]
      const gData = (gRes.data ?? []) as GroupLeaderboardEntry[]
      const newTx = (txRes.data ?? []) as unknown as TxRow[]
      const newActs = (actRes.data ?? []) as Action[]

      // Only update state if something actually changed — avoids unnecessary re-renders
      setParticipantData(prev => {
        if (prev.length !== pData.length) return pData
        for (let i = 0; i < pData.length; i++) {
          if (prev[i]?.participant_id !== pData[i]?.participant_id || prev[i]?.total_points !== pData[i]?.total_points) return pData
        }
        return prev
      })

      setGroupData(prev => {
        if (prev.length !== gData.length) return gData
        for (let i = 0; i < gData.length; i++) {
          if (prev[i]?.group_id !== gData[i]?.group_id || prev[i]?.total_points !== gData[i]?.total_points) return gData
        }
        return prev
      })

      setTransactions(prev => {
        if (prev.length !== newTx.length || prev[0]?.id !== newTx[0]?.id) return newTx
        return prev
      })

      setActions(prev => {
        if (prev.length !== newActs.length) return newActs
        for (let i = 0; i < newActs.length; i++) {
          const o = prev[i], n = newActs[i]
          if (
            o?.id !== n?.id || o?.is_active !== n?.is_active ||
            o?.start_at !== n?.start_at || o?.end_at !== n?.end_at ||
            o?.speed_bonus_enabled !== n?.speed_bonus_enabled
          ) return newActs
        }
        return prev
      })

      // Action → groups mapping
      if (actRes.data && actRes.data.length > 0) {
        try {
          const actionIds = (actRes.data as Action[]).map((a) => a.id)
          const { data: agData } = await supabase.from('action_groups')
            .select('action_id, group:groups(id,name,color)')
            .in('action_id', actionIds)
          if (agData) {
            const agMap = new Map<string, { id: string; name: string; color: string }[]>()
            for (const row of agData as unknown as ActionGroup[]) {
              if (row.group) {
                const prev = agMap.get(row.action_id) ?? []
                agMap.set(row.action_id, [...prev, row.group])
              }
            }
            setActionGroupsMap(agMap)
          }
        } catch { /* action_groups table might not exist */ }
      }
    } finally {
      // Only clear the loading spinner once — on the first successful fetch
      if (isInitialFetch.current) {
        setLoading(false)
        isInitialFetch.current = false
      }
    }
  }, [event.id])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { const t = setInterval(() => fetchAll(), 30_000); return () => clearInterval(t) }, [fetchAll])

  // ─── Derived data ───────────────────────────────────────────────────────────

  const rankedG = useMemo(() => computeRanks(groupData), [groupData])

  // Missions sorted: active first, then ending, upcoming, available
  const sortedMissions = useMemo(() => {
    const ORDER: Record<MissionStatus, number> = { active: 0, ending: 1, upcoming: 2, available: 3, ended: 99 }
    return [...actions]
      .filter((a) => getMissionStatus(a) !== 'ended')
      .sort((a, b) => ORDER[getMissionStatus(a)] - ORDER[getMissionStatus(b)])
  }, [actions])

  // Hero: most urgent time-based mission (active/ending first, then upcoming)
  const primaryMission = useMemo(() => {
    return (
      sortedMissions.find((a) => { const s = getMissionStatus(a); return (s === 'active' || s === 'ending') && a.time_enabled && a.end_at }) ??
      sortedMissions.find((a) => getMissionStatus(a) === 'upcoming' && a.time_enabled && a.start_at) ??
      sortedMissions[0] ?? null
    )
  }, [sortedMissions])

  // Bonus missions: any mission with speed_bonus_enabled (regardless of multiplier value)
  const bonusMissions = useMemo(() => {
    return sortedMissions.filter((a) => a.speed_bonus_enabled)
  }, [sortedMissions])

  // Points distributed today
  const todayPoints = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return transactions.filter((tx) => new Date(tx.created_at) >= today && tx.points > 0).reduce((s, tx) => s + tx.points, 0)
  }, [transactions])

  // Auto-reminders: one reminder per group per active/upcoming mission
  const reminders = useMemo(() => {
    const activeMissions = sortedMissions.filter((a) => {
      const s = getMissionStatus(a); return s === 'active' || s === 'upcoming' || s === 'ending'
    })
    const results: Reminder[] = []
    for (const mission of activeMissions) {
      const groups = actionGroupsMap.get(mission.id) ?? []
      const status = getMissionStatus(mission)
      const mins = getMinutesLeft(mission)
      let message = ''
      let isBonus = false
      if (status === 'upcoming' && mins !== null) {
        message = `בעוד ${mins} דקות תתחיל המשימה: "${mission.name}"`
      } else if (status === 'ending' && mins !== null) {
        message = `נותרו ${mins} דקות לבצע את המשימה "${mission.name}".`
      } else if (status === 'active' && mission.speed_bonus_enabled) {
        message = `בונוס כפול פעיל עכשיו במשימה "${mission.name}"! 🔥`
        isBonus = true
      } else if (status === 'active') {
        message = `המשימה "${mission.name}" פעילה עכשיו. כדאי לבצע אותה בהקדם!`
      }
      if (!message) continue
      if (groups.length === 0) {
        results.push({ id: `all-${mission.id}`, groupName: 'כולם', groupColor: '#a78bfa', isAllGroups: true, message, isBonus })
      } else {
        for (const g of groups) {
          results.push({ id: `${g.id}-${mission.id}`, groupName: g.name, groupColor: g.color, isAllGroups: false, message, isBonus })
          if (results.length >= 6) break
        }
      }
      if (results.length >= 6) break
    }
    return results
  }, [sortedMissions, actionGroupsMap, now]) // eslint-disable-line react-hooks/exhaustive-deps

  const copyReminder = useCallback(async (message: string, id: string) => {
    await navigator.clipboard.writeText(message).catch(() => {})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const toggleMoreActivity = useCallback(() => setShowMoreActivity(v => !v), [])

  if (loading) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3" style={{ background: '#0d0b18' }}>
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
      <p className="text-sm text-gray-500">טוען מסך חי...</p>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#0d0b18', direction: 'rtl' }}>

      {/* ══ HEADER ══ */}
      <div className="border-b px-5 py-3" style={{ borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          {/* Right: title */}
          <div className="flex-1">
            <h1 className="text-lg font-black text-white">מסך חי</h1>
            <p className="text-[11px] text-gray-500">כל מה שקורה בתחרות בזמן אמת</p>
          </div>

          {/* Center: event name + status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5" style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
              {event.logo_url && <img src={event.logo_url} className="h-4 w-4 rounded object-cover" alt="" />}
              <span className="text-sm font-semibold text-gray-200">{event.name}</span>
              <ChevronDown size={13} className="text-gray-500" />
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <LiveDot />
              <span className="text-[11px] font-bold text-emerald-400">פעילה עכשיו</span>
            </div>
          </div>

          {/* Left: actions */}
          <div className="flex items-center gap-2">
            <button onClick={() => fetchAll()} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-400 transition-all hover:bg-white/[0.07] hover:text-white">
              <RotateCcw size={13} />רענן
            </button>
            <button onClick={() => navigate(`/events/${event.id}/control`)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-400 transition-all hover:bg-white/[0.07] hover:text-white">
              <ArrowRight size={13} />חזרה
            </button>
          </div>
        </div>
      </div>

      {/* ══ HERO BANNER ══ */}
      {(() => {
        const primaryStatus = primaryMission ? getMissionStatus(primaryMission) : null
        const primarySecsLeft = primaryMission ? getSecondsLeft(primaryMission, secondNow) : null
        const isBonus = !!primaryMission?.speed_bonus_enabled
        const isEnding = primaryStatus === 'ending'
        const isUpcoming = primaryStatus === 'upcoming'
        const mult = isBonus ? Math.max(2, primaryMission!.speed_multiplier) : 2
        let ringRemaining = 1
        if (primaryMission?.end_at && primaryMission?.start_at) {
          const total = new Date(primaryMission.end_at).getTime() - new Date(primaryMission.start_at).getTime()
          ringRemaining = Math.max(0, Math.min(1, 1 - (secondNow.getTime() - new Date(primaryMission.start_at).getTime()) / total))
        }
        const bonusTimeSecs: number | null = (() => {
          if (!isBonus || !primaryMission) return null
          if (primaryMission.speed_bonus_minutes && primaryMission.start_at) {
            const rem = Math.floor((new Date(primaryMission.start_at).getTime() + primaryMission.speed_bonus_minutes * 60_000 - secondNow.getTime()) / 1000)
            return rem > 0 ? rem : null
          }
          return primarySecsLeft
        })()
        const showCountdown = primarySecsLeft !== null
        const heroMins = showCountdown ? String(Math.floor(primarySecsLeft! / 60)).padStart(2, '0') : String(secondNow.getHours()).padStart(2, '0')
        const heroSecs = showCountdown ? String(primarySecsLeft! % 60).padStart(2, '0') : String(secondNow.getMinutes()).padStart(2, '0')
        const accentColor = isEnding ? '#f87171' : isBonus ? '#fb923c' : '#a78bfa'
        const glowColor  = isEnding ? 'rgba(239,68,68,0.22)' : isBonus ? 'rgba(249,115,22,0.22)' : 'rgba(139,92,246,0.18)'
        const borderColor = isEnding ? 'rgba(239,68,68,0.45)' : isBonus ? 'rgba(249,115,22,0.4)' : 'rgba(139,92,246,0.35)'
        return (
          <div className="mx-auto max-w-7xl px-5 pt-2">
            <motion.div className="relative overflow-hidden rounded-3xl"
              style={{ background: 'linear-gradient(135deg, #0f0820 0%, #1c0a35 50%, #0b1929 100%)', border: `1px solid ${borderColor}` }}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0, boxShadow: [`0 0 60px ${glowColor}`, `0 0 100px ${glowColor}`, `0 0 60px ${glowColor}`] }}
              transition={{ opacity: { duration: 0.4 }, y: { duration: 0.4, ease: 'easeOut' }, boxShadow: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } }}>
              {/* Ambient blobs */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute right-0 top-0 h-72 w-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 70%)', transform: 'translate(20%,-30%)' }} />
                <div className="absolute bottom-0 h-48 w-48 rounded-full" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.22) 0%, transparent 70%)', left: '38%', transform: 'translateY(30%)' }} />
              </div>
              {/* Particles */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {HERO_PARTICLES.map(p => (
                  <motion.div key={p.id} className="absolute rounded-full"
                    style={{ left: p.x, bottom: 0, width: p.size, height: p.size, backgroundColor: p.color, filter: 'blur(0.5px)' }}
                    animate={{ y: [0, -240], opacity: [0, 0.9, 0] }}
                    transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeOut' }} />
                ))}
              </div>
              {/* 3-col — RTL: first=right, last=left */}
              <div className="relative flex items-stretch" style={{ minHeight: 210 }}>
                {/* RIGHT info panel */}
                <div className="w-52 shrink-0 flex flex-col gap-3 p-5" style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.28)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-black text-emerald-400" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <LiveDot />חי
                    </div>
                    <span className="text-[10px] text-gray-500">סטטוס נוכחי</span>
                  </div>
                  {isBonus ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1"><Flame size={13} className="text-orange-400" /><span className="text-sm font-black text-orange-400">בונוס פעיל!</span></div>
                      {bonusTimeSecs !== null && (
                        <div className="rounded-lg p-2" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
                          <p className="text-[10px] text-gray-500 mb-0.5">נשארו לסיום הבונוס</p>
                          <p className="text-sm font-black text-orange-300 font-mono">{formatCountdown(Math.floor(bonusTimeSecs))}</p>
                        </div>
                      )}
                      {primarySecsLeft !== null && (
                        <div className="rounded-lg p-2" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                          <p className="text-[10px] text-gray-500 mb-0.5">המשימה מסתיימת בעוד</p>
                          <p className="text-sm font-black text-purple-300 font-mono">{formatCountdown(primarySecsLeft)}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-gray-400">{isUpcoming ? 'ממתינה להתחלה' : isEnding ? 'מסתיימת בקרוב' : 'פעיל'}</p>
                      {primaryMission && <p className="mt-0.5 text-[11px] text-gray-600 leading-tight">{primaryMission.name}</p>}
                    </div>
                  )}
                  <div className="mt-auto flex flex-col items-center py-1">
                    <motion.div className="text-[58px] font-black leading-none"
                      animate={isBonus ? { scale: [1, 1.06, 1] } : {}} transition={{ duration: 1.8, repeat: Infinity }}
                      style={isBonus ? { background: 'linear-gradient(135deg, #f97316, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 16px rgba(249,115,22,0.6))' } : { color: 'rgba(255,255,255,0.08)' }}>
                      ×{mult}
                    </motion.div>
                    {isBonus && <span className="text-[11px] font-bold text-orange-400 -mt-1">בבונוס נקודות</span>}
                  </div>
                </div>
                {/* CENTER: title + countdown */}
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-6">
                  <motion.span className="text-base font-black" style={{ color: accentColor }}
                    animate={{ opacity: [0.85, 1, 0.85] }} transition={{ duration: 2, repeat: Infinity }}>
                    {isBonus ? '🔥 בונוס כפול פעיל עכשיו!' : isEnding ? '⚡ מסתיים בקרוב!' : isUpcoming ? '⏳ עוד מעט מתחיל' : '▶ פעיל עכשיו'}
                  </motion.span>
                  {primaryMission && (
                    <p className="text-sm font-bold text-gray-300">
                      <Zap size={12} className="inline ml-1 text-yellow-400" />
                      משימת &ldquo;{primaryMission.name}&rdquo;
                    </p>
                  )}
                  {/* MM : SS digit boxes */}
                  <div className="flex items-end gap-3" dir="ltr">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex gap-1.5">
                        {[0, 1].map(i => {
                          const d = heroMins[i] ?? '-'
                          return (
                            <AnimatePresence key={`m${i}`} mode="popLayout">
                              <motion.span key={`m${i}${d}`}
                                className="flex h-[68px] w-12 items-center justify-center rounded-xl text-5xl font-black tabular-nums text-white"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', textShadow: `0 0 24px ${accentColor}cc` }}
                                initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.15 }}>
                                {d}
                              </motion.span>
                            </AnimatePresence>
                          )
                        })}
                      </div>
                      <span className="text-xs text-gray-500">{showCountdown ? 'דקות' : 'שעות'}</span>
                    </div>
                    <motion.span className="text-5xl font-black mb-7" style={{ color: accentColor }}
                      animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>:</motion.span>
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex gap-1.5">
                        {[0, 1].map(i => {
                          const d = heroSecs[i] ?? '-'
                          return (
                            <AnimatePresence key={`s${i}`} mode="popLayout">
                              <motion.span key={`s${i}${d}`}
                                className="flex h-[68px] w-12 items-center justify-center rounded-xl text-5xl font-black tabular-nums text-white"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', textShadow: `0 0 24px ${accentColor}cc` }}
                                initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.15 }}>
                                {d}
                              </motion.span>
                            </AnimatePresence>
                          )
                        })}
                      </div>
                      <span className="text-xs text-gray-500">{showCountdown ? 'שניות' : 'דקות'}</span>
                    </div>
                  </div>
                </div>
                {/* CLOCK — leftmost in RTL (last in DOM) */}
                <div className="w-52 shrink-0 flex items-center justify-center py-4" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ filter: 'drop-shadow(0 0 28px rgba(139,92,246,0.55))' }}>
                    <ClockFaceSVG now={secondNow} remaining={ringRemaining} />
                  </div>
                </div>
              </div>
              <motion.div className="h-[3px] w-full"
                style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, #ec4899, ${accentColor}, transparent)` }}
                animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.5, repeat: Infinity }} />
            </motion.div>
          </div>
        )
      })()}

      {/* ══ STATS ROW ══ */}
      <div className="mx-auto max-w-7xl px-5 pt-4">
        {(() => {
          const activeCnt = sortedMissions.filter(a => { const s = getMissionStatus(a); return s === 'active' || s === 'ending' }).length
          const STATS = [
            { v: participantData.length,               label: 'משתתפים פעילים',        icon: <Users size={17} />,             ib: 'rgba(6,182,212,0.15)',    ic: '#22d3ee' },
            { v: groupData.length,                     label: 'קבוצות',                icon: <Users size={17} />,             ib: 'rgba(99,102,241,0.15)',   ic: '#818cf8' },
            { v: todayPoints.toLocaleString('he-IL'),  label: 'נקודות שחולקו היום',    icon: <Star size={17} fill="#fbbf24"/>, ib: 'rgba(234,179,8,0.15)',    ic: '#fbbf24' },
            { v: activeCnt,                            label: 'משימות פעילות',          icon: <Zap size={17} />,               ib: 'rgba(168,85,247,0.15)',   ic: '#c084fc' },
            { v: bonusMissions.length,                 label: 'משימות בונוס פעילות',   icon: <Flame size={17} />,             ib: 'rgba(249,115,22,0.15)',   ic: '#fb923c' },
            { v: reminders.length,                     label: 'זקוקים לתזכורת',        icon: <Bell size={17} />,              ib: 'rgba(59,130,246,0.15)',   ic: '#60a5fa' },
          ]
          return (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {STATS.map((s, i) => (
                <motion.div key={i} className="flex items-center gap-3 rounded-xl p-3.5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: s.ib, color: s.ic }}>{s.icon}</div>
                  <div className="min-w-0">
                    <p className="text-lg font-black leading-tight" style={{ color: s.ic }}>{s.v}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">{s.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* ══ BONUS MISSIONS ══ */}
      <div className="mx-auto max-w-7xl px-5 pt-4">
        <motion.div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.05) 0%, rgba(168,85,247,0.05) 100%)', border: '1px solid rgba(249,115,22,0.18)' }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-400">ראה הכל ←</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">משימות <span className="text-orange-400">בונוס</span> פעילות</span>
              <motion.div className="flex h-6 w-6 items-center justify-center rounded-lg text-orange-400" style={{ background: 'rgba(249,115,22,0.15)' }}
                animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <Flame size={13} />
              </motion.div>
            </div>
          </div>
          {bonusMissions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl text-gray-700" style={{ background: 'rgba(255,255,255,0.04)' }}><Flame size={22} /></div>
              <p className="text-sm font-semibold text-gray-600">אין כרגע משימות בונוס פעילות</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bonusMissions.map((bm, idx) => {
                const bStatus = getMissionStatus(bm)
                const bSecsLeft = getSecondsLeft(bm, secondNow)
                const bGroups = actionGroupsMap.get(bm.id) ?? []
                const bMult = bm.speed_multiplier > 1 ? bm.speed_multiplier : 2
                const bonusPts = bm.speed_bonus_flat_points ? bm.points + bm.speed_bonus_flat_points : Math.round(bm.points * bMult)
                const isActive = bStatus === 'active' || bStatus === 'ending'
                const aC = bStatus === 'ending' ? '#ef4444' : bStatus === 'upcoming' ? '#eab308' : '#f97316'
                let barPct = 1
                if (bm.speed_bonus_minutes && bSecsLeft !== null) barPct = Math.max(0, Math.min(1, bSecsLeft / (bm.speed_bonus_minutes * 60)))
                else if (bm.end_at && bm.start_at) { const total = new Date(bm.end_at).getTime() - new Date(bm.start_at).getTime(); barPct = Math.max(0, Math.min(1, (new Date(bm.end_at).getTime() - secondNow.getTime()) / total)) }
                return (
                  <motion.div key={bm.id} className="relative overflow-hidden rounded-xl p-4"
                    style={{ background: 'rgba(15,8,32,0.9)', border: `1px solid ${aC}35` }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, boxShadow: isActive ? [`0 0 14px ${aC}18`, `0 0 28px ${aC}32`, `0 0 14px ${aC}18`] : '0 0 0px transparent' }}
                    transition={{ opacity: { duration: 0.3, delay: idx * 0.07 }, y: { duration: 0.3, delay: idx * 0.07 }, boxShadow: { duration: 2, repeat: Infinity } }}>
                    {/* Icon + name row */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="shrink-0 relative">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${aC}, #a855f7)`, boxShadow: `0 0 14px ${aC}50` }}>
                          <Flame size={22} />
                        </div>
                        <div className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white" style={{ background: 'linear-gradient(135deg, #f97316, #dc2626)' }}>
                          ×{bMult}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <p className="text-sm font-black text-white leading-tight">{bm.name}</p>
                          <StatusBadge status={bStatus} />
                        </div>
                        {bSecsLeft !== null && <p className="text-xs font-bold font-mono" style={{ color: aC }}>נשארו {formatCountdown(bSecsLeft)} דקות</p>}
                      </div>
                    </div>
                    {/* Points */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] text-gray-600 mr-auto">לנקודות</span>
                      <span className="text-sm font-black" style={{ color: aC }}>{bonusPts} נק׳</span>
                      <span className="text-[10px] text-gray-600">←</span>
                      <span className="text-xs text-gray-600 line-through">{bm.points} נק׳</span>
                    </div>
                    {/* Groups */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {bGroups.length > 0 ? bGroups.map(g => (
                        <span key={g.id} className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${g.color}22`, color: g.color, border: `1px solid ${g.color}40` }}>{g.name}</span>
                      )) : (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-purple-400" style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)' }}>לכל הקבוצות</span>
                      )}
                      <span className="text-[10px] text-gray-600 self-center mr-1">לקבוצות</span>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <motion.div className="h-full rounded-full" style={{ background: aC, boxShadow: `0 0 6px ${aC}80` }}
                          animate={{ width: `${barPct * 100}%` }} transition={{ duration: 0.5, ease: 'linear' }} />
                      </div>
                      <span className="text-[10px] font-bold shrink-0" style={{ color: aC }}>{Math.round(barPct * 100)}%</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* ══ BOTTOM 4-COL GRID ══ */}
      <div className="mx-auto max-w-7xl px-5 py-4 pb-8">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
          <RemindersPanel reminders={reminders} copiedId={copiedId} onCopy={copyReminder} />
          <GroupLeaderboardPanel rankedG={rankedG} />
          <UpcomingMissionsPanel sortedMissions={sortedMissions} />
          <RecentActivityPanel transactions={transactions} showMore={showMoreActivity} onToggleMore={toggleMoreActivity} />
        </div>
      </div>
    </div>
  )
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export function LiveScreenPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return
      const { data } = await supabase.from('events').select('*').eq('id', id).neq('status', 'archived').single()
      if (!data) { navigate('/events', { replace: true }); return }
      setEvent(data); setLoading(false)
    }
    fetchEvent()
  }, [id, user, navigate])

  if (loading || !event) return <FullPageLoader />
  return <LiveScreenContent event={event} />
}
