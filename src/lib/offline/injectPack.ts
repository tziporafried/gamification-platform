import type { GamePack } from './types'

/** Marker in offline.html whose contents the exporter replaces with the pack. */
const DATA_TAG_RE =
  /(<script id="game-data" type="application\/json">)([\s\S]*?)(<\/script>)/

export class OfflineExportError extends Error {}

/**
 * Serializes a pack into the player template, escaping so no value can break out
 * of the <script> tag it lives in. Pure and unit-tested; exportGame.ts wraps it
 * with the Vite-only template import and the browser download.
 */
export function injectPack(template: string, pack: GamePack): string {
  if (!template) {
    throw new OfflineExportError('קובץ הנגן טרם נבנה. הרץ npm run build:offline.')
  }
  if (!DATA_TAG_RE.test(template)) {
    throw new OfflineExportError('תבנית הנגן פגומה — לא נמצא מיקום להטמעת הנתונים.')
  }

  const json = JSON.stringify(pack).replace(/[<>\u2028\u2029]/g, (ch) => {
    // < and > guard against a literal </script> or <!-- inside a value.
    // U+2028/U+2029 are valid JSON but illegal as raw JS string line terminators.
    return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
  })

  // Function replacement: JSON is full of `$`, which a string replacement would
  // treat as a capture reference.
  return template.replace(DATA_TAG_RE, (_m, open, _old, close) => `${open}${json}${close}`)
}

/** Turns a name into a safe, readable file stem. */
export function slugifyFileName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-')
  return cleaned || 'game'
}
