import { cn } from '@/lib/utils'

interface AvatarCircleProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  ringColor?: string
  className?: string
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

const AVATAR_COLORS = [
  'var(--color-primary)',
  'var(--color-primary-hover)',
  'var(--color-secondary)',
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-danger)',
  'var(--color-muted)',
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function AvatarCircle({ name, size = 'md', ringColor, className }: AvatarCircleProps) {
  const bgColor = nameToColor(name)

  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-background',
        sizes[size],
        ringColor && 'ring-2 ring-offset-1',
        className,
      )}
      style={{
        backgroundColor: bgColor,
        ...(ringColor ? { ['--tw-ring-color' as string]: ringColor } : {}),
      }}
    >
      {getInitials(name)}
    </div>
  )
}
