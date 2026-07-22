import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AuthProvider } from '@/contexts/AuthContext'
import { PlansModalProvider } from '@/contexts/PlansModalContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthRedirect } from '@/components/AuthRedirect'
import { AppShell } from '@/components/layout/AppShell'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { AnalyticsListener } from '@/components/AnalyticsListener'
import { LotteryAnnouncementModal } from '@/components/LotteryAnnouncementModal'
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/Login'
import { MyEvents } from '@/pages/MyEvents'
import { EventWizard } from '@/pages/EventWizard'
import { EventControlCenterPage } from '@/pages/EventControlCenter'
import { LiveEventsPage } from '@/pages/LiveEventsPage'
import { LotteryPresentationPage } from '@/pages/LotteryPresentationPage'
import { EventDisplayPage } from '@/pages/EventDisplay'
import { EventKioskPage } from '@/pages/EventKioskPage'
import { AdminPanel } from '@/pages/AdminPanel'
import { EventBySlugControl } from '@/pages/EventBySlug'
import { AuthCallback } from '@/pages/AuthCallback'
import { PlansPage } from '@/pages/PlansPage'
import { TermsPage } from '@/pages/TermsPage'

export default function App() {
  // reducedMotion="user" makes every framer-motion component honour the OS
  // setting - CSS media queries cannot reach JS-driven transforms.
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
      <AuthProvider>
        <AnalyticsListener />
        <ImpersonationBanner />
        <PlansModalProvider>
          <LotteryAnnouncementModal />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/welcome" element={<Navigate to="/" replace />} />
            <Route path="/login" element={<AuthRedirect><Login /></AuthRedirect>} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* All authenticated routes share AppShell (GlobalHeader) */}
            <Route path="/events" element={<ProtectedRoute><AppShell atmosphere="dashboard"><MyEvents /></AppShell></ProtectedRoute>} />
            <Route path="/events/:id" element={<ProtectedRoute><AppShell atmosphere="wizard"><EventWizard /></AppShell></ProtectedRoute>} />
            <Route path="/events/:id/step/:step" element={<ProtectedRoute><AppShell atmosphere="wizard"><EventWizard /></AppShell></ProtectedRoute>} />
            <Route path="/events/:id/control" element={<ProtectedRoute><AppShell atmosphere="control"><EventControlCenterPage /></AppShell></ProtectedRoute>} />
            <Route path="/events/:id/live-events" element={<ProtectedRoute><AppShell atmosphere="control"><LiveEventsPage /></AppShell></ProtectedRoute>} />
            <Route path="/events/:id/lottery" element={<ProtectedRoute><LotteryPresentationPage /></ProtectedRoute>} />
            <Route path="/events/:id/display" element={<ProtectedRoute><EventDisplayPage /></ProtectedRoute>} />
            <Route path="/events/:id/kiosk" element={<ProtectedRoute><EventKioskPage /></ProtectedRoute>} />
            <Route path="/e/:slug/control" element={<ProtectedRoute><AppShell atmosphere="control"><EventBySlugControl /></AppShell></ProtectedRoute>} />
            <Route path="/admin" element={<Navigate to="/admin/analytics" replace />} />
            <Route path="/admin/:tab" element={<ProtectedRoute requireRole="super_admin"><AppShell><AdminPanel /></AppShell></ProtectedRoute>} />
            {/* Legacy / deep-link entry - opens plans modal, then leaves /plans */}
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/terms" element={<TermsPage />} />

            {/* Backward compat */}
            <Route path="/dashboard" element={<Navigate to="/events" replace />} />
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PlansModalProvider>
      </AuthProvider>
      </BrowserRouter>
    </MotionConfig>
  )
}
