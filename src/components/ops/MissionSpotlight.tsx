import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AccentRgb } from '@/lib/accentColor'
import type { Action } from '@/types'
import type { RankedGroup } from '@/hooks/useOperationsData'
import { getMissionStatus, getSecondsLeft, formatCountdown } from '@/lib/missionUtils'
import { cn } from '@/lib/utils'

interface Props {
  sortedMissions: Action[]
  bonusMissions: Action[]
  rankedGroups: RankedGroup[]
  secondNow: Date
  accent: AccentRgb
}

const ROTATION_MS = 4800

const GENERIC_PROMPTS = [
  { id: 'p0', icon: '🎯', title: 'בחרו משימה לפתיחה', sub: 'עודדו קבוצה להתחיל עכשיו' },
  { id: 'p1', icon: '⚡', title: 'הפעילו בונוס', sub: 'כדי להכניס אנרגיה למשחק' },
  { id: 'p2', icon: '🔍', title: 'בדקו מי עדיין לא', sub: 'ביצע את המשימה המרכזית' },
  { id: 'p3', icon: '🚀', title: 'עודדו קבוצה להתחיל', sub: 'משימה חדשה עכשיו' },
  { id: 'p4', icon: '🏆', title: 'מי יגיע ראשון?', sub: 'המתח בשיאו — הכל פתוח' },
]

function statusLabel(status: ReturnType<typeof getMissionStatus>, secsLeft: number | null): string {
  if (status === 'active')   return 'פעילה עכשיו'
  if (status === 'ending')   return secsLeft != null ? `מסתיימת בעוד ${formatCountdown(secsLeft)}` : 'מסתיימת בקרוב'
  if (status === 'upcoming') return secsLeft != null ? `מתחילה בעוד ${formatCountdown(secsLeft)}` : 'מתחילה בקרוב'
  return ''
}

function statusClasses(status: ReturnType<typeof getMissionStatus>) {
  switch (status) {
    case 'ending':   return { card: 'border-danger', badge: 'border-danger bg-surface-elevated text-danger', icon: '⏰' }
    case 'active':   return { card: 'border-success', badge: 'border-success bg-surface-elevated text-success', icon: '✅' }
    case 'upcoming': return { card: 'border-accent', badge: 'border-accent bg-surface-elevated text-accent', icon: '🔜' }
    default:         return { card: 'border-border', badge: 'border-border bg-surface-elevated text-muted', icon: '🎯' }
  }
}

function rankClasses(rank: number) {
  if (rank === 1) return { card: 'border-warning', badge: 'border-warning bg-surface-elevated text-warning', score: 'text-warning' }
  if (rank === 2) return { card: 'border-border', badge: 'border-border bg-surface-elevated text-muted', score: 'text-foreground' }
  if (rank === 3) return { card: 'border-accent', badge: 'border-accent bg-surface-elevated text-accent', score: 'text-accent' }
  return { card: 'border-secondary', badge: 'border-secondary bg-surface-elevated text-secondary', score: 'text-secondary' }
}

function groupPrompt(group: RankedGroup, rank: number): string {
  if (rank === 1) return 'מובילים בדירוג! המשיכו לסרוק'
  if (rank === 2) return 'קרובים מאוד למקום הראשון — קדימה!'
  if (rank === 3) return 'מקום שלישי — כדאי להאיץ'
  if (group.total_points === 0) return 'עדיין לא התחילו — הגיע הזמן!'
  return 'המשיכו לצבור נקודות עכשיו'
}

const SLIDE = {
  enter:  { x: 52, opacity: 0, scale: 0.96 },
  center: { x: 0,  opacity: 1, scale: 1    },
  exit:   { x: -52, opacity: 0, scale: 0.96 },
}
const SLIDE_TRANSITION = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const }

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
  const col    = statusClasses(status)
  const bonus  = bonusMissions.find(b => b.id === mission.id && (getMissionStatus(b) === 'active' || getMissionStatus(b) === 'ending'))
  const mult   = bonus ? Math.max(2, bonus.speed_multiplier ?? 2) : null

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 bg-surface shadow-card',
        col.card,
        primary ? 'p-[18px_18px]' : 'p-[12px_16px]',
      )}
    >
      <div className="relative flex items-start gap-3">
        <motion.span
          className="shrink-0 select-none leading-none"
          style={{ fontSize: primary ? 38 : 28 }}
          animate={{ scale: status === 'ending' ? [1, 1.15, 1] : [1, 1.06, 1] }}
          transition={{ duration: status === 'ending' ? 0.8 : 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {col.icon}
        </motion.span>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-black', col.badge)}>
              {statusLabel(status, secs)}
            </span>
            {mult && (
              <motion.span
                className="rounded-full border border-warning bg-surface-elevated px-2 py-0.5 text-[11px] font-black text-warning"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                🔥 ×{mult} בונוס
              </motion.span>
            )}
          </div>

          <p
            className="font-black leading-tight text-foreground"
            style={{ fontSize: primary ? 17 : 14 }}
          >
            {mission.name}
          </p>

          {primary && (
            <p className={cn(
              'mt-1 text-xs font-bold',
              status === 'ending' ? 'text-danger' :
              status === 'active' ? 'text-success' :
              status === 'upcoming' ? 'text-accent' : 'text-muted',
            )}>
              {mission.points > 0 ? `+${mission.points} נקודות` : ''}
              {mult && mission.points > 0 ? ` → +${Math.round(mission.points * mult)} עם בונוס` : ''}
            </p>
          )}
        </div>
      </div>

      {status === 'ending' && secs != null && mission.end_at && (
        <motion.div
          className="absolute bottom-0 left-0 h-[3px] rounded-b-2xl bg-danger"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
      )}
    </div>
  )
}

function GroupSpotlightCard({
  group, availableMissions,
}: {
  group: RankedGroup
  availableMissions: Action[]
}) {
  const rank  = group.rank
  const col   = rankClasses(rank)
  const medal = ['🥇', '🥈', '🥉'][rank - 1] ?? '⭐'

  return (
    <div className={cn('relative flex flex-1 flex-col overflow-hidden rounded-2xl border-2 bg-surface p-5 shadow-card', col.card)}>
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 select-none leading-none" style={{ fontSize: 52 }}>{medal}</span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className={cn('mb-1.5 inline-flex items-center rounded-lg border px-2.5 py-1', col.badge)}>
              <span className="text-[15px] font-black leading-none">
                מקום #{rank}
              </span>
            </div>
            <p className="text-[28px] font-black leading-tight text-foreground">{group.group_name}</p>
          </div>
        </div>

        <div>
          <p className={cn('font-black leading-none tabular-nums', col.score)} style={{ fontSize: 54 }}>
            {group.total_points.toLocaleString('he-IL')}
          </p>
          <p className="mt-1 text-[12px] font-bold uppercase tracking-widest text-muted">נקודות</p>
        </div>

        <p className="text-[15px] font-semibold leading-snug text-foreground">
          {groupPrompt(group, rank)}
        </p>

        {availableMissions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">
              משימות פתוחות
            </p>
            {availableMissions.slice(0, 3).map(m => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3"
              >
                <span className="shrink-0 select-none text-xl">🎯</span>
                <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">{m.name}</p>
                <span className="shrink-0 text-[13px] font-black text-success">+{m.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PromptCard({
  icon, title, sub,
}: {
  icon: string
  title: string
  sub: string
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-accent bg-surface p-8 text-center shadow-card min-h-[180px]">
      <motion.span
        className="relative mb-4 text-6xl leading-none select-none"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {icon}
      </motion.span>
      <p className="relative text-[18px] font-black leading-snug text-foreground">{title}</p>
      <p className="relative mt-1 text-[13px] font-medium text-muted">{sub}</p>
    </div>
  )
}

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
          style={{ height: 6, background: i === active ? `rgb(${r},${g},${b})` : 'var(--color-border)' }}
        />
      ))}
    </div>
  )
}

export function MissionSpotlight({ sortedMissions, bonusMissions, rankedGroups, secondNow, accent }: Props) {
  const [rotIdx, setRotIdx] = useState(0)

  const timedMissions = useMemo(
    () => sortedMissions.filter(m => m.time_enabled && ['active', 'ending', 'upcoming'].includes(getMissionStatus(m))),
    [sortedMissions, secondNow], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const availableMissions = useMemo(
    () => sortedMissions.filter(m => getMissionStatus(m) === 'available'),
    [sortedMissions],
  )

  const showTimed   = timedMissions.length > 0
  const scoredGroups = rankedGroups.filter(g => g.total_points > 0)
  const totalGroups = scoredGroups.length
  const totalItems  = totalGroups > 0 ? totalGroups : GENERIC_PROMPTS.length

  useEffect(() => {
    if (showTimed || totalItems <= 1) return
    const t = setInterval(() => setRotIdx(prev => (prev + 1) % totalItems), ROTATION_MS)
    return () => clearInterval(t)
  }, [showTimed, totalItems])

  useEffect(() => { setRotIdx(0) }, [showTimed])

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden" style={{ direction: 'rtl' }}>
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

          {availableMissions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">גם זמינות</p>
              {availableMissions.slice(0, 2).map(m => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2"
                >
                  <span className="text-sm select-none">🎯</span>
                  <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">{m.name}</p>
                  <span className="shrink-0 text-[11px] font-black text-success">+{m.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!showTimed && (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
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
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="shrink-0">
            <Dots total={totalItems} active={rotIdx} accent={accent} />
          </div>
        </div>
      )}
    </div>
  )
}
