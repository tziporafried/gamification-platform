import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LiveEventCatalogItem } from './types'

const ACCENT_ICON: Record<LiveEventCatalogItem['accent'], string> = {
  legendary: 'bg-[linear-gradient(145deg,#FF9366,#F2B33C)] text-white shadow-[0_8px_20px_rgba(255,147,102,0.35)]',
  rich: 'bg-[linear-gradient(145deg,#5FB3AA,#388882)] text-white shadow-[0_8px_20px_rgba(95,179,170,0.3)]',
  medium: 'bg-[linear-gradient(145deg,#7C8CFF,#5A6AE8)] text-white shadow-[0_8px_20px_rgba(90,106,232,0.28)]',
}

interface LiveEventLibraryCardProps {
  item: LiveEventCatalogItem
  onLaunch?: () => void
  /** Primary launch card - larger presence for today's featured action. */
  featured?: boolean
}

export function LiveEventLibraryCard({ item, onLaunch, featured = false }: LiveEventLibraryCardProps) {
  const Icon = item.icon
  const available = item.available

  return (
    <article
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-2xl border text-right',
        'backdrop-blur-md transition-[box-shadow,transform,border-color] duration-[220ms] ease-out',
        featured
          ? 'border-warning/35 bg-white/70 shadow-[0_16px_40px_rgba(46,34,30,0.12)] hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(46,34,30,0.16)] sm:rounded-[1.35rem]'
          : available
            ? 'border-border/50 bg-white/55 shadow-[0_10px_28px_rgba(46,34,30,0.08)] hover:-translate-y-0.5 hover:border-border/80 hover:shadow-[0_16px_36px_rgba(46,34,30,0.14)]'
            : 'border-border/35 bg-white/40 shadow-[0_6px_18px_rgba(46,34,30,0.05)]',
      )}
    >
      {featured && (
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(255,184,0,0.08)_0%,transparent_45%)]"
          aria-hidden="true"
        />
      )}

      {!available && (
        <span
          className={cn(
            'absolute start-3 top-3 z-10 inline-flex items-center gap-1',
            'rounded-full border border-secondary/25 bg-secondary/10 px-2.5 py-1',
            'text-[10px] font-bold tracking-wide text-secondary-text shadow-sm backdrop-blur-sm',
          )}
        >
          <Sparkles size={10} strokeWidth={2.25} aria-hidden="true" />
          בפיתוח
        </span>
      )}

      <div
        className={cn(
          'relative flex flex-1 flex-col',
          featured ? 'p-6 sm:p-7' : 'p-5',
          !available && 'opacity-[0.72]',
        )}
      >
        <div
          className={cn(
            'mb-4 flex items-center justify-center rounded-xl',
            featured ? 'h-14 w-14 rounded-2xl' : 'h-12 w-12',
            available
              ? ACCENT_ICON[item.accent]
              : 'border border-border/60 bg-white/60 text-muted shadow-none',
          )}
        >
          <Icon size={featured ? 26 : 22} strokeWidth={2.25} aria-hidden="true" />
        </div>

        <h2
          className={cn(
            'font-black leading-snug text-foreground',
            featured ? 'text-xl sm:text-2xl' : 'text-lg',
          )}
        >
          {item.title}
        </h2>
        <p
          className={cn(
            'mt-1.5 flex-1 font-medium leading-relaxed text-muted',
            featured ? 'text-sm sm:text-base' : 'text-sm',
          )}
        >
          {item.description}
        </p>

        {available ? (
          <button
            type="button"
            onClick={onLaunch}
            className={cn(
              'mt-5 w-full rounded-xl px-4 text-sm font-bold',
              'transition-[background-color,transform,box-shadow] duration-150 ease-out',
              'active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              featured
                ? 'bg-[linear-gradient(135deg,#FF9366,#F2B33C)] py-3 text-white shadow-[0_8px_20px_rgba(255,147,102,0.35)] hover:brightness-105'
                : 'bg-foreground py-2.5 text-[var(--color-surface,#FFFDF7)] hover:bg-foreground/90',
            )}
          >
            {item.cta}
          </button>
        ) : (
          <div
            className={cn(
              'mt-5 w-full rounded-xl border border-dashed border-border/70',
              'bg-white/35 px-4 py-2.5 text-center text-sm font-semibold text-muted',
            )}
            aria-hidden="true"
          >
            {item.cta}
          </div>
        )}
      </div>
    </article>
  )
}
