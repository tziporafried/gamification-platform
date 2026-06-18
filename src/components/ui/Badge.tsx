interface BadgeProps {
  label: string
  color: string
}

export function Badge({ label, color }: BadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: color + '20',
        color: color,
      }}
    >
      {label}
    </span>
  )
}
