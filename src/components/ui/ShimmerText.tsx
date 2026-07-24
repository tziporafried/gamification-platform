import type { ReactNode } from 'react'

// `background-clip: text` paints color emoji as flat gradient blobs, so emoji runs
// are split out and rendered with their own fill (`.shimmer-emoji` in index.css).
const EMOJI_CHAR = '(?:\\p{Extended_Pictographic}|[\\u{1F1E6}-\\u{1F1FF}]|[#*0-9]\\u{FE0F}?\\u{20E3})'
const EMOJI_RUN = new RegExp(
  `(?:${EMOJI_CHAR}[\\u{FE0E}\\u{FE0F}\\u{1F3FB}-\\u{1F3FF}]*(?:\\u{200D}${EMOJI_CHAR}[\\u{FE0E}\\u{FE0F}\\u{1F3FB}-\\u{1F3FF}]*)*)+`,
  'gu',
)

export function ShimmerText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  EMOJI_RUN.lastIndex = 0
  for (let m = EMOJI_RUN.exec(text); m; m = EMOJI_RUN.exec(text)) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(<span key={m.index} className="shimmer-emoji">{m[0]}</span>)
    last = m.index + m[0].length
  }
  if (!parts.length) return <>{text}</>
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
