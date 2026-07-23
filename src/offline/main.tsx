import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { PlansModalProvider } from '@/contexts/PlansModalContext'
import { EventKioskPage } from '@/pages/EventKioskPage'
import { EventDisplayPage } from '@/pages/EventDisplay'
import { LotteryPresentationPage } from '@/pages/LotteryPresentationPage'
import { OfflineInstructionsPage } from '@/pages/OfflineInstructionsPage'
import type { GamePack } from '@/lib/offline/types'
import { PACK_VERSION } from '@/lib/offline/types'
import { initOfflineData } from './shim/data'
import { OfflineHub } from './screens/OfflineHub'
// The app's global styles: Tailwind utilities + design tokens + Heebo font-family.
// Without these the real kiosk's Tailwind-styled parts (e.g. manual entry) are unstyled.
import '@/index.css'
import './player.css'

/** Reads the pack the exporter embedded into this file. */
function readEmbeddedPack(): GamePack | null {
  const el = document.getElementById('game-data')
  if (!el?.textContent) return null
  try {
    const parsed = JSON.parse(el.textContent) as GamePack
    if (!parsed || typeof parsed !== 'object' || !parsed.event?.id) return null
    return parsed
  } catch {
    return null
  }
}

function NoPack({ reason }: { reason: string }) {
  return (
    <div className="pl-root">
      <div className="pl-nopack">
        <div className="pl-prompt">
          <div className="pl-prompt-badge">📦</div>
          <div className="pl-prompt-title">אין משחק בקובץ הזה</div>
          <div className="pl-prompt-sub">{reason}</div>
        </div>
      </div>
    </div>
  )
}

function HubRoute({ pack }: { pack: GamePack }) {
  const navigate = useNavigate()
  const base = `/events/${pack.event.id}`
  return (
    <OfflineHub
      pack={pack}
      onScan={() => navigate(`${base}/kiosk`)}
      onBoard={() => navigate(`${base}/display`)}
      onInstructions={() => navigate('/instructions')}
    />
  )
}

/** The real pages read the event id from the route; the hub always uses the pack's. */
function EventGuard({ pack, children }: { pack: GamePack; children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>()
  if (id !== pack.event.id) return <Navigate to="/" replace />
  return <>{children}</>
}

function OfflineApp({ pack }: { pack: GamePack }) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <PlansModalProvider>
        <Routes>
          <Route path="/" element={<HubRoute pack={pack} />} />
          <Route
            path="/instructions"
            element={
              <OfflineInstructionsPage
                backTo="/"
                backLabel="חזרה למסך הבית"
                showFooter={false}
              />
            }
          />
          <Route
            path="/events/:id/kiosk"
            element={<EventGuard pack={pack}><EventKioskPage /></EventGuard>}
          />
          <Route
            path="/events/:id/display"
            element={<EventGuard pack={pack}><EventDisplayPage /></EventGuard>}
          />
          <Route
            path="/events/:id/lottery"
            element={<EventGuard pack={pack}><LotteryPresentationPage /></EventGuard>}
          />
          {/* The real pages navigate here on error; send it home offline. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </PlansModalProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

// Build marker: confirms the offline file was produced from the latest template.
// Look for this line in the browser console after opening a downloaded game.
console.log('%c[offline-player] template build check ✅', 'color:#16a34a;font-weight:bold')

const pack = readEmbeddedPack()
if (pack && pack.version === PACK_VERSION) initOfflineData(pack)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {pack && pack.version === PACK_VERSION ? (
      <OfflineApp pack={pack} />
    ) : (
      <NoPack reason={pack ? 'הקובץ נוצר בגרסה אחרת של המערכת.' : 'ייצאו את המשחק מחדש מתוך מרכז הבקרה.'} />
    )}
  </StrictMode>,
)
