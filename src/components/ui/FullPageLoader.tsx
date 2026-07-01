import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import { Spinner } from './Spinner'

export function FullPageLoader() {
  return (
    <div className={cn('flex h-screen items-center justify-center', theme.pageBg)}>
      <Spinner />
    </div>
  )
}
