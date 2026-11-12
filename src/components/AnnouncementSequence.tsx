import { useEffect, useState } from 'react'
import { FlashAnnouncementModal, flashAnnouncementSeen } from '@/components/FlashAnnouncementModal'
import { LotteryAnnouncementModal, lotteryAnnouncementSeen } from '@/components/LotteryAnnouncementModal'
import { TriviaAnnouncementModal, triviaAnnouncementSeen } from '@/components/TriviaAnnouncementModal'

/**
 * The "חדש ב-Gamify" announcements, one after the other.
 *
 * Newest first: the flash challenge opens, then trivia once it is closed, then
 * the lottery. Each closed one hands over to the next one not yet seen. After
 * all of them, only the flash challenge's bubble stays in the corner - several
 * bubbles would sit on top of each other.
 *
 * Each announcement keeps its own "seen" flag in localStorage, so somebody who
 * already closed the lottery last summer gets only the newer ones.
 */
type Announcement = 'flash' | 'trivia' | 'lottery'
type Stage = 'pending' | 'gap' | 'done' | Announcement

/** Newest first. */
const ORDER: { id: Announcement; seen: () => boolean }[] = [
  { id: 'flash', seen: flashAnnouncementSeen },
  { id: 'trivia', seen: triviaAnnouncementSeen },
  { id: 'lottery', seen: lotteryAnnouncementSeen },
]

// A beat between two dialogs, so the next does not snap in as one leaves.
const GAP_MS = 700

function nextUnseen(): Announcement | null {
  return ORDER.find((a) => !a.seen())?.id ?? null
}

export function AnnouncementSequence() {
  const [stage, setStage] = useState<Stage>('pending')

  useEffect(() => {
    setStage(nextUnseen() ?? 'done')
  }, [])

  useEffect(() => {
    if (stage !== 'gap') return
    const timer = window.setTimeout(() => setStage(nextUnseen() ?? 'done'), GAP_MS)
    return () => window.clearTimeout(timer)
  }, [stage])

  // Closing an announcement marks it seen, so the next unseen one (if any)
  // follows after a beat. Reopening one from the bubble later does the same.
  const advance = () => setStage(nextUnseen() ? 'gap' : 'done')

  if (stage === 'pending' || stage === 'gap') return null
  if (stage === 'trivia') return <TriviaAnnouncementModal onCollapse={advance} />
  if (stage === 'lottery') return <LotteryAnnouncementModal onCollapse={advance} />
  // 'flash', and 'done' - whose bubble is the newest announcement's.
  return <FlashAnnouncementModal onCollapse={stage === 'flash' ? advance : undefined} />
}
