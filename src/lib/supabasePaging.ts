/**
 * Reading a whole table, not just its first page.
 *
 * PostgREST caps a response - 1000 rows by default - and says so by simply
 * returning fewer. Every screen in this app that reads a list has been fine
 * with that, because a list on screen is scrolled rather than counted. An
 * export is not: a file that quietly stops at a thousand scans is worse than
 * one that fails, because nobody can tell.
 */

import type { QueryError } from './supabaseErrors'

const PAGE = 1000

export interface PagedResult<T> {
  rows: T[]
  error: QueryError | null
}

/**
 * Calls `query` with one row window after another until a short page comes
 * back. A full last page costs one extra empty read, which is the cheaper
 * mistake of the two.
 *
 * Rows arrive untyped from the caller's `select()`, so the caller names the
 * shape it asked for - the same bargain every other read in this app makes.
 */
export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: unknown; error: QueryError | null }>,
): Promise<PagedResult<T>> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1)
    if (error) return { rows, error }
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE) return { rows, error: null }
  }
}
