import { useCallback, useEffect, useRef, useState } from 'react'
import { submitOfflineScan } from '@/lib/offline/scoreEngine'
import type { GamePack, GameState } from '@/lib/offline/types'
import type { ScoreSubmitResult } from '@/hooks/useScoreSubmit'
import { loadGameState, saveGameState, storageKeyFor } from './gameState'
import { OfflineHub } from './screens/OfflineHub'
import { OfflineScan } from './screens/OfflineScan'
import { OfflineDisplay } from './screens/OfflineDisplay'
import './player.css'

type View = 'hub' | 'scan' | 'display'

export type SubmitResult =
  | { ok: true; result: ScoreSubmitResult }
  | { ok: false; error: string }

export function OfflinePlayer({ pack }: { pack: GamePack }) {
  const [view, setView] = useState<View>('hub')
  const [state, setState] = useState<GameState>(() => loadGameState(pack))
  // Latest state for burst scans without a stale closure, and no side effects
  // inside the setState updater.
  const stateRef = useRef(state)

  // Two windows of the same file share one storage origin. When the scan window
  // writes, a display window opened separately updates live.
  useEffect(() => {
    const key = storageKeyFor(pack.event.id)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return
      const next = loadGameState(pack)
      stateRef.current = next
      setState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [pack])

  const submitCodes = useCallback(
    (participantCode: string, actionCode: string): SubmitResult => {
      const res = submitOfflineScan(pack, stateRef.current, participantCode, actionCode)
      if (!res.ok) return { ok: false, error: res.error }
      stateRef.current = res.state
      setState(res.state)
      saveGameState(pack, res.state)
      return { ok: true, result: res.result }
    },
    [pack],
  )

  return (
    <div className="pl-root">
      {view === 'scan' && (
        <OfflineScan
          pack={pack}
          scans={state.scans}
          scanCount={state.scans.length}
          onSubmitCodes={submitCodes}
          onBack={() => setView('hub')}
        />
      )}
      {view === 'display' && (
        <OfflineDisplay pack={pack} scans={state.scans} onBack={() => setView('hub')} />
      )}
      {view === 'hub' && (
        <OfflineHub pack={pack} onScan={() => setView('scan')} onBoard={() => setView('display')} />
      )}
    </div>
  )
}
