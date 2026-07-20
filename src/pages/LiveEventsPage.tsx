import { Navigate, useParams } from 'react-router-dom'

/**
 * Legacy deep-link - live events now open as a selection modal from the
 * control center. Keep the route so old bookmarks land on the dashboard.
 */
export function LiveEventsPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/events" replace />
  return <Navigate to={`/events/${id}/control`} replace />
}
