import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { safeReturnTo } from '@/lib/utils'

export function AuthCallback() {
  const { loading } = useAuth()
  const [searchParams] = useSearchParams()

  if (loading) {
    return <FullPageLoader />
  }

  return <Navigate to={safeReturnTo(searchParams.get('returnTo'))} replace />
}
