import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { Landing } from '@/pages/Landing'
import { fetchActiveHomeId } from '@/lib/siteSettings'
import { codeDefaultHomePage, findHomePage, type HomePageDef } from './homePages'

/** `/` - the version chosen in the admin panel, else the code default. */
export function ActiveHomeRoute() {
  const [page, setPage] = useState<HomePageDef | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchActiveHomeId().then((id) => {
      if (!cancelled) setPage(findHomePage(id) ?? codeDefaultHomePage())
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!page) return <FullPageLoader />
  return <Landing Hero={page.Hero} />
}

/** `/home/:variant` - a specific version, whichever one is active. */
export function HomeVariantRoute() {
  const { variant } = useParams<{ variant: string }>()
  const page = findHomePage(variant)
  if (!page) return <Navigate to="/" replace />
  return <Landing Hero={page.Hero} />
}
