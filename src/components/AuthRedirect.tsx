import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (user) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
