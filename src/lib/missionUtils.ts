export function computeRanks<T extends { total_points: number }>(entries: T[]): (T & { rank: number })[] {
  let r = 1
  return entries.map((e, i) => {
    if (i > 0 && e.total_points < entries[i - 1].total_points) r = i + 1
    return { ...e, rank: r }
  })
}
