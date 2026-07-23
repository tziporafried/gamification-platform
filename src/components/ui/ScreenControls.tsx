import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { toggleSoundMuted, useSoundMuted, type SoundScope } from '@/lib/soundMuted'

/**
 * Shared look for the fullscreen-screen controls (back / fullscreen / sound):
 * a neutral glass pill - premium and easy to find, quiet enough not to compete
 * with the page title or main animation. Appearance only; callers add their own
 * sizing/padding and positioning.
 */
export const screenControlClass =
  'cursor-pointer rounded-md bg-white/85 text-neutral-700 backdrop-blur-md ring-1 ring-black/5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.22)] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_6px_18px_-5px_rgba(0,0,0,0.3)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0'

const iconButtonClass = cn(screenControlClass, 'flex items-center justify-center p-1.5')

interface ScreenControlsProps {
  /**
   * Where "back" leads. The fullscreen screens (scanner / lottery /
   * leaderboard) all return to the event's control center; offline that route
   * has no match and falls through to the hub, so the same target works there.
   * Omit to fall back to the browser's history.
   */
  to?: string
  /** Overrides back navigation entirely - e.g. to clean up session state first. */
  onBack?: () => void
  /** Which screen's independent sound mute the speaker toggles. */
  soundScope: SoundScope
  label?: string
  className?: string
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen()
    }
  } catch {
    // Fullscreen can be blocked by browser policy; the screen still works.
  }
}

/**
 * Top-right control cluster for the fullscreen presentation screens.
 *
 * These used to open in their own browser tab; they now navigate inside the
 * existing tab, so each needs an explicit way out plus the presentation
 * controls (fullscreen, sound). Sits top-right - the natural corner in this RTL
 * (Hebrew) UI - laid out right-to-left as: back, then fullscreen, then sound.
 *
 * The back pill forces its arrow to the left of the label (dir="ltr") so it
 * reads "→ חזרה", the arrow pointing the way the eye travels back. Fullscreen
 * and sound are self-contained: fullscreen drives the document element, and the
 * speaker toggles the app-wide mute that every screen's audio honours.
 */
export function ScreenControls({ to, onBack, soundScope, label = 'חזרה', className }: ScreenControlsProps) {
  const navigate = useNavigate()
  const muted = useSoundMuted(soundScope)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  return (
    <div dir="rtl" className={cn('fixed right-2.5 top-2.5 z-[300] flex items-center gap-2', className)}>
      <button
        type="button"
        dir="ltr"
        onClick={() => (onBack ? onBack() : to ? navigate(to) : navigate(-1))}
        aria-label={label}
        className={cn(screenControlClass, 'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold')}
      >
        <ArrowRight size={14} strokeWidth={2.25} className="text-neutral-400" aria-hidden="true" />
        <span>{label}</span>
      </button>

      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={fullscreen ? 'יציאה ממסך מלא' : 'מסך מלא'}
        title={fullscreen ? 'יציאה ממסך מלא' : 'מסך מלא'}
        className={iconButtonClass}
      >
        {fullscreen ? (
          <Minimize2 size={15} strokeWidth={2.25} aria-hidden="true" />
        ) : (
          <Maximize2 size={15} strokeWidth={2.25} aria-hidden="true" />
        )}
      </button>

      <button
        type="button"
        onClick={() => toggleSoundMuted(soundScope)}
        aria-label={muted ? 'הפעלת סאונד' : 'השתקת סאונד'}
        title={muted ? 'הפעלת סאונד' : 'השתקת סאונד'}
        className={iconButtonClass}
      >
        {muted ? (
          <VolumeX size={15} strokeWidth={2.25} aria-hidden="true" />
        ) : (
          <Volume2 size={15} strokeWidth={2.25} aria-hidden="true" />
        )}
      </button>

      <div id={EXTRA_SLOT_ID} className="flex items-center gap-2" />
    </div>
  )
}

const EXTRA_SLOT_ID = 'screen-controls-extra'

/**
 * Adds screen-specific controls (e.g. the ceremony's replay / pause) to the end
 * of the toolbar row - right after the sound toggle - from anywhere in the tree.
 *
 * The presentation screens scale their whole stage inside a transformed box, so
 * controls rendered there would shrink with it; portalling into the toolbar
 * keeps them viewport-sized and in one row with back / fullscreen / sound.
 * Style children with {@link screenControlClass} so they match.
 */
export function ScreenControlsExtra({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  // The slot lives in a sibling <ScreenControls>; both are in the DOM by the
  // time effects run, so a single lookup on mount is enough.
  useEffect(() => setSlot(document.getElementById(EXTRA_SLOT_ID)), [])

  return slot ? createPortal(children, slot) : null
}
