import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Target, Award, Flame } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import type { PointTransactionWithDetails } from '@/types'
import type { AccentRgb } from '@/lib/accentColor'
import { rgba } from '@/lib/accentColor'

interface RecentActionsFeedProps {
  transactions: PointTransactionWithDetails[]
  loading: boolean
  accent: AccentRgb
  eventName: string
  eventLogoUrl: string | null
}

const VISIBLE_COUNT = 4
const CYCLE_MS = 3500
const ICONS = [Zap, Target, Award, Flame]
const POSITION_OPACITY = [1, 0.75, 0.55, 0.38]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function RecentActionsFeed({ transactions, loading, accent, eventName, eventLogoUrl }: RecentActionsFeedProps) {
  const pool = useMemo(() => transactions.slice(0, 20), [transactions])

  // queue holds IDs of currently visible cards, newest at index 0
  const [queue, setQueue] = useState<string[]>([])
  const cursorRef = useRef(0)
  const prevFirstIdRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  // Build a lookup map for quick access
  const txMap = useMemo(() => {
    const map = new Map<string, PointTransactionWithDetails>()
    for (const tx of pool) map.set(tx.id, tx)
    return map
  }, [pool])

  // Initialize queue from first batch of transactions
  useEffect(() => {
    if (pool.length > 0 && !initializedRef.current) {
      initializedRef.current = true
      const initial = pool.slice(0, VISIBLE_COUNT).map((t) => t.id)
      setQueue(initial)
      cursorRef.current = Math.min(VISIBLE_COUNT, pool.length)
      prevFirstIdRef.current = pool[0].id
    }
  }, [pool])

  // When a genuinely new scan arrives, inject it at position 0 immediately
  useEffect(() => {
    if (pool.length === 0) return
    const firstId = pool[0].id
    if (prevFirstIdRef.current !== null && firstId !== prevFirstIdRef.current) {
      setQueue((prev) => {
        const next = [firstId, ...prev.filter((id) => id !== firstId)]
        return next.slice(0, VISIBLE_COUNT)
      })
    }
    prevFirstIdRef.current = firstId
  }, [pool])

  // Rotation timer — cycle one card at a time
  useEffect(() => {
    if (pool.length <= 1) return

    const timer = setInterval(() => {
      setQueue((prev) => {
        if (prev.length === 0) return prev
        // Drop oldest (last in array)
        const kept = prev.slice(0, -1)

        // Find next card not already visible
        let attempts = 0
        let cursor = cursorRef.current
        let nextId: string | undefined
        while (attempts < pool.length) {
          nextId = pool[cursor % pool.length]?.id
          cursor++
          attempts++
          if (nextId && !kept.includes(nextId)) break
        }
        cursorRef.current = cursor

        if (!nextId) return prev
        return [nextId, ...kept].slice(0, VISIBLE_COUNT)
      })
    }, CYCLE_MS)

    return () => clearInterval(timer)
  }, [pool])

  // Resolve queue IDs to transaction objects
  const visibleCards = useMemo(() => {
    return queue.map((id) => txMap.get(id)).filter((tx): tx is PointTransactionWithDetails => !!tx)
  }, [queue, txMap])

  return (
    <div className="flex h-full flex-col">
      {/* ===== EVENT BRANDING ===== */}
      <motion.div className="mb-6 flex flex-col items-center text-center"
        initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>

        {/* Logo — large and prominent */}
        {eventLogoUrl ? (
          <motion.img src={eventLogoUrl} alt={eventName}
            className="mb-4 h-[120px] w-[120px] rounded-3xl object-cover"
            style={{ boxShadow: `0 0 40px ${rgba(accent, 0.35)}, 0 0 80px ${rgba(accent, 0.12)}` }}
            animate={{ boxShadow: [
              `0 0 40px ${rgba(accent, 0.3)}, 0 0 80px ${rgba(accent, 0.1)}`,
              `0 0 50px ${rgba(accent, 0.45)}, 0 0 100px ${rgba(accent, 0.15)}`,
              `0 0 40px ${rgba(accent, 0.3)}, 0 0 80px ${rgba(accent, 0.1)}`,
            ]}}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <motion.div
            className="mb-4 flex h-[120px] w-[120px] items-center justify-center rounded-3xl text-3xl font-black text-white"
            style={{ backgroundColor: rgba(accent, 0.2) }}
            animate={{ boxShadow: [
              `0 0 40px ${rgba(accent, 0.25)}, 0 0 80px ${rgba(accent, 0.1)}`,
              `0 0 55px ${rgba(accent, 0.4)}, 0 0 100px ${rgba(accent, 0.15)}`,
              `0 0 40px ${rgba(accent, 0.25)}, 0 0 80px ${rgba(accent, 0.1)}`,
            ]}}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {getInitials(eventName)}
          </motion.div>
        )}

        <h2 className="text-2xl font-black text-white lg:text-3xl">{eventName}</h2>
      </motion.div>

      {/* ===== LIVE INDICATOR ===== */}
      <motion.div className="mb-4 flex items-center gap-2"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ backgroundColor: rgba(accent, 0.6) }} />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: rgba(accent, 1) }} />
        </span>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: rgba(accent, 0.8) }}>LIVE</span>
      </motion.div>

      {/* ===== NOTIFICATION CARDS ===== */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-t-transparent"
              style={{ borderColor: rgba(accent, 0.5), borderTopColor: 'transparent' }} />
          </div>
        ) : pool.length === 0 ? (
          <motion.div className="rounded-2xl border border-game-border bg-game-card/30 px-6 py-14 text-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Zap size={32} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm text-gray-400">הפעילות תופיע כאן לאחר סריקות</p>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {visibleCards.map((tx, idx) => {
                const Icon = ICONS[idx % ICONS.length]
                const isNewest = idx === 0
                const posOpacity = POSITION_OPACITY[idx] ?? 0.35
                const isPositive = tx.points >= 0
                const relativeTime = formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: he })

                return (
                  <motion.div
                    key={tx.id}
                    layout
                    initial={{ x: '-100%', opacity: 0, scale: 0.95 }}
                    animate={{ x: 0, opacity: posOpacity, scale: 1 }}
                    exit={{ x: '-100%', opacity: 0, scale: 0.97 }}
                    transition={{
                      x: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: 0.5 },
                      scale: { duration: 0.5 },
                      layout: { type: 'spring', stiffness: 300, damping: 30 },
                    }}
                    className="rounded-2xl border bg-game-card/60 p-4 backdrop-blur-sm"
                    style={{
                      borderColor: isNewest ? rgba(accent, 0.45) : 'rgba(45,34,80,0.35)',
                      boxShadow: isNewest
                        ? `0 0 24px ${rgba(accent, 0.25)}, inset 0 1px 0 ${rgba(accent, 0.08)}`
                        : 'none',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: rgba(accent, isNewest ? 0.15 : 0.08) }}>
                        <Icon size={18} style={{ color: rgba(accent, isNewest ? 0.9 : 0.5) }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white">{tx.participant.name}</p>
                        <p className="mt-0.5 text-sm text-gray-300">
                          {isPositive ? 'קיבל/ה' : 'הופחתו'}{' '}
                          <span className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPositive ? '+' : ''}{tx.points} נקודות
                          </span>
                          {' '}עבור{' '}
                          <span className="font-medium text-white">{tx.action.name}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500">{relativeTime}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
