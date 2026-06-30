const HEBREW_RE = /[\u0590-\u05FF]/

interface NavigatorWithKeyboard extends Navigator {
  keyboard?: { getLayoutMap(): Promise<Map<string, string>> }
}

export function containsHebrew(text: string): boolean {
  return HEBREW_RE.test(text)
}

/** JSON QR should start with `{` — Hebrew layout scrambles braces and letters. */
export function looksLikeHebrewLayoutScan(text: string): boolean {
  if (containsHebrew(text)) return true
  const t = text.trim()
  if (!t) return false
  if (t.startsWith(']') || t.startsWith('[')) return true
  if (t.startsWith('}"') || t.endsWith('"{')) return true
  if (t.startsWith("'") && !t.startsWith('{"')) return true
  return false
}

export type KeyboardLayout = 'english' | 'hebrew' | 'unknown'

export function layoutHintFromKeyEvent(e: KeyboardEvent): KeyboardLayout {
  if (e.key.length === 1 && HEBREW_RE.test(e.key)) return 'hebrew'

  if (e.code === 'KeyQ') {
    if (e.key === 'q' || e.key === 'Q') return 'english'
    if (e.key === '/') return 'hebrew'
  }

  if (e.code === 'BracketLeft') {
    if (e.key === '{' || e.key === '[') return 'english'
    if (e.key === ']' || e.key === '}') return 'hebrew'
  }

  if (e.code === 'Quote' && e.key === '"') return 'english'

  return 'unknown'
}

/** Best-effort layout detection — reliable in Chromium; unknown in Safari/Firefox. */
export async function detectKeyboardLayout(): Promise<KeyboardLayout> {
  try {
    const keyboard = (navigator as NavigatorWithKeyboard).keyboard
    if (!keyboard?.getLayoutMap) return 'unknown'

    const map = await keyboard.getLayoutMap()
    const q = map.get('KeyQ')
    const bracketLeft = map.get('BracketLeft')

    if (q === '/') return 'hebrew'
    if (bracketLeft === ']') return 'hebrew'

    if ((q === 'q' || q === 'Q') && bracketLeft === '[') return 'english'

    return 'unknown'
  } catch {
    return 'unknown'
  }
}
