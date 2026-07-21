import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Crown, ScanLine, Pencil, Zap, Gift } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { ControlActionCard, FloatingActionIcon } from './ControlActionCard'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { ReadinessChecklist } from './ReadinessChecklist'
import { getControlCenterSummaryItems, LiveStatsCaption } from './EventSummaryGrid'
import { useControlCenterLiveStats } from '@/hooks/useControlCenterLiveStats'
import { EventPlayStatus, resolveEventPlayStatus } from '@/components/event/EventPlayStatus'
import { useEventHeaderBreadcrumb } from '@/hooks/useEventHeaderBreadcrumb'
import { useHeaderSlot } from '@/contexts/HeaderSlotContext'
import { usePlansModal } from '@/contexts/PlansModalContext'
import { calculateReadiness, isEventReady, getWizardPrefs, resolveGroupType } from '@/lib/wizard'
import { getLockedTemplate, completeTemplateImport, LOCKED_TEMPLATE_CHANGED } from '@/lib/lockedTemplate'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { trackEventEditStart, trackCtaClick, trackLiveEventsModalOpen } from '@/lib/analytics'
import { FloatingContactButton } from '@/components/layout/FloatingContactButton'
import { LiveEventsSelectModal, type LiveEventsOriginRect } from '@/components/live-events/LiveEventsSelectModal'
import type { Event, EventCounts } from '@/types'

interface ControlCenterProps {
  event: Event
  counts: EventCounts
}

export function ControlCenter({ event, counts }: ControlCenterProps) {
  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()
  const { setHeaderActivationCta } = useHeaderSlot()
  const { openPlans } = usePlansModal()
  const isTrial = !isSuperAdmin && event.plan === 'free'
  const [settingsWarningOpen, setSettingsWarningOpen] = useState(false)
  const [liveEventsOpen, setLiveEventsOpen] = useState(false)
  const [liveEventsOrigin, setLiveEventsOrigin] = useState<LiveEventsOriginRect | null>(null)
  const liveEventsCardRef = useRef<HTMLDivElement>(null)
  const activationCtaRef = useRef<HTMLButtonElement>(null)
  const scrollRootRef = useRef<HTMLDivElement>(null)
  const [primaryActivationInView, setPrimaryActivationInView] = useState(true)
  useEventHeaderBreadcrumb(event.name, undefined, event.plan, event.id)

  // On a paid plan, any premium template content that was locked while on the
  // free plan is imported automatically - no banner, no manual step. Safe to run
  // repeatedly: completeTemplateImport de-dupes by name and clears the store when
  // done (which re-fires LOCKED_TEMPLATE_CHANGED, but getLockedTemplate is then
  // null so it no-ops). On failure the store is left in place and retried on the
  // next mount.
  useEffect(() => {
    if (isTrial) return
    let importing = false
    async function importLocked() {
      if (importing || !getLockedTemplate(event.id)) return
      importing = true
      try {
        await completeTemplateImport(event.id)
      } catch {
        // leave the locked template in place; it will be retried later
      } finally {
        importing = false
      }
    }
    importLocked()
    window.addEventListener(LOCKED_TEMPLATE_CHANGED, importLocked)
    return () => window.removeEventListener(LOCKED_TEMPLATE_CHANGED, importLocked)
  }, [event.id, isTrial])

  const ready = isEventReady(event, counts)
  const checks = calculateReadiness(event, counts)
  const showPrimaryActivationCta = isTrial && ready

  const cardAnim = useMemo(() => ({
    kioskFloat: Math.random(),
    displayFloat: Math.random(),
    liveFloat: Math.random(),
    scanLine: -3 * Math.random(),
    /** Different border-glow tempos per card so they don't pulse in sync. */
    borderPulseKiosk: { duration: 2.4, delay: -2.4 * Math.random() },
    borderPulseDisplay: { duration: 3.2, delay: -3.2 * Math.random() },
    borderPulseLive: { duration: 2.8, delay: -2.8 * Math.random() },
    crown: -(2.2 + 2.5 * Math.random()),
    pulseGlow: -2.5 * Math.random(),
    statsInterval: 2600 + Math.random() * 900,
  }), [])

  const liveStats = useControlCenterLiveStats(event.id, true)

  const isGroupsMode = useMemo(
    () => resolveGroupType(event.id, counts) === 'custom',
    [event.id, counts],
  )

  const summaryItems = useMemo(
    () => getControlCenterSummaryItems(liveStats, {
      showActiveGroups: isGroupsMode,
      hasRewards: counts.rewards > 0,
    }),
    [liveStats, isGroupsMode, counts.rewards],
  )
  const playStatus = resolveEventPlayStatus(ready, liveStats.totalScans, { isTrial })

  function handleAction(route: string) {
    trackCtaClick({
      cta_name: route === 'kiosk' ? 'open_scanner' : 'open_leaderboard',
      cta_location: 'control_center',
      destination: `/events/${event.id}/${route}`,
    })
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
    trackEventEditStart(event.status === 'active')
    navigate(`/events/${event.id}/step/${getWizardPrefs(event.id).lastStep}`)
  }

  const handleChooseActivation = useCallback(() => {
    trackCtaClick({
      cta_name: 'view_activation_options',
      cta_location: 'control_center',
      destination: 'plans_modal',
    })
    openPlans({ eventId: event.id, source: 'game_home_trial' })
  }, [event.id, openPlans])

  useEffect(() => {
    if (!showPrimaryActivationCta) {
      setPrimaryActivationInView(true)
      return
    }

    const target = activationCtaRef.current
    const root = scrollRootRef.current
    if (!target || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setPrimaryActivationInView(entry.isIntersecting)
      },
      { threshold: 0, root },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [showPrimaryActivationCta])

  useEffect(() => {
    if (!showPrimaryActivationCta) {
      setHeaderActivationCta(null)
      return
    }

    setHeaderActivationCta({
      visible: !primaryActivationInView,
      onClick: handleChooseActivation,
    })
    return () => setHeaderActivationCta(null)
  }, [
    showPrimaryActivationCta,
    primaryActivationInView,
    handleChooseActivation,
    setHeaderActivationCta,
  ])

  return (
    <div ref={scrollRootRef} className="relative flex h-[calc(100vh-4rem)] flex-col overflow-y-auto">
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

      <LiveEventsSelectModal
        isOpen={liveEventsOpen}
        onClose={() => setLiveEventsOpen(false)}
        eventId={event.id}
        originRect={liveEventsOrigin}
      />

      <main
        className={cn(
          'relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col justify-start px-4 pt-1.5',
          ready && (counts.rewards === 0 || summaryItems.length > 0) ? 'pb-[4.5rem]' : 'pb-5',
        )}
      >
          <motion.div
            className="mb-3 flex shrink-0 flex-col items-center text-center sm:mb-3.5"
            initial={false}
          >
            {event.logo_url && (
              <img
                src={event.logo_url}
                alt={event.name}
                className="mb-2 h-14 w-14 rounded-2xl border border-border object-cover shadow-card"
              />
            )}

            {/* Title + status + edit - one centered info block */}
            <div className="flex max-w-full flex-col items-center">
              <h1
                className={cn(
                  'bg-[length:250%_100%] bg-clip-text text-2xl font-black text-transparent sm:text-3xl',
                  'animate-[shimmer_8s_ease-in-out_infinite] motion-reduce:animate-none',
                  '[background-image:linear-gradient(110deg,var(--color-foreground)_0%,var(--color-foreground)_38%,color-mix(in_srgb,var(--color-primary)_85%,white)_50%,var(--color-foreground)_62%,var(--color-foreground)_100%)]',
                )}
              >
                {event.name}
              </h1>

              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
                {!showPrimaryActivationCta && <EventPlayStatus status={playStatus} />}
                <button
                  type="button"
                  onClick={handleSettings}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-md',
                    'px-1.5 py-0.5 text-[11px] font-medium text-muted sm:text-xs',
                    'transition-[background-color,color] duration-150',
                    'hover:bg-white/40 hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  )}
                >
                  <Pencil size={12} strokeWidth={2} aria-hidden="true" />
                  עריכת משחק
                </button>
              </div>
            </div>

            {showPrimaryActivationCta ? (
              <div
                role="status"
                className="mt-1.5 w-full max-w-2xl overflow-hidden rounded-xl border border-primary/20 bg-[color-mix(in_srgb,var(--color-primary)_7%,var(--color-surface-elevated))] text-right shadow-sm"
              >
                <div className="flex flex-col gap-4 border-s-4 border-primary p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-4 sm:ps-5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-bold text-primary-text">✨ מצב התנסות</p>
                    <p className="text-base font-bold leading-snug text-foreground">
                      המשחק שלכם מוכן! 🎉
                    </p>
                    <p className="text-sm leading-relaxed text-foreground/85">
                      בצעו כמה סריקות ניסיון וצפו בתוצאות מתעדכנות בזמן אמת.
                    </p>
                    <p className="text-xs font-medium leading-relaxed text-foreground/65">
                      בהפעלת המשחק, סריקות הניסיון יאופסו כדי שתתחילו מאפס.
                    </p>
                  </div>
                  <Button
                    ref={activationCtaRef}
                    type="button"
                    variant="gradient"
                    size="md"
                    className="w-full shrink-0 font-semibold tracking-wide sm:w-auto sm:min-w-[11rem]"
                    onClick={handleChooseActivation}
                  >
                    הפעלת המשחק
                  </Button>
                </div>
              </div>
            ) : null}
          </motion.div>

          {!ready && (
            <div className="mb-4 shrink-0">
              <ReadinessChecklist checks={checks} eventId={event.id} />
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <div
              className="grid shrink-0 items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
            >
            <ControlActionCard
              onClick={() => handleAction('kiosk')}
              gradient="gradient-reward-legendary"
              title={isTrial ? 'נסו את המשחק 🎯' : '🔥 שחקו בלי להפסיק'}
              description={isTrial ? 'בצעו סריקות ניסיון וצפו בתוצאות בזמן אמת' : 'סרקו משימות וצברו נקודות'}
              cta="התחילו לסרוק ←"
              decoration={
                <>
                  <motion.div
                    className="pointer-events-none absolute inset-3 rounded-[1.35rem] border border-white/20"
                    animate={{ boxShadow: [
                      '0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                      '0 0 0 6px color-mix(in srgb, white 14%, transparent)',
                      '0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                    ] }}
                    transition={{
                      duration: cardAnim.borderPulseKiosk.duration,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: cardAnim.borderPulseKiosk.delay,
                    }}
                  />
                  <motion.div
                    className="pointer-events-none absolute left-6 right-6 z-10 h-[2px] bg-white/35"
                    animate={{ top: ['18%', '82%', '18%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: cardAnim.scanLine }}
                  />
                </>
              }
              icon={
                <FloatingActionIcon phase={cardAnim.kioskFloat} pulsePhase={cardAnim.pulseGlow} pulse>
                  <ScanLine size={32} className="text-white" strokeWidth={2.25} />
                </FloatingActionIcon>
              }
            />

            <ControlActionCard
              onClick={() => handleAction('display')}
              gradient="gradient-reward-rich"
              title="שיאים"
              description={isTrial ? 'צפו בתוצאות סריקות הניסיון' : 'צפו בדירוג המתעדכן בזמן אמת'}
              cta="הציגו לוח שיאים ←"
              decoration={
                <motion.div
                  className="pointer-events-none absolute inset-3 rounded-[1.35rem] border border-white/20"
                  animate={{ boxShadow: [
                    '0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                    '0 0 0 6px color-mix(in srgb, white 14%, transparent)',
                    '0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                  ] }}
                  transition={{
                    duration: cardAnim.borderPulseDisplay.duration,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: cardAnim.borderPulseDisplay.delay,
                  }}
                />
              }
              icon={
                <FloatingActionIcon phase={cardAnim.displayFloat} pulsePhase={cardAnim.pulseGlow} pulse>
                  <div className="relative">
                    <Trophy size={32} className="text-white" strokeWidth={2.25} />
                    <motion.div
                      className="absolute -left-2 -top-2"
                      animate={{ rotate: [0, -12, 12, 0], y: [0, -3, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 2.5, delay: cardAnim.crown }}
                    >
                      <Crown size={18} className="text-white/90" strokeWidth={2.25} />
                    </motion.div>
                  </div>
                </FloatingActionIcon>
              }
            />

            <ControlActionCard
              onClick={() => {
                const rect = liveEventsCardRef.current?.getBoundingClientRect()
                if (rect) {
                  setLiveEventsOrigin({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                  })
                } else {
                  setLiveEventsOrigin(null)
                }
                trackCtaClick({
                  cta_name: 'open_live_events',
                  cta_location: 'control_center',
                  destination: 'live_events_modal',
                })
                trackLiveEventsModalOpen(event.id)
                setLiveEventsOpen(true)
              }}
              surfaceRef={liveEventsCardRef}
              surfaceHidden={liveEventsOpen}
              gradient="gradient-reward-medium"
              title="הפעלות בזמן אמת"
              description="הפעילו הגרלות, בונוסים ואירועים מיוחדים במהלך המשחק."
              cta="בחרו הפעלה ←"
              decoration={
                <motion.div
                  className="pointer-events-none absolute inset-3 rounded-[1.35rem] border border-white/20"
                  animate={{ boxShadow: [
                    '0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                    '0 0 0 6px color-mix(in srgb, white 14%, transparent)',
                    '0 0 0 0 color-mix(in srgb, white 0%, transparent)',
                  ] }}
                  transition={{
                    duration: cardAnim.borderPulseLive.duration,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: cardAnim.borderPulseLive.delay,
                  }}
                />
              }
              icon={
                <FloatingActionIcon phase={cardAnim.liveFloat} pulsePhase={cardAnim.pulseGlow} pulse>
                  <Zap size={32} className="text-white" strokeWidth={2.25} />
                </FloatingActionIcon>
              }
            />
            </div>
          </div>

          {ready && counts.rewards === 0 ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-4">
              <div
                role="status"
                aria-live="polite"
                className={cn(
                  'flex w-full max-w-sm items-center gap-2',
                  'rounded-lg border border-border/30 bg-white/35 px-3 py-1.5',
                  'shadow-[0_4px_18px_rgba(46,34,30,0.06)] backdrop-blur-md',
                )}
              >
                <Gift
                  size={13}
                  strokeWidth={2}
                  className="shrink-0 text-warning-text/80"
                  aria-hidden="true"
                />
                <p className="min-w-0 flex-1 text-center text-xs font-medium leading-snug text-foreground/75">
                  עדיין לא נוצרו פרסים
                </p>
              </div>
            </div>
          ) : (
            ready &&
            summaryItems.length > 0 && (
              <LiveStatsCaption
                items={summaryItems}
                ready={ready}
                intervalMs={cardAnim.statsInterval}
              />
            )
          )}
      </main>
      {isTrial && (
        <FloatingContactButton
          variant="compact"
          location="control"
          eventId={event.id}
          eventName={event.name}
          labelMode="question"
        />
      )}
    </div>
  )
}
