import { useMemo } from 'react'
import { ArrowRight, Crown, Trophy, Users } from 'lucide-react'
import { getGroupLeaderboard, getParticipantLeaderboard } from '@/lib/offline/leaderboard'
import type { GamePack, LocalScan } from '@/lib/offline/types'

interface OfflineDisplayProps {
  pack: GamePack
  scans: LocalScan[]
  onBack: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']

export function OfflineDisplay({ pack, scans, onBack }: OfflineDisplayProps) {
  const people = useMemo(() => getParticipantLeaderboard(pack, scans), [pack, scans])
  const groups = useMemo(() => getGroupLeaderboard(pack, scans), [pack, scans])
  const hasGroups = pack.groups.length > 0

  // Podium wants the order 2 · 1 · 3 so the winner sits in the middle.
  const podium = [people[1], people[0], people[2]]
  const podiumRank = [2, 1, 3]
  const rest = people.slice(3)

  return (
    <div className="pl-display">
      {/* The logo and the resort name lead this screen the same way they lead
          the online ceremony - full size, bare on the backdrop, with the back
          button tucked into the corner so it doesn't compete. */}
      <header className="pl-display-head">
        <button className="pl-btn pl-display-back" onClick={onBack}>
          <ArrowRight size={18} strokeWidth={2.5} />
          חזרה
        </button>
        <div className="pl-hero">
          {pack.event.logo_url ? (
            <img className="pl-hero-logo" src={pack.event.logo_url} alt="" />
          ) : (
            /* No uploaded logo - a crown, not the first two letters of the name. */
            <div className="pl-hero-logo pl-hero-logo--fallback">
              <Crown size={58} strokeWidth={2} fill="currentColor" />
            </div>
          )}
          <div className="pl-hero-text">
            <p className="pl-hero-eyebrow">שיאים בלייב</p>
            <h1 className="pl-hero-name">{pack.event.name}</h1>
          </div>
        </div>
      </header>

      <div className="pl-display-body">
        <section>
          <h2 className="pl-section-title"><Trophy size={17} strokeWidth={2.5} />לוח המובילים</h2>

          {people.some((p) => p.total_points > 0) ? (
            <>
              <div className="pl-podium">
                {podium.map((entry, i) =>
                  entry ? (
                    <div
                      key={entry.participant_id}
                      className={`pl-podium-col pl-podium-col--${podiumRank[i]}`}
                    >
                      <div className="pl-podium-medal">{MEDALS[podiumRank[i] - 1]}</div>
                      <div className="pl-podium-name">{entry.participant_name}</div>
                      <div className="pl-podium-bar">{entry.total_points}</div>
                    </div>
                  ) : (
                    <div key={i} className={`pl-podium-col pl-podium-col--${podiumRank[i]}`} />
                  ),
                )}
              </div>

              <div className="pl-list">
                {rest.map((row, i) => (
                  <div key={row.participant_id} className="pl-lrow">
                    <span className="pl-lrow-rank">{i + 4}</span>
                    <span className="pl-lrow-name">{row.participant_name}</span>
                    <span className="pl-lrow-pts">{row.total_points}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="pl-empty">המשחק עוד לא התחיל - סרקו את הקוד הראשון כדי לפתוח את הלוח.</div>
          )}
        </section>

        {hasGroups && (
          <section>
            <h2 className="pl-section-title"><Users size={17} strokeWidth={2.5} />קבוצות</h2>
            <div className="pl-list">
              {groups.map((row, i) => (
                <div key={row.group_id} className="pl-lrow">
                  <span className="pl-lrow-rank">{i + 1}</span>
                  <span className="pl-lrow-dot" style={{ background: row.group_color }} />
                  <span className="pl-lrow-name">{row.group_name}</span>
                  <span className="pl-lrow-pts">{row.total_points}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
