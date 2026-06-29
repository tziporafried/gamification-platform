import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AccentRgb } from '@/lib/accentColor'
import type { Action } from '@/types'
import type { RankedGroup } from '@/hooks/useOperationsData'
import { getMissionStatus, getSecondsLeft, formatCountdown } from '@/lib/missionUtils'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  sortedMissions: Action[]
  bonusMissions: Action[]
  rankedGroups: RankedGroup[]
  secondNow: Date
  accent: AccentRgb
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROTATION_MS = 4800

const GENERIC_PROMPTS = [
  { id: 'p0', icon: '🎯', title: 'בחרו משימה לפתיחה', sub: 'עודדו קבוצה להתחיל עכשיו' },
  { id: 'p1', icon: '⚡', title: 'הפעילו בונוס', sub: 'כדי להכניס אנרגיה למשחק' },
  { id: 'p2', icon: '🔍', title: 'בדקו מי עדיין לא', sub: 'ביצע את המשימה המרכזית' },
  { id: 'p3', icon: '🚀', title: 'עודדו קבוצה להתחיל', sub: 'משימה חדשה עכשיו' },
  { id: 'p4', icon: '🏆', title: 'מי יגיע ראשון?', sub: 'המתח בשיאו — הכל פתוח' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(status: ReturnType<typeof getMissionStatus>, secsLeft: number | null): string {
  if (status === 'active')   return 'פעילה עכשיו'
  if (status === 'ending')   return secsLeft != null ? `מסתיימת בעוד ${formatCountdown(secsLeft)}` : 'מסתיימת בקרוב'
  if (status === 'upcoming') return secsLeft != null ? `מתחילה בעוד ${formatCountdown(secsLeft)}` : 'מתחילה בקרוב'
  return ''
}

function statusColors(status: ReturnType<typeof getMissionStatus>): { border: string; glow: string; badge: string; badgeText: string; icon: string } {
  switch (status) {
    case 'ending':   return { border: '#ef4444', glow: 'rgba(239,68,68,0.22)', badge: 'rgba(239,68,68,0.18)', badgeText: '#fca5a5', icon: '⏰' }
    case 'active':   return { border: '#22c55e', glow: 'rgba(34,197,94,0.20)',  badge: 'rgba(34,197,94,0.16)',  badgeText: '#86efac', icon: '✅' }
    case 'upcoming': return { border: '#a78bfa', glow: 'rgba(167,139,250,0.20)',badge: 'rgba(139,92,246,0.16)', badgeText: '#c4b5fd', icon: '🔜' }
    default:         return { border: '#64748b', glow: 'rgba(100,116,139,0.15)',badge: 'rgba(100,116,139,0.12)',badgeText: '#94a3b8', icon: '🎯' }
  }
}

const RANK_MEDALS = ['🥇', '🥈', '🥉']
const RANK_COLORS = [
  { border: '#eab308', glow: 'rgba(234,179,8,0.22)',    bg: 'rgba(234,179,8,0.10)'    },
  { border: '#94a3b8', glow: 'rgba(148,163,184,0.20)',  bg: 'rgba(148,163,184,0.08)'  },
  { border: '#cd7f32', glow: 'rgba(205,127,50,0.20)',   bg: 'rgba(205,127,50,0.08)'   },
]
const DEFAULT_RANK_COLOR = { border: '#6366f1', glow: 'rgba(99,102,241,0.18)', bg: 'rgba(99,102,241,0.07)' }

function rankColor(rank: number) { return RANK_COLORS[rank - 1] ?? DEFAULT_RANK_COLOR }

function groupPrompt(group: RankedGroup, rank: number): string {
  if (rank === 1) return 'מובילים בדירוג! המשיכו לסרוק'
  if (rank === 2) return 'קרובים מאוד למקום הראשון — קדימה!'
  if (rank === 3) return 'מקום שלישי — כדאי להאיץ'
  if (group.total_points === 0) return 'עדיין לא התחילו — הגיע הזמן!'
  return 'המשיכו לצבור נקודות עכשיו'
}

// ─── Slide animation ──────────────────────────────────────────────────────────

const SLIDE = {
  enter:  { x: 52, opacity: 0, scale: 0.96 },
  center: { x: 0,  opacity: 1, scale: 1    },
  exit:   { x: -52, opacity: 0, scale: 0.96 },
}
const SLIDE_TRANSITION = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const }

// ─── Timed mission card ───────────────────────────────────────────────────────

function TimedMissionCard({
  mission, bonusMissions, secondNow, primary,
}: {
  mission: Action
  bonusMissions: Action[]
  secondNow: Date
  primary: boolean
}) {
  const status = getMissionStatus(mission)
  const secs   = getSecondsLeft(mission, secondNow)
  const col    = statusColors(status)
  const bonus  = bonusMissions.find(b => b.id === mission.id && (getMissionStatus(b) === 'active' || getMissionStatus(b) === 'ending'))
  const mult   = bonus ? Math.max(2, bonus.speed_multiplier ?? 2) : null

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: `linear-gradient(135deg, rgba(6,4,14,0.92) 0%, rgba(6,4,14,0.80) 100%)`,
        border: `1.5px solid ${col.border}`,
        boxShadow: `0 0 20px ${col.glow}, 0 2px 12px rgba(0,0,0,0.40)`,
        padding: primary ? '18px 18px' : '12px 16px',
      }}
    >
      {/* Inner glow */}
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at 90% 50%, ${col.glow}, transparent 60%)` }} />

      <div className="relative flex items-start gap-3">
        {/* Icon */}
        <motion.span
          className="shrink-0 select-none leading-none"
          style={{ fontSize: primary ? 38 : 28 }}
          animate={{ scale: status === 'ending' ? [1, 1.15, 1] : [1, 1.06, 1] }}
          transition={{ duration: status === 'ending' ? 0.8 : 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {col.icon}
        </motion.span>

        <div className="min-w-0 flex-1">
          {/* Status badge row */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-black"
              style={{ background: col.badge, color: col.badgeText }}
            >
              {statusLabel(status, secs)}
            </span>
            {mult && (
              <motion.span
                className="rounded-full px-2 py-0.5 text-[11px] font-black"
                style={{ background: 'rgba(249,115,22,0.20)', color: '#fdba74' }}
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                🔥 ×{mult} בונוס
              </motion.span>
            )}
          </div>

          {/* Mission name */}
          <p
            className="font-black leading-tight text-white"
            style={{ fontSize: primary ? 17 : 14 }}
          >
            {mission.name}
          </p>

          {/* Points */}
          {primary && (
            <p className="mt-1 text-xs font-bold" style={{ color: col.badgeText }}>
              {mission.points > 0 ? `+${mission.points} נקודות` : ''}
              {mult && mission.points > 0 ? ` → +${Math.round(mission.points * mult)} עם בונוס` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Countdown bar for 'ending' */}
      {status === 'ending' && secs != null && mission.end_at && (
        <motion.div
          className="absolute bottom-0 left-0 h-[3px] rounded-b-2xl"
          style={{ background: col.border }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
      )}
    </div>
  )
}

// ─── Group spotlight card ─────────────────────────────────────────────────────

function GroupSpotlightCard({
  group, availableMissions,
}: {
  group: RankedGroup
  availableMissions: Action[]
}) {
  const rank  = group.rank
  const col   = rankColor(rank)
  const medal = RANK_MEDALS[rank - 1] ?? '⭐'

  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden rounded-2xl"
      style={{
        background: `linear-gradient(150deg, ${col.bg} 0%, rgba(4,3,12,0.92) 60%)`,
        border: `1.5px solid ${col.border}`,
        boxShadow: `0 0 32px ${col.glow}, 0 4px 20px rgba(0,0,0,0.50)`,
        padding: '20px 20px 20px',
      }}
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 15% 15%, ${col.glow}, transparent 50%)` }} />

      <div className="relative flex flex-col gap-4">

        {/* ── Identity: medal + rank badge + group name ── */}
        <div className="flex items-start gap-3">
          <span className="shrink-0 select-none leading-none" style={{ fontSize: 52 }}>{medal}</span>
          <div className="min-w-0 flex-1 pt-0.5">
            {/* Rank badge — prominent pill */}
            <div
              className="mb-1.5 inline-flex items-center rounded-lg px-2.5 py-1"
              style={{ background: col.bg, border: `1px solid ${col.border}` }}
            >
              <span className="text-[15px] font-black leading-none" style={{ color: col.border }}>
                מקום #{rank}
              </span>
            </div>
            {/* Group name — primary label */}
            <p className="text-[28px] font-black leading-tight text-white">{group.group_name}</p>
          </div>
        </div>

        {/* ── Score — dominant numeric element ── */}
        <div>
          <p
            className="font-black leading-none tabular-nums"
            style={{ fontSize: 54, color: col.border }}
          >
            {group.total_points.toLocaleString('he-IL')}
          </p>
          <p className="mt-1 text-[12px] font-bold uppercase tracking-widest text-gray-500">נקודות</p>
        </div>

        {/* ── Supporting message ── */}
        <p className="text-[15px] font-semibold leading-snug text-gray-200">
          {groupPrompt(group, rank)}
        </p>

        {/* ── Available missions ── */}
        {availableMissions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              משימות פתוחות
            </p>
            {availableMissions.slice(0, 3).map(m => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.09)' }}
              >
                <span className="shrink-0 select-none text-xl">🎯</span>
                <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{m.name}</p>
                <span className="shrink-0 text-[13px] font-black text-emerald-400">+{m.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Generic prompt card ──────────────────────────────────────────────────────

function PromptCard({
  icon, title, sub, accent,
}: {
  icon: string
  title: string
  sub: string
  accent: AccentRgb
}) {
  const { r, g, b } = accent
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl text-center"
      style={{
        background: `linear-gradient(145deg, rgba(${r},${g},${b},0.08) 0%, rgba(6,4,14,0.88) 100%)`,
        border: `1.5px solid rgba(${r},${g},${b},0.30)`,
        boxShadow: `0 0 24px rgba(${r},${g},${b},0.16), 0 4px 16px rgba(0,0,0,0.40)`,
        padding: '32px 24px',
        minHeight: 180,
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 30%, rgba(${r},${g},${b},0.12), transparent 60%)` }} />
      <motion.span
        className="relative mb-4 text-6xl leading-none select-none"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {icon}
      </motion.span>
      <p className="relative text-[18px] font-black leading-snug text-white">{title}</p>
      <p className="relative mt-1 text-[13px] font-medium text-gray-400">{sub}</p>
    </div>
  )
}

// ─── Dot indicators ───────────────────────────────────────────────────────────

function Dots({ total, active, accent }: { total: number; active: number; accent: AccentRgb }) {
  if (total <= 1) return null
  const { r, g, b } = accent
  return (
    <div className="flex justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          animate={{ width: i === active ? 16 : 6, opacity: i === active ? 1 : 0.3 }}
          transition={{ duration: 0.3 }}
          style={{ height: 6, background: `rgb(${r},${g},${b})` }}
        />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MissionSpotlight({ sortedMissions, bonusMissions, rankedGroups, secondNow, accent }: Props) {
  const [rotIdx, setRotIdx] = useState(0)

  // Time-relevant missions: active, ending, upcoming (time_enabled only)
  const timedMissions = useMemo(
    () => sortedMissions.filter(m => m.time_enabled && ['active', 'ending', 'upcoming'].includes(getMissionStatus(m))),
    [sortedMissions, secondNow], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Missions without time constraints (always open)
  const availableMissions = useMemo(
    () => sortedMissions.filter(m => getMissionStatus(m) === 'available'),
    [sortedMissions],
  )

  const showTimed   = timedMissions.length > 0
  const scoredGroups = rankedGroups.filter(g => g.total_points > 0)
  const totalGroups = scoredGroups.length
  const totalItems  = totalGroups > 0 ? totalGroups : GENERIC_PROMPTS.length

  // Rotation timer — only runs when showing group/prompt cards
  useEffect(() => {
    if (showTimed || totalItems <= 1) return
    const t = setInterval(() => setRotIdx(prev => (prev + 1) % totalItems), ROTATION_MS)
    return () => clearInterval(t)
  }, [showTimed, totalItems])

  // Reset rotation index when mode changes
  useEffect(() => { setRotIdx(0) }, [showTimed])

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden" style={{ direction: 'rtl' }}>


      {/* ══════════════════════════════════════════
          MODE A — Timed missions exist
          Show them stacked, most urgent at top
      ═══════════════════════════════════════════ */}
      {showTimed && (
        <div className="flex flex-col gap-3 overflow-hidden">
          {timedMissions.slice(0, 4).map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.3 }}
            >
              <TimedMissionCard
                mission={m}
                bonusMissions={bonusMissions}
                secondNow={secondNow}
                primary={i === 0}
              />
            </motion.div>
          ))}

          {/* Below timed missions: show available missions hint */}
          {availableMissions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">גם זמינות</p>
              {availableMissions.slice(0, 2).map(m => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span className="text-sm select-none">🎯</span>
                  <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-300">{m.name}</p>
                  <span className="shrink-0 text-[11px] font-black text-emerald-400">+{m.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODE B — No timed missions: group / prompt rotation
          Cards slide in from right, exit to left
      ═══════════════════════════════════════════ */}
      {!showTimed && (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          {/* Rotation card */}
          <div className="relative flex-1">
            <AnimatePresence mode="wait">
              {totalGroups > 0 ? (
                <motion.div
                  key={`group-${rotIdx}`}
                  className="absolute inset-0 flex flex-col"
                  variants={SLIDE}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={SLIDE_TRANSITION}
                >
                  <GroupSpotlightCard
                    group={scoredGroups[rotIdx % totalGroups]}
                    availableMissions={availableMissions}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={`prompt-${rotIdx}`}
                  className="absolute inset-0 flex flex-col"
                  variants={SLIDE}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={SLIDE_TRANSITION}
                >
                  <PromptCard
                    {...GENERIC_PROMPTS[rotIdx % GENERIC_PROMPTS.length]}
                    accent={accent}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dot indicators */}
          <div className="shrink-0">
            <Dots total={totalItems} active={rotIdx} accent={accent} />
          </div>
        </div>
      )}
    </div>
  )
}
