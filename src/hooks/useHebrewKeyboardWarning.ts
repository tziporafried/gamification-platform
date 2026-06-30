import { useState, useEffect, useCallback, useRef } from 'react'
import {
  detectKeyboardLayout,
  layoutHintFromKeyEvent,
  looksLikeHebrewLayoutScan,
} from '@/lib/keyboardLayout'

const PIN_MS = 60_000
const SCANNER_INPUT_LABEL = 'קלט סורק QR'

export function useHebrewKeyboardWarning(enabled: boolean) {
  const [showWarning, setShowWarning] = useState(false)
  const pinnedUntilRef = useRef(0)
  const showWarningRef = useRef(false)

  showWarningRef.current = showWarning

  const pinWarning = useCallback(() => {
    setShowWarning(true)
    pinnedUntilRef.current = Date.now() + PIN_MS
  }, [])

  const flagHebrewInText = useCallback((text: string) => {
    if (looksLikeHebrewLayoutScan(text)) pinWarning()
  }, [pinWarning])

  const onScanStart = useCallback(() => {
    if (!showWarningRef.current) return
    pinnedUntilRef.current = 0
    setShowWarning(false)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setShowWarning(false)
      pinnedUntilRef.current = 0
      return
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof HTMLElement && target.getAttribute('aria-label') === SCANNER_INPUT_LABEL) {
        return
      }
      const hint = layoutHintFromKeyEvent(e)
      if (hint === 'hebrew') pinWarning()
      else if (hint === 'english' && Date.now() >= pinnedUntilRef.current) setShowWarning(false)
    }
    window.addEventListener('keydown', onKeyDown, true)

    void detectKeyboardLayout().then((layout) => {
      if (layout === 'hebrew') pinWarning()
      else if (layout === 'english') setShowWarning(false)
    })

    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [enabled, pinWarning])

  return { showWarning, flagHebrewInText, onScanStart }
}
