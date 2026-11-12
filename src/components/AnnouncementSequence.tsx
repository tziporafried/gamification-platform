import { useEffect, useState } from 'react'
import { LotteryAnnouncementModal, lotteryAnnouncementSeen } from '@/components/LotteryAnnouncementModal'
import { TriviaAnnouncementModal, triviaAnnouncementSeen } from '@/components/TriviaAnnouncementModal'

/**
 * The "חדש ב-Gamify" announcements, one after the other.
 *
 * Newest first: trivia opens, and once it is closed the lottery opens in its
 * place. After both have been seen, only the trivia bubble stays in the corner -
 * two bubbles would sit on top of each other.
 *
 * Each announcement keeps its own "seen" flag in localStorage, so somebody who
 * already closed the lottery last summer gets only the trivia one.
 */
type Stage = 'pending' | 'trivia' | 'gap' | 'lottery' | 'done'

// A beat between the two dialogs, so the second does not snap in as the first
// leaves.
const GAP_MS = 700

export function AnnouncementSequence() {
  const [stage, setStage] = useState<Stage>('pending')

  useEffect(() => {
    if (!triviaAnnouncementSeen()) setStage('trivia')
    else if (!lotteryAnnouncementSeen()) setStage('lottery')
    else setStage('done')
  }, [])

  useEffect(() => {
    if (stage !== 'gap') return
    const timer = window.setTimeout(() => setStage('lottery'), GAP_MS)
    return () => window.clearTimeout(timer)
  }, [stage])

  if (stage === 'pending' || stage === 'gap') return null
  if (stage === 'lottery') return <LotteryAnnouncementModal onCollapse={() => setStage('done')} />
  return (
    <TriviaAnnouncementModal
      onCollapse={() => {
        if (stage === 'trivia' && !lotteryAnnouncementSeen()) setStage('gap')
      }}
    />
  )
}
