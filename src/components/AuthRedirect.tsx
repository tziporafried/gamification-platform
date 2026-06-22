import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { safeReturnTo } from '@/lib/utils'

export function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [searchParams] = useSearchParams()

  if (loading) {
    return <FullPageLoader />
  }

  if (user) {
    return <Navigate to={safeReturnTo(searchParams.get('returnTo'))} replace />
  }

  return <>{children}</>
}
