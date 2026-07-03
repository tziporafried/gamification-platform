import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Crown, ScanLine, Lock, Zap, Settings } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { ReadinessChecklist } from './ReadinessChecklist'
import { EventSummaryGrid } from './EventSummaryGrid'
import { ControlCenterBackground } from './ControlCenterBackground'
import { useEventHeaderBreadcrumb } from '@/hooks/useEventHeaderBreadcrumb'
import { calculateReadiness, isEventReady, getWizardPrefs } from '@/lib/wizard'
import { getLockedTemplate, clearLockedTemplate, completeTemplateImport, LOCKED_TEMPLATE_CHANGED } from '@/lib/lockedTemplate'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import type { Event, EventCounts, LockedTemplateStore } from '@/types'

interface ControlCenterProps {
  event: Event
  counts: EventCounts
}

export function ControlCenter({ event, counts }: ControlCenterProps) {
  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()
  const isFreePlan = !isSuperAdmin && event.plan === 'free'
  const [lockedTemplate, setLockedTemplate] = useState<LockedTemplateStore | null>(null)
  const [completing, setCompleting] = useState(false)
  const [settingsWarningOpen, setSettingsWarningOpen] = useState(false)
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

  function handleAction(route: string) {
    window.open(`/events/${event.id}/${route}`, '_blank', 'noopener,noreferrer')
  }

  function handleSettings() {
    if (event.status === 'active') {
      setSettingsWarningOpen(true)
      return
    }
    navigateToSettings()
  }

  function navigateToSettings() {
    navigate(`/events/${event.id}/step/${getWizardPrefs(event.id).lastStep}`)
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <ControlCenterBackground />
      <Modal
        isOpen={settingsWarningOpen}
        onClose={() => setSettingsWarningOpen(false)}
        title="שינוי הגדרות"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted leading-relaxed">
            שינוי הגדרות במשחק פעיל מצריך הדפסת ברקודים חדשים.
            האם להמשיך לעריכה?
          </p>
          <ModalActions className="pt-0">
            <Button onClick={() => { setSettingsWarningOpen(false); navigateToSettings() }}>
              המשך לעריכה
            </Button>
            <Button variant="outline" onClick={() => setSettingsWarningOpen(false)}>
              ביטול
            </Button>
          </ModalActions>
        </div>
      </Modal>

      <main className="relative z-10 mx-auto max-w-4xl px-4 py-10">
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

          <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ControlActionCard
              onClick={handleSettings}
              delay={0.3}
              dimmed
              title="הגדרות"
              description="לא מומלץ במהלך המשחק"
              cta="לעריכה ←"
              icon={
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-300 bg-neutral-100 shadow-sm">
                  <Settings size={32} className="text-neutral-500" strokeWidth={2.25} />
                </div>
              }
            />

            <ControlActionCard
              onClick={() => handleAction('kiosk')}
              delay={0.45}
              gradient="gradient-reward-legendary"
              title="🔥 שחקו בלי להפסיק"
              description="סרקו משימות וצברו נקודות"
              cta="פתח ←"
              decoration={
                <motion.div
                  className="pointer-events-none absolute left-6 right-6 z-10 h-[2px] bg-white/35"
                  animate={{ top: ['18%', '82%', '18%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
              }
              icon={
                <FloatingActionIcon delay={0.4} pulse>
                  <ScanLine size={32} className="text-white" strokeWidth={2.25} />
                </FloatingActionIcon>
              }
            />

            <ControlActionCard
              onClick={() => handleAction('display')}
              delay={0.55}
              gradient="gradient-reward-rich"
              title="שיאים"
              description="צפו בדירוג המתעדכן בזמן אמת"
              cta="צפו בדירוג ←"
              decoration={
                <motion.div
                  className="pointer-events-none absolute inset-3 rounded-[1.35rem] border border-white/20"
                  animate={{ boxShadow: [
                    '0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                    '0 0 0 6px color-mix(in srgb, white 14%, transparent)',
                    '0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                  ] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                />
              }
              icon={
                <FloatingActionIcon delay={0.8} pulse>
                  <div className="relative">
                    <Trophy size={32} className="text-white" strokeWidth={2.25} />
                    <motion.div
                      className="absolute -left-2 -top-2"
                      animate={{ rotate: [0, -12, 12, 0], y: [0, -3, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 2.5 }}
                    >
                      <Crown size={18} className="text-white/90" strokeWidth={2.25} />
                    </motion.div>
                  </div>
                </FloatingActionIcon>
              }
            />
          </div>

          {ready && (
            <motion.div className="mt-10 max-w-md mx-auto"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
              <EventSummaryGrid counts={counts} ready showScans animationKey={0} />
            </motion.div>
          )}
      </main>
    </div>
  )
}

interface ControlActionCardProps {
  onClick: () => void
  delay: number
  gradient?: string
  title: string
  description: string
  cta: string
  icon: ReactNode
  decoration?: ReactNode
  dimmed?: boolean
}

function ControlActionCard({
  onClick,
  delay,
  gradient,
  title,
  description,
  cta,
  icon,
  decoration,
  dimmed = false,
}: ControlActionCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group h-full w-full text-right"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{
        scale: dimmed ? 1.02 : 1.03,
        y: dimmed ? -2 : -4,
        transition: { duration: 0.1, ease: 'easeOut' },
      }}
      whileTap={{ scale: 0.98, transition: { duration: 0.08 } }}
    >
      <div
        className={cn(
          'relative h-full overflow-visible rounded-3xl transition-[box-shadow,border-color,transform] duration-100 ease-out',
          dimmed
            ? 'border border-dashed border-neutral-300 bg-neutral-200 shadow-card group-hover:border-neutral-400 group-hover:bg-neutral-100'
            : 'shadow-card group-hover:shadow-card-hover',
        )}
      >
        {!dimmed && gradient && (
          <div className={cn('absolute inset-0 overflow-hidden rounded-3xl', gradient)} />
        )}
        {!dimmed && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
            {decoration}
          </div>
        )}

        <div className="relative flex min-h-[300px] flex-col p-7">
          <div className="relative flex flex-1 flex-col items-center gap-5 overflow-visible pt-2 text-center">
            <div className="flex h-[5.5rem] items-center justify-center overflow-visible">
              {icon}
            </div>

            <div className="flex min-h-[4.75rem] flex-1 flex-col justify-center">
              <h3 className={cn('text-xl font-black', dimmed ? 'text-neutral-700' : 'text-white')}>{title}</h3>
              <p className={cn('mt-1.5 text-sm leading-relaxed', dimmed ? 'text-neutral-500' : 'text-white/80')}>
                {description}
              </p>
            </div>

            <div className="mt-auto w-full pt-1">
              <div
                className={cn(
                  'rounded-xl px-5 py-2.5 text-sm font-bold transition-colors duration-100',
                  dimmed
                    ? 'border border-neutral-300 bg-neutral-100 text-neutral-600 group-hover:bg-white'
                    : 'border border-white/25 bg-white/15 text-white group-hover:bg-white/25',
                )}
              >
                {cta}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  )
}

interface FloatingActionIconProps {
  children: ReactNode
  delay?: number
  duration?: number
  rotate?: boolean
  pulse?: boolean
}

function FloatingActionIcon({
  children,
  delay = 0,
  duration = 4.5,
  rotate = false,
  pulse = false,
}: FloatingActionIconProps) {
  return (
    <motion.div
      className="relative z-10"
      animate={{
        y: [0, -16, -8, -18, -4, 0],
        x: [0, 5, -4, 3, -2, 0],
        rotate: rotate ? [0, 0, 12, 12, -8, 0] : [0, -2, 1, -3, 2, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
    >
      <motion.div
        className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/25 bg-white/15 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-sm"
        animate={
          pulse
            ? {
                boxShadow: [
                  '0 10px 28px rgba(0,0,0,0.18), 0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                  '0 14px 32px rgba(0,0,0,0.22), 0 0 0 10px color-mix(in srgb, white 16%, transparent)',
                  '0 10px 28px rgba(0,0,0,0.18), 0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                ],
              }
            : undefined
        }
        transition={pulse ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } : undefined}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
