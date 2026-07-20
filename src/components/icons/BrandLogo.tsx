import { cn } from '@/lib/utils'

type BrandLogoProps = {
  className?: string
  alt?: string
}

/** Product mark - sized to match the Gamify wordmark height by default */
export function BrandLogo({ className, alt = 'Gamify' }: BrandLogoProps) {
  return (
    <img
      src="/logo.png?v=5"
      alt={alt}
      className={cn('shrink-0 object-contain', className ?? 'h-[2.375rem] w-[2.375rem]')}
      decoding="async"
    />
  )
}

type BrandWordmarkProps = {
  className?: string
  showSubtitle?: boolean
  /** RTL header uses end-aligned text; landing may prefer start */
  align?: 'start' | 'end'
}

/** Icon + wordmark using logo cup red + scan teal */
export function BrandWordmark({
  className,
  showSubtitle = true,
  align = 'end',
}: BrandWordmarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandLogo />
      <span
        className={cn(
          'flex flex-col justify-center leading-none gap-0.5',
          align === 'end' ? 'items-end' : 'items-start',
        )}
      >
        <span className="text-sm font-bold tracking-tight text-primary-text">Gamify</span>
        {showSubtitle && (
          <span className="text-[10px] font-semibold tracking-wide text-secondary-text">PLATFORM</span>
        )}
      </span>
    </span>
  )
}
