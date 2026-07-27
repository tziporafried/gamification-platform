import { useEffect, useMemo, useState } from 'react'
import {
  trackLotteryEligibilitySet,
  trackLotteryLaunchBlocked,
  trackLotteryLaunched,
  trackLotteryPrizeConfirmed,
  trackLotteryRoundClosed,
  trackLotteryRoundOpened,
  trackLotterySetupView,
} from '@/lib/analytics'
import { useLotteryPresentationSound } from '@/hooks/useLotteryPresentationSound'
import {
  type EligibleParticipant,
  type LotteryConfig,
  type LotteryEligibilityMode,
} from '../types'
import { useLotteryEntries, type LotteryLaunchBlocker } from '../useLotteryEntries'
import type { EligibilityCriteria } from './lotteryEligibility'
import { LotteryBroadcastLayout } from './LotteryBroadcastLayout'
import { LotteryLaunchButton } from './LotteryLaunchButton'
import { LotteryPoolControl } from './LotteryPoolControl'
import { LotteryPreparingStage } from './LotteryPreparingStage'
import { LotteryPrizeControl } from './LotteryPrizeControl'
import { LotterySettingsBar } from './LotterySettingsBar'
import { ScanLotteryCollectingStage } from './ScanLotteryCollectingStage'
import { useLotteryScanner } from './useLotteryScanner'
import {
  DEFAULT_ELIGIBILITY_MODE,
  ELIGIBILITY_LABELS,
  availableEligibilityModes,
  modeForEligibility,
  poolCountLabel,
  resolveEligibilityMode,
} from './lotteryMode'

interface LotteryConfigurationCardProps {
  eventId: string
  /**
   * Whether the `scan_based_lottery` flag is on for this game - i.e. whether
   * "לפי משתתפים" joins the row of eligibility toggles. It is never a
   * replacement: the other three choices are all still there, and the dock
   * still opens on "כולם".
   */
  scanLotteryAvailable: boolean
  /**
   * Whether cards may be scanned from this screen: the game has started and
   * the plan includes scanning. Both are the kiosk's existing gates, checked
   * there too - scanning here is the same act, so it carries the same rules.
   */
  scanningAllowed: boolean
  /** Shown on the stage when scanning is not allowed, instead of a dead scanner. */
  scanningBlockedReason?: string
  /** Start the audience presentation in this same broadcast tab. */
  onLaunch: (payload: {
    config: LotteryConfig
    participants: EligibleParticipant[]
  }) => void
}

/** Stands in for the recount when there is no round to recount. */
function noop() {}

/** What the launch button says it is waiting for. */
const BLOCKER_HINTS: Record<LotteryLaunchBlocker, string> = {
  no_eligible: 'אין זכאים להגרלה',
  nothing_picked: 'בחרו מי משתתף בהגרלה',
  not_opened: 'פתחו את ההגרלה כדי לאסוף כרטיסים',
  still_open: 'סגרו את ההגרלה כדי להגריל',
}

const BLOCKER_ERRORS: Record<LotteryLaunchBlocker, string> = {
  no_eligible: 'עדיין אין משתתפים בהגרלה',
  nothing_picked: 'עדיין לא בחרתם מי משתתף',
  not_opened: 'ההגרלה עדיין לא נפתחה',
  still_open: 'סגרו את ההגרלה לפני שמגרילים',
}

/**
 * Setup state for the lottery broadcast window:
 * preparing stage (audience) + the settings bar.
 *
 * The bar reads left to right as the decision itself: what is being given
 * away, who can win it, and the button that starts it. Only the middle
 * section has anything to decide - everything after the pool is shared, one
 * launch button and one set of validations for all four choices. How the bar
 * holds still while those choices change is LotterySettingsBar's job; which
 * pool a choice produces is useLotteryEntries'.
 */
export function LotteryConfigurationCard({
  eventId,
  scanLotteryAvailable,
  scanningAllowed,
  scanningBlockedReason,
  onLaunch,
}: LotteryConfigurationCardProps) {
  const { playReadySting, playUiClick } = useLotteryPresentationSound()

  const modes = useMemo(
    () => availableEligibilityModes(scanLotteryAvailable),
    [scanLotteryAvailable],
  )
  const [eligibilityMode, setEligibilityMode] =
    useState<LotteryEligibilityMode>(DEFAULT_ELIGIBILITY_MODE)
  const [minPoints, setMinPoints] = useState(50)
  const [groupIds, setGroupIds] = useState<ReadonlySet<string>>(() => new Set())
  const [prizeName, setPrizeName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [editingPrize, setEditingPrize] = useState(true)
  /**
   * Whether the organizer has pressed start for scanning in this visit to the
   * toggle. Entering "לפי משתתפים" always offers the button first - a round
   * left collecting must not seize the stage the moment the toggle is picked,
   * which is what made switching to groups and back jump straight into the
   * scanner.
   */
  const [startedScanning, setStartedScanning] = useState(false)

  // A flag withdrawn mid-session (or a choice this game cannot make) falls back
  // to "כולם" rather than leaving the dock on a toggle it may not offer.
  const activeMode = resolveEligibilityMode(eligibilityMode, scanLotteryAvailable)

  const criteria = useMemo<EligibilityCriteria>(
    () => ({ mode: activeMode, minPoints, groupIds }),
    [activeMode, minPoints, groupIds],
  )

  const pool = useLotteryEntries({ eventId, criteria })
  const { participants, loading, error, blockedBy, scan } = pool

  const trimmedPrize = prizeName.trim()

  // Leaving the toggle puts the start button back, so returning to it asks
  // again rather than resuming the takeover on its own.
  useEffect(() => {
    if (activeMode !== 'scans') setStartedScanning(false)
  }, [activeMode])

  // Live only once the organizer has started *and* a round is collecting. A
  // closed round, any other choice, or a game that may not scan all leave the
  // scanner unbound, so nothing is listening for cards when nothing could be
  // done with them.
  const collecting = startedScanning && scan?.status === 'open'
  const scanner = useLotteryScanner({
    eventId,
    collecting: !!collecting,
    enabled: !!collecting && scanningAllowed,
    onScored: scan?.recount ?? noop,
  })

  useEffect(() => {
    trackLotterySetupView(eventId, DEFAULT_ELIGIBILITY_MODE, scanLotteryAvailable)
  }, [eventId, scanLotteryAvailable])

  function handleModeChange(next: LotteryEligibilityMode) {
    if (next === activeMode) return
    playUiClick()
    setFormError(null)
    setEligibilityMode(next)
    // Choosing by scans hands the keyboard to the scanner later, when the
    // round opens; the picker modes need the focus free for their own panel.
    trackLotteryEligibilitySet({
      eventId,
      mode: next,
      minPoints: next === 'min_points' ? minPoints : undefined,
    })
  }

  function commitPrize() {
    if (!prizeName.trim()) return
    setEditingPrize(false)
    trackLotteryPrizeConfirmed(eventId)
  }

  function handleOpenRound() {
    if (!scan) return
    playUiClick()
    setFormError(null)
    // Hand the keyboard to the scanner. The wedge binding deliberately yields
    // to any other focused field, and the prize input focuses itself on mount
    // - so starting while it still holds focus would leave the stage listening
    // and every card landing silently in the prize box. Blurring also commits
    // a prize that was typed but never confirmed.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setStartedScanning(true)
    // A collection already open is rejoined rather than replaced, so a refresh
    // mid-lottery does not throw away who is already in.
    if (scan.status === 'open') return
    trackLotteryRoundOpened(eventId)
    scan.open()
  }

  function handleCloseRound() {
    if (!scan) return
    playUiClick()
    // The counts as the organizer saw them when they decided to stop. A scan
    // landing in the same instant is counted by the draw but not by this
    // event, which is the honest reading of "what was on screen".
    trackLotteryRoundClosed({ eventId, entries: scan.entries, participants: scan.count })
    scan.close()
  }

  function handleResetRound() {
    if (!scan) return
    playUiClick()
    setFormError(null)
    scan.reset()
  }

  /**
   * What the intro card will tell the audience. Written here because this is
   * the only place that knows the names behind the picked ids - "בוגרים,
   * מתחילים" means something to the room that "2 קבוצות" does not.
   */
  function buildPoolLabel(): string | undefined {
    if (activeMode === 'groups') {
      const names = pool.groups.filter((g) => groupIds.has(g.id)).map((g) => g.name)
      if (names.length === 0) return undefined
      // Past a few names the list stops being readable from the back of a
      // room, so it becomes a count instead.
      return names.length <= 3 ? names.join(' · ') : `${names.length.toLocaleString('he-IL')} קבוצות`
    }
    return undefined
  }

  function buildConfig(): LotteryConfig | null {
    setFormError(null)
    if (!trimmedPrize) {
      setFormError('חסר שם לפרס')
      setEditingPrize(true)
      trackLotteryLaunchBlocked({ eventId, reason: 'missing_prize' })
      return null
    }
    if (blockedBy) {
      setFormError(BLOCKER_ERRORS[blockedBy])
      trackLotteryLaunchBlocked({ eventId, reason: blockedBy })
      return null
    }
    return {
      kind: 'lottery',
      eventId,
      mode: modeForEligibility(activeMode),
      // Which window the tickets were counted from, so a run can be traced
      // back to its round. Undefined for every other choice - there is no window.
      roundId: scan?.round?.id,
      eligibilityMode: activeMode,
      minPoints: activeMode === 'min_points' ? minPoints : 0,
      groupIds: activeMode === 'groups' ? [...groupIds] : undefined,
      poolLabel: buildPoolLabel(),
      prizeName: trimmedPrize,
      prizeIcon: '🎁',
    }
  }

  function launchLottery() {
    const config = buildConfig()
    if (!config) return

    playUiClick()
    playReadySting()
    trackLotteryLaunched({
      eventId,
      lotteryMode: modeForEligibility(activeMode),
      eligibilityMode: activeMode,
      minPoints: config.minPoints,
      eligibleCount: participants.length,
      entryCount: pool.entries,
    })
    onLaunch({ config, participants })
  }

  return (
    <LotteryBroadcastLayout
      stage={
        collecting && scan ? (
          <ScanLotteryCollectingStage
            scanner={scanner}
            participants={scan.count}
            scanningAllowed={scanningAllowed}
            blockedReason={scanningBlockedReason}
          />
        ) : (
          <LotteryPreparingStage />
        )
      }
      dock={
        <div className="relative w-full">
          <LotterySettingsBar>
            <LotteryPrizeControl
              value={prizeName}
              onChange={setPrizeName}
              onCommit={commitPrize}
              editing={editingPrize}
              onEdit={() => setEditingPrize(true)}
            />

            <LotteryPoolControl
              mode={activeMode}
            modes={modes}
            onModeChange={handleModeChange}
            minPoints={minPoints}
            onMinPointsChange={setMinPoints}
            groupIds={groupIds}
            onGroupIdsChange={setGroupIds}
            groups={pool.groups}
            optionsLoading={pool.optionsLoading}
            scan={scan}
            startedScanning={startedScanning}
            onOpenRound={handleOpenRound}
            onCloseRound={handleCloseRound}
            onResetRound={handleResetRound}
          />

            <LotteryLaunchButton
              onClick={launchLottery}
              disabled={loading || blockedBy != null}
              loading={loading}
              countLabel={poolCountLabel(modeForEligibility(activeMode), participants)}
            title={!loading && blockedBy ? BLOCKER_HINTS[blockedBy] : undefined}
            />
          </LotterySettingsBar>

          {/* Absolutely placed, so an error never pushes the bar around - the
              one thing the whole layout is built to avoid. */}
          {(formError || error) && (
            <p
              role="alert"
              className="absolute -top-5 start-0 text-[13px] font-bold text-danger-text"
            >
              {formError || error}
            </p>
          )}
        </div>
      }
    />
  )
}

/** Re-exported for the dock's own labels. */
export { ELIGIBILITY_LABELS }
