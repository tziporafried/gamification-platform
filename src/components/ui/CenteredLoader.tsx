import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'
import type { ComponentProps } from 'react'

type SpinnerProps = ComponentProps<typeof Spinner>

interface CenteredLoaderProps extends SpinnerProps {
  className?: string
  children?: ReactNode
}

export function CenteredLoader({ className, children, ...spinnerProps }: CenteredLoaderProps) {
  return (
    <div className={cn('flex justify-center', className ?? 'py-12')}>
      {children ?? <Spinner {...spinnerProps} />}
    </div>
  )
}
