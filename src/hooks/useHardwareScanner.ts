import { useEffect, useRef, useCallback } from 'react'

const TERMINATORS = new Set(['Enter', 'Tab', 'NumpadEnter'])
/** Wait after last character — scanners type fast; Enter (CR+LF) commits immediately. */
const IDLE_MS = 100

function isOtherField(el: Element | null, scanInput: HTMLInputElement): boolean {
  if (!(el instanceof HTMLElement) || el === scanInput) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function useHardwareScanner(
  enabled: boolean,
  onScan: (raw: string) => void,
  onScanStart?: () => void,
) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const onScanRef = useRef(onScan)
  const onScanStartRef = useRef(onScanStart)
  const idleRef = useRef<ReturnType<typeof setTimeout>>()
  const detachRef = useRef<(() => void) | null>(null)
  const scanningRef = useRef(false)

  onScanRef.current = onScan
  onScanStartRef.current = onScanStart

  const commit = useCallback((input: HTMLInputElement) => {
    clearTimeout(idleRef.current)
    const raw = input.value.trim()
    input.value = ''
    scanningRef.current = false
    if (raw) onScanRef.current(raw)
  }, [])

  const bind = useCallback((input: HTMLInputElement | null) => {
    detachRef.current?.()
    detachRef.current = null
    inputRef.current = input
    if (!input || !enabled) return

    const onInput = () => {
      if (!scanningRef.current && input.value.length > 0) {
        scanningRef.current = true
        onScanStartRef.current?.()
      }

      // CR+LF from scanner may arrive as characters in the value, not as Enter keydown
      if (/[\r\n]/.test(input.value)) {
        input.value = input.value.replace(/[\r\n]+/g, '')
        clearTimeout(idleRef.current)
        commit(input)
        return
      }

      clearTimeout(idleRef.current)
      idleRef.current = setTimeout(() => commit(input), IDLE_MS)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target !== input || !TERMINATORS.has(e.key)) return
      if (!input.value.trim()) return
      e.preventDefault()
      commit(input)
    }

    input.addEventListener('input', onInput)
    input.addEventListener('keydown', onKeyDown)
    input.focus({ preventScroll: true })

    detachRef.current = () => {
      input.removeEventListener('input', onInput)
      input.removeEventListener('keydown', onKeyDown)
    }
  }, [enabled, commit])

  useEffect(() => {
    bind(inputRef.current)
    return () => {
      detachRef.current?.()
      clearTimeout(idleRef.current)
    }
  }, [enabled, bind])

  useEffect(() => {
    if (!enabled) return
    const refocus = setInterval(() => {
      const input = inputRef.current
      if (input && !isOtherField(document.activeElement, input)) {
        input.focus({ preventScroll: true })
      }
    }, 600)
    return () => clearInterval(refocus)
  }, [enabled])

  return bind
}
