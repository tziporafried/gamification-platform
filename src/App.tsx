import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthRedirect } from '@/components/AuthRedirect'
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { MyEvents } from '@/pages/MyEvents'
import { EventWizard } from '@/pages/EventWizard'
import { EventControlCenterPage } from '@/pages/EventControlCenter'
import { EventScanPage } from '@/pages/EventScan'
import { EventDisplayPage } from '@/pages/EventDisplay'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<AuthRedirect><Landing /></AuthRedirect>} />
          <Route path="/login" element={<AuthRedirect><Login /></AuthRedirect>} />
          <Route path="/register" element={<AuthRedirect><Register /></AuthRedirect>} />

          {/* Protected: Event management */}
          <Route path="/events" element={<ProtectedRoute><MyEvents /></ProtectedRoute>} />
          <Route path="/events/:id" element={<ProtectedRoute><EventWizard /></ProtectedRoute>} />
          <Route path="/events/:id/step/:step" element={<ProtectedRoute><EventWizard /></ProtectedRoute>} />
          <Route path="/events/:id/control" element={<ProtectedRoute><EventControlCenterPage /></ProtectedRoute>} />
          <Route path="/events/:id/scan" element={<ProtectedRoute><EventScanPage /></ProtectedRoute>} />
          <Route path="/events/:id/display" element={<ProtectedRoute><EventDisplayPage /></ProtectedRoute>} />

          {/* Backward compat */}
          <Route path="/dashboard" element={<Navigate to="/events" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
