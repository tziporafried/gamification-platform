import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Link as LinkIcon, Check, Settings, Crown, Sparkles, LayoutDashboard, Lock, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { ReadinessChecklist } from './ReadinessChecklist'
import { useEventHeaderBreadcrumb } from '@/hooks/useEventHeaderBreadcrumb'
import { useAuth } from '@/contexts/AuthContext'
import { calculateReadiness, isEventReady, getWizardPrefs } from '@/lib/wizard'
import { getLockedTemplate, clearLockedTemplate, completeTemplateImport, LOCKED_TEMPLATE_CHANGED } from '@/lib/lockedTemplate'
import type { Event, EventCounts, LockedTemplateStore } from '@/types'

interface ControlCenterProps {
  event: Event
  counts: EventCounts
}

const PARTICLE_COUNT = 20

interface Particle {
  x: number; y: number; size: number; opacity: number
  speedX: number; speedY: number; hue: number
}

function createParticle(): Particle {
  return {
    x: Math.random() * 100, y: Math.random() * 100,
    size: 1 + Math.random() * 2.5, opacity: 0.15 + Math.random() * 0.25,
    speedX: (Math.random() - 0.5) * 0.015, speedY: (Math.random() - 0.5) * 0.015,
    hue: 260 + Math.random() * 50,
  }
}

export function ControlCenter({ event, counts }: ControlCenterProps) {
  const navigate = useNavigate()
  const { isFreePlan } = useAuth()
  const [copied, setCopied] = useState(false)
  const [lockedTemplate, setLockedTemplate] = useState<LockedTemplateStore | null>(null)
  const [completing, setCompleting] = useState(false)
  useEventHeaderBreadcrumb(event.name)

  useEffect(() => {
    function syncLocked() {
      setLockedTemplate(getLockedTemplate(event.id))
    }
    syncLocked()
    window.addEventListener(LOCKED_TEMPLATE_CHANGED, syncLocked)
    return () => window.removeEventListener(LOCKED_TEMPLATE_CHANGED, syncLocked)
  }, [event.id])

  async function handleCompleteImport() {
    setCompleting(true)
    try {
      await completeTemplateImport(event.id)
    } catch {
      // silently ignore — user can retry
    } finally {
      setCompleting(false)
    }
  }
  const ready = isEventReady(event, counts)
  const checks = calculateReadiness(event, counts)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef(0)

  const floatingStars = useMemo(() => Array.from({ length: 6 }, () => ({
    left: 10 + Math.random() * 80, top: 10 + Math.random() * 80,
    duration: 3 + Math.random() * 3, delay: Math.random() * 4,
  })), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, createParticle)
    function resize() {
      canvas!.width = canvas!.offsetWidth * window.devicePixelRatio
      canvas!.height = canvas!.offsetHeight * window.devicePixelRatio
      ctx!.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize(); window.addEventListener('resize', resize)
    function animate() {
      const w = canvas!.offsetWidth; const h = canvas!.offsetHeight
      ctx!.clearRect(0, 0, w, h)
      for (const p of particlesRef.current) {
        p.x += p.speedX; p.y += p.speedY
        if (p.x < 0) p.x = 100; if (p.x > 100) p.x = 0
        if (p.y < 0) p.y = 100; if (p.y > 100) p.y = 0
        ctx!.beginPath()
        ctx!.arc((p.x / 100) * w, (p.y / 100) * h, p.size, 0, Math.PI * 2)
        ctx!.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.opacity})`
        ctx!.fill()
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(rafRef.current) }
  }, [])

  function handleAction(route: string) {
    window.open(`/events/${event.id}/${route}`, '_blank', 'noopener,noreferrer')
  }

  async function copyManagementLink() {
    if (!event.slug) return
    const url = `${window.location.origin}/e/${event.slug}/control`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tc = '#7c3aed'

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full z-0" />

      {/* Ambient gradient blobs */}
      <motion.div className="pointer-events-none absolute -left-1/4 -top-1/4 h-[60vh] w-[60vh] rounded-full z-0"
        style={{ background: `radial-gradient(circle, ${tc}18 0%, transparent 70%)` }}
        animate={{ x: [0, 60, -30, 0], y: [0, 40, -20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} />
      <motion.div className="pointer-events-none absolute -bottom-1/4 -right-1/4 h-[50vh] w-[50vh] rounded-full z-0"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 70%)' }}
        animate={{ x: [0, -40, 30, 0], y: [0, -50, 20, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} />

      {/* Floating stars */}
      {floatingStars.map((s, i) => (
        <motion.div key={i} className="pointer-events-none absolute z-0 text-amber-400/20"
          style={{ left: `${s.left}%`, top: `${s.top}%` }}
          animate={{ opacity: [0, 0.4, 0], scale: [0.5, 1.2, 0.5], rotate: [0, 180, 360] }}
          transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}>
          <Sparkles size={10} />
        </motion.div>
      ))}

      <div className="relative z-10">
        {/* Top bar */}
        <div className="border-b border-white/[0.05]">
          <div className="mx-auto flex h-10 max-w-5xl items-center justify-end gap-2 px-4">
            <Button variant="ghost" size="sm" onClick={copyManagementLink}>
              {copied ? <Check size={14} className="ml-1 text-emerald-400" /> : <LinkIcon size={14} className="ml-1" />}
              {copied ? 'הועתק!' : 'העתק קישור'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/events/${event.id}/step/${getWizardPrefs(event.id).lastStep}`)}>
              <Settings size={14} className="ml-1" />
              הגדרות
            </Button>
          </div>
        </div>

        <main className="mx-auto max-w-4xl px-4 py-10">
          {/* ═══ HERO ═══ */}
          <motion.div className="mb-12 flex flex-col items-center text-center"
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {/* Event logo */}
            {event.logo_url ? (
              <motion.img src={event.logo_url} alt={event.name} className="mb-4 h-20 w-20 rounded-3xl object-cover shadow-xl"
                style={{ boxShadow: `0 0 30px ${tc}35` }}
                animate={{ boxShadow: [`0 0 30px ${tc}25`, `0 0 45px ${tc}45`, `0 0 30px ${tc}25`] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
            ) : (
              <motion.div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-black text-white shadow-xl"
                style={{ backgroundColor: tc + '25' }}
                animate={{ boxShadow: [`0 0 30px ${tc}25`, `0 0 45px ${tc}45`, `0 0 30px ${tc}25`] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                {event.name.slice(0, 2)}
              </motion.div>
            )}

            <motion.h1 className="mb-2 text-3xl font-black text-white sm:text-4xl"
              style={{ textShadow: '0 0 20px rgba(255,255,255,0.08)' }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              {event.name}
            </motion.h1>

            <motion.div className="flex items-center gap-2"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
              </span>
              <span className="text-xs font-semibold text-emerald-400/80">
                {ready ? 'מוכן למשחק' : 'בהכנה'}
              </span>
            </motion.div>
          </motion.div>

          {/* Readiness checklist */}
          {!ready && (
            <motion.div className="mb-10" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <ReadinessChecklist checks={checks} eventId={event.id} />
            </motion.div>
          )}

          {/* Upgrade — complete locked template import */}
          {!isFreePlan && lockedTemplate && (
            <motion.div
              className="mb-8 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                  <Lock size={18} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-300">
                    תוכן פרמיום ממתין מהתבנית "{lockedTemplate.templateName}"
                  </p>
                  <p className="mt-0.5 text-xs text-amber-400/60">
                    {[
                      lockedTemplate.groups.length > 0 && `${lockedTemplate.groups.length} קבוצות`,
                      lockedTemplate.tasks.length > 0 && `${lockedTemplate.tasks.length} משימות`,
                      lockedTemplate.rewards.length > 0 && `${lockedTemplate.rewards.length} פרסים`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    loading={completing}
                    onClick={handleCompleteImport}
                    className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
                  >
                    <Zap size={13} className="ml-1" />
                    ייבא הכל
                  </Button>
                  <button
                    onClick={() => clearLockedTemplate(event.id)}
                    className="text-xs text-amber-500/40 hover:text-amber-400/60 transition-colors"
                    title="הסתר"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ GAME CARDS ═══ */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* OPS CONSOLE — unified scoring + live */}
            <motion.button onClick={() => handleAction('ops')} className="group relative text-right"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
              <div className="relative overflow-hidden rounded-3xl border-2 border-violet-500/30 p-8 transition-shadow duration-300 group-hover:shadow-[0_0_50px_rgba(139,92,246,0.25)]"
                style={{ background: 'linear-gradient(135deg, rgba(20,10,50,0.97) 0%, rgba(30,8,10,0.97) 50%, rgba(10,18,30,0.97) 100%)' }}>
                <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: 'radial-gradient(circle at 50% 30%, rgba(139,92,246,0.1), transparent 50%), radial-gradient(circle at 80% 70%, rgba(249,115,22,0.08), transparent 50%)' }} />
                {/* Dual-color scan beam */}
                <motion.div className="pointer-events-none absolute left-6 right-6 h-[1px] z-10"
                  style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.5) 30%, rgba(249,115,22,0.7) 50%, rgba(139,92,246,0.5) 70%, transparent 100%)', boxShadow: '0 0 10px rgba(139,92,246,0.3)' }}
                  animate={{ top: ['15%', '85%', '15%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
                <motion.div className="pointer-events-none absolute inset-0 rounded-3xl"
                  style={{ border: '2px solid rgba(139,92,246,0.2)' }}
                  animate={{ boxShadow: ['0 0 15px rgba(139,92,246,0.05)', '0 0 30px rgba(249,115,22,0.15)', '0 0 15px rgba(139,92,246,0.05)'] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} />
                <div className="relative flex flex-col items-center gap-4 text-center">
                  <motion.div className="flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(249,115,22,0.15))', boxShadow: '0 0 20px rgba(139,92,246,0.15)' }}
                    animate={{ boxShadow: ['0 0 20px rgba(139,92,246,0.1)', '0 0 30px rgba(249,115,22,0.2)', '0 0 20px rgba(139,92,246,0.1)'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
                    <LayoutDashboard size={30} className="text-violet-400" style={{ filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.5))' }} />
                  </motion.div>
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-1.5">
                      <h3 className="text-xl font-black text-white">🔥 שחקו בלי להפסיק</h3>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      סרקו משימות וצברו נקודות
                    </p>
                  </div>
                  <div className="mt-2 rounded-xl px-5 py-2 text-sm font-bold text-violet-300 transition-all group-hover:opacity-80"
                    style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(249,115,22,0.1))', border: '1px solid rgba(139,92,246,0.25)' }}>
                    פתח ←
                  </div>
                </div>
              </div>
            </motion.button>
            {/* LIVE LEADERBOARD */}
            <motion.button onClick={() => handleAction('display')} className="group relative text-right"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
              whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
              <div className="relative overflow-hidden rounded-3xl border-2 border-amber-500/25 p-8 transition-shadow duration-300 group-hover:shadow-[0_0_50px_rgba(251,191,36,0.15)]"
                style={{ background: 'linear-gradient(135deg, rgba(30,20,50,0.95) 0%, rgba(15,11,30,0.98) 100%)' }}>
                <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: 'radial-gradient(circle at 50% 30%, rgba(251,191,36,0.08), transparent 70%)' }} />
                {/* Pulsing border glow */}
                <motion.div className="pointer-events-none absolute inset-0 rounded-3xl"
                  style={{ border: '2px solid rgba(251,191,36,0.2)' }}
                  animate={{ boxShadow: ['0 0 15px rgba(251,191,36,0.05)', '0 0 30px rgba(251,191,36,0.12)', '0 0 15px rgba(251,191,36,0.05)'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} />

                <div className="relative flex flex-col items-center gap-4 text-center">
                  <motion.div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15"
                    style={{ boxShadow: '0 0 20px rgba(251,191,36,0.1)' }}
                    animate={{ boxShadow: ['0 0 20px rgba(251,191,36,0.08)', '0 0 30px rgba(251,191,36,0.2)', '0 0 20px rgba(251,191,36,0.08)'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}>
                    <Trophy size={30} className="text-amber-400" fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.4))' }} />
                  </motion.div>
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-1.5">
                      <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>
                        <Crown size={16} className="text-amber-400" fill="#fbbf24" />
                      </motion.div>
                      <h3 className="text-xl font-black text-white">שיאנים בלייב</h3>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      צפו בדירוג המתעדכן בזמן אמת
                    </p>
                  </div>
                  <div className="mt-2 rounded-xl bg-amber-500/10 px-5 py-2 text-sm font-bold text-amber-300 transition-all group-hover:bg-amber-500/20">
                    צפו בדירוג ←
                  </div>
                </div>
              </div>
            </motion.button>
          </div>

          {/* Stats */}
          {ready && (
            <motion.div className="mt-10 flex items-center justify-center gap-6 sm:gap-10"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
              {[
                { label: 'משתתפים', value: counts.participants },
                { label: 'משימות', value: counts.tasks },
                { label: 'סריקות', value: counts.transactions },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center">
                  <span className="text-2xl font-black text-white tabular-nums">{s.value.toLocaleString('he-IL')}</span>
                  <span className="text-[11px] text-gray-500">{s.label}</span>
                </div>
              ))}
            </motion.div>
          )}
        </main>
      </div>
    </div>
  )
}
