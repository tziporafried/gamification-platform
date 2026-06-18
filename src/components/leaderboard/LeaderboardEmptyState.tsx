interface LeaderboardEmptyStateProps {
  themeColor: string
  message?: string
}

export function LeaderboardEmptyState({ themeColor, message }: LeaderboardEmptyStateProps) {
  return (
    <div
      className="opacity-0 animate-fade-in-up flex flex-col items-center justify-center rounded-xl border border-gray-200 px-6 py-16 text-center"
      style={{ background: `radial-gradient(ellipse at center, ${themeColor}08 0%, transparent 70%)` }}
    >
      <div
        className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{ backgroundColor: themeColor + '14' }}
      >
        <svg
          className="h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke={themeColor}
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621.504-1.125 1.125-1.125h.375c1.035 0 1.875-.84 1.875-1.875V9.75c0-1.036-.84-1.875-1.875-1.875h-.375A1.125 1.125 0 0116.5 6.75V3.375a.375.375 0 00-.375-.375h-9.25a.375.375 0 00-.375.375V6.75c0 .621-.504 1.125-1.125 1.125H5c-1.036 0-1.875.84-1.875 1.875v3.375c0 1.035.84 1.875 1.875 1.875h.375c.621 0 1.125.504 1.125 1.125V18.75"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold" style={{ color: themeColor }}>
        Competition Ready
      </h3>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        {message || 'No scores have been recorded yet. Start awarding points to see the first rankings appear.'}
      </p>
    </div>
  )
}
