import { useCallback, useEffect, useRef } from 'react'

export const LOTTERY_INTRO_SOUND_SRC = '/sounds/lottery-intro.mp3'
export const LOTTERY_DRAW_SOUND_SRC = '/sounds/lottery-draw.mp3'

type Track = 'intro' | 'draw'

/**
 * Two-track lottery soundtrack:
 * - intro: settings reveal (eligibility, prize, …)
 * - draw: name cloud / elimination (starts when intro ends)
 */
export function useLotteryPresentationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackRef = useRef<Track | null>(null)

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.onended = null
    audio.pause()
    audio.currentTime = 0
    audioRef.current = null
    trackRef.current = null
  }, [])

  useEffect(() => () => stop(), [stop])

  const play = useCallback(
    (track: Track, options?: { onEnded?: () => void; volume?: number; loop?: boolean }) => {
      try {
        stop()
        const src = track === 'intro' ? LOTTERY_INTRO_SOUND_SRC : LOTTERY_DRAW_SOUND_SRC
        const audio = new Audio(src)
        audio.volume = options?.volume ?? 0.85
        audio.loop = options?.loop ?? false
        trackRef.current = track
        audioRef.current = audio
        if (options?.onEnded) {
          audio.onended = () => {
            options.onEnded?.()
          }
        }
        void audio.play().catch(() => {
          // Autoplay blocked — still advance via onEnded fallback from caller if needed.
          options?.onEnded?.()
        })
      } catch {
        options?.onEnded?.()
      }
    },
    [stop],
  )

  return { play, stop }
}
