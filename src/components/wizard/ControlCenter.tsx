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
    size: 1 + Math.random() * 2.5, opacity: 0.08 + Math.random() * 0.14,
    speedX: (Math.random() - 0.5) * 0.015, speedY: (Math.random() - 0.5) * 0.015,
    hue: 15 + Math.random() * 25,
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
        ctx!.fillStyle = `hsla(${p.hue}, 70%, 45%, ${p.opacity})`
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

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-app-radial">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full z-0" />

      <motion.div
        className="pointer-events-none absolute -left-1/4 -top-1/4 h-[60vh] w-[60vh] rounded-full z-0"
        style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-primary) 10%, transparent) 0%, transparent 70%)' }}
        animate={{ x: [0, 60, -30, 0], y: [0, 40, -20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-1/4 -right-1/4 h-[50vh] w-[50vh] rounded-full z-0"
        style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-warning) 8%, transparent) 0%, transparent 70%)' }}
        animate={{ x: [0, -40, 30, 0], y: [0, -50, 20, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      />

      {floatingStars.map((s, i) => (
        <motion.div key={i} className="pointer-events-none absolute z-0 text-warning/25"
          style={{ left: `${s.left}%`, top: `${s.top}%` }}
          animate={{ opacity: [0, 0.4, 0], scale: [0.5, 1.2, 0.5], rotate: [0, 180, 360] }}
          transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}>
          <Sparkles size={10} />
        </motion.div>
      ))}

      <div className="relative z-10">
        <div className="border-b border-border">
          <div className="mx-auto flex h-10 max-w-5xl items-center justify-end gap-2 px-4">
            <Button variant="ghost" size="sm" onClick={copyManagementLink}>
              {copied ? <Check size={14} className="ml-1 text-success" /> : <LinkIcon size={14} className="ml-1" />}
              {copied ? 'הועתק!' : 'העתק קישור'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/events/${event.id}/step/${getWizardPrefs(event.id).lastStep}`)}>
              <Settings size={14} className="ml-1" />
              הגדרות
            </Button>
          </div>
        </div>

        <main className="mx-auto max-w-4xl px-4 py-10">
          <motion.div className="mb-12 flex flex-col items-center text-center"
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {event.logo_url ? (
              <motion.img src={event.logo_url} alt={event.name}
                className="mb-4 h-20 w-20 rounded-3xl object-cover shadow-card border border-border"
                animate={{ boxShadow: [
                  '0 0 0 1px var(--color-border)',
                  '0 0 0 2px color-mix(in srgb, var(--color-primary) 30%, transparent)',
                  '0 0 0 1px var(--color-border)',
                ] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
            ) : (
              <motion.div
                className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-surface-elevated text-2xl font-black text-primary shadow-card"
                animate={{ boxShadow: [
                  '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                  '0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent)',
                  '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                ] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                {event.name.slice(0, 2)}
              </motion.div>
            )}

            <motion.h1 className="mb-2 text-3xl font-black text-foreground sm:text-4xl"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              {event.name}
            </motion.h1>

            <motion.div className="flex items-center gap-2"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              <span className="text-xs font-semibold text-success">
                {ready ? 'מוכן למשחק' : 'בהכנה'}
              </span>
            </motion.div>
          </motion.div>

          {!ready && (
            <motion.div className="mb-10" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <ReadinessChecklist checks={checks} eventId={event.id} />
            </motion.div>
          )}

          {!isFreePlan && lockedTemplate && (
            <motion.div
              className="mb-8 rounded-2xl border border-warning bg-surface-elevated p-5"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface border border-warning">
                  <Lock size={18} className="text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-warning">
                    תוכן פרמיום ממתין מהתבנית "{lockedTemplate.templateName}"
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
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
                    className="border border-warning bg-surface text-warning hover:bg-surface-elevated"
                  >
                    <Zap size={13} className="ml-1" />
                    ייבא הכל
                  </Button>
                  <button
                    onClick={() => clearLockedTemplate(event.id)}
                    className="text-xs text-muted hover:text-warning transition-colors"
                    title="הסתר"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <motion.button onClick={() => handleAction('ops')} className="group relative text-right"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
              <div className="relative overflow-hidden rounded-3xl border-2 border-primary bg-surface p-8 shadow-card transition-shadow duration-300 group-hover:shadow-card-hover">
                <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: 'radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--color-primary) 8%, transparent), transparent 50%), radial-gradient(circle at 80% 70%, color-mix(in srgb, var(--color-accent) 6%, transparent), transparent 50%)' }} />
                <motion.div
                  className="pointer-events-none absolute left-6 right-6 h-[1px] z-10 bg-primary/40"
                  animate={{ top: ['15%', '85%', '15%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative flex flex-col items-center gap-4 text-center">
                  <motion.div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary bg-surface-elevated"
                    animate={{ boxShadow: [
                      '0 0 0 0 color-mix(in srgb, var(--color-primary) 10%, transparent)',
                      '0 0 0 4px color-mix(in srgb, var(--color-primary) 15%, transparent)',
                      '0 0 0 0 color-mix(in srgb, var(--color-primary) 10%, transparent)',
                    ] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
                    <LayoutDashboard size={30} className="text-primary" />
                  </motion.div>
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-1.5">
                      <h3 className="text-xl font-black text-foreground">🔥 שחקו בלי להפסיק</h3>
                    </div>
                    <p className="text-sm text-muted leading-relaxed">
                      סרקו משימות וצברו נקודות
                    </p>
                  </div>
                  <div className="mt-2 rounded-xl border border-primary bg-surface-elevated px-5 py-2 text-sm font-bold text-primary transition-all group-hover:bg-surface">
                    פתח ←
                  </div>
                </div>
              </div>
            </motion.button>

            <motion.button onClick={() => handleAction('display')} className="group relative text-right"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
              whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
              <div className="relative overflow-hidden rounded-3xl border-2 border-warning bg-surface p-8 shadow-card transition-shadow duration-300 group-hover:shadow-card-hover">
                <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: 'radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--color-warning) 8%, transparent), transparent 70%)' }} />
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-3xl border-2 border-warning/20"
                  animate={{ boxShadow: [
                    '0 0 0 0 color-mix(in srgb, var(--color-warning) 5%, transparent)',
                    '0 0 0 4px color-mix(in srgb, var(--color-warning) 12%, transparent)',
                    '0 0 0 0 color-mix(in srgb, var(--color-warning) 5%, transparent)',
                  ] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                />

                <div className="relative flex flex-col items-center gap-4 text-center">
                  <motion.div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border border-warning bg-surface-elevated"
                    animate={{ boxShadow: [
                      '0 0 0 0 color-mix(in srgb, var(--color-warning) 8%, transparent)',
                      '0 0 0 4px color-mix(in srgb, var(--color-warning) 15%, transparent)',
                      '0 0 0 0 color-mix(in srgb, var(--color-warning) 8%, transparent)',
                    ] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}>
                    <Trophy size={30} className="text-warning" />
                  </motion.div>
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-1.5">
                      <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>
                        <Crown size={16} className="text-warning" />
                      </motion.div>
                      <h3 className="text-xl font-black text-foreground">שיאנים בלייב</h3>
                    </div>
                    <p className="text-sm text-muted leading-relaxed">
                      צפו בדירוג המתעדכן בזמן אמת
                    </p>
                  </div>
                  <div className="mt-2 rounded-xl border border-warning bg-surface-elevated px-5 py-2 text-sm font-bold text-warning transition-all group-hover:bg-surface">
                    צפו בדירוג ←
                  </div>
                </div>
              </div>
            </motion.button>
          </div>

          {ready && (
            <motion.div className="mt-10 flex items-center justify-center gap-6 sm:gap-10"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
              {[
                { label: 'משתתפים', value: counts.participants },
                { label: 'משימות', value: counts.tasks },
                { label: 'סריקות', value: counts.transactions },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center">
                  <span className="text-2xl font-black text-foreground tabular-nums">{s.value.toLocaleString('he-IL')}</span>
                  <span className="text-[11px] text-muted">{s.label}</span>
                </div>
              ))}
            </motion.div>
          )}
        </main>
      </div>
    </div>
  )
}
