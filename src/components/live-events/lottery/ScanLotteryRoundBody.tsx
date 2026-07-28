import { RotateCcw, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScanLotteryRoundState } from '../useScanLotteryRound'
import { SETTINGS_INLINE_BUTTON } from './LotterySettingsBar'

interface ScanLotteryRoundBodyProps {
  scan: ScanLotteryRoundState
  /**
   * Whether the organizer has taken the stage for scanning in this visit to
   * the toggle. False until they press start, even when a round is already
   * collecting - see the note on the idle branch below.
   */
  started: boolean
  onOpen: () => void
  onClose: () => void
  onReset: () => void
}

/**
 * What "לפי משתתפים" needs after it is chosen: the collection window.
 *
 * It opens inside the "לפי משתתפים" segment, the way the points line opens
 * inside its own, and carries the three states that are the whole flow the
 * organizer runs:
 *
 *   idle    nothing collecting yet
 *   open    scanning on the stage above earns a ticket, one per participant
 *   closed  frozen; the draw runs on exactly what was collected
 *
 * It carries no numbers. The stage is already showing the room how many are in
 * at projector size, and the launch button carries the count the draw will run
 * on - a third copy inside a toggle is noise.
 *
 * The round is a row in the database, not state in this screen, so leaving the
 * tab does not stop collection.
 */
export function ScanLotteryRoundBody({
  scan,
  started,
  onOpen,
  onClose,
  onReset,
}: ScanLotteryRoundBodyProps) {
  const { status } = scan
  const isOpen = status === 'open'

  // Picking this toggle offers a button rather than dropping the organizer
  // straight into the scan takeover: switching to "לפי קבוצות" and back must
  // not slam the stage over to the scanner without a press. Starting on a
  // collection that is already open simply rejoins it.
  //
  // That guard is only about the takeover, so it applies only while there is
  // one to take over. A *closed* collection has no stage to seize and is the
  // pool about to be drawn from - hiding it behind "פתחו את ההגרלה" offered to
  // throw it away, which is the last thing to offer at that moment.
  if (status === 'idle' || (!started && isOpen)) {
    return (
      <>
        <button
          type="button"
          onClick={onOpen}
          className={cn(SETTINGS_INLINE_BUTTON, 'bg-primary text-white shadow-sm hover:opacity-95')}
        >
          {isOpen ? 'המשיכו לאסוף' : 'פתחו את ההגרלה'}
        </button>
      </>
    )
  }

  return (
    <>
      {/* No counts here. The stage above is showing the room how many are in,
          at projector size; repeating it in a dock tile is noise. */}
      <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-bold opacity-70">
        {isOpen && (
          <span
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-current motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        {isOpen ? 'אוספת' : 'נסגרה'}
      </span>

      {isOpen ? (
        <button
          type="button"
          onClick={onClose}
          className={cn(
            SETTINGS_INLINE_BUTTON,
            'border border-primary/35 bg-white text-primary shadow-sm',
          )}
        >
          <Square size={11} strokeWidth={3} fill="currentColor" aria-hidden="true" />
          סגרו
        </button>
      ) : (
        <button
          type="button"
          onClick={onReset}
          className={cn(
            SETTINGS_INLINE_BUTTON,
            'border border-transparent opacity-70 hover:bg-black/[0.05] hover:opacity-100',
          )}
          title="התחלת הגרלה חדשה - מי שנסרק להגרלה הזו לא ייכנס אליה"
        >
          <RotateCcw size={11} strokeWidth={2.75} aria-hidden="true" />
          הגרלה חדשה
        </button>
      )}
    </>
  )
}
