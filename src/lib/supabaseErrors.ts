/**
 * Telling "the schema is behind" apart from "something went wrong".
 *
 * This app's databases are not all on the same migration - a customer's
 * project may be several behind, and the SQL in supabase/APPLY_*.sql is run by
 * hand. A screen that asks for a table or a column which is not there yet
 * should degrade to what the older schema can answer, not show the operator an
 * error they cannot act on.
 */

export interface QueryError {
  code?: string
  message?: string
}

/**
 * The table itself is absent - its migration has never run.
 *
 * 42P01 is postgres' undefined_table; PGRST205 is PostgREST failing to find it
 * in its schema cache.
 *
 * `table` narrows the message check to that table's own wording: a column
 * error mentions the table too, and reading one as "the table is missing" is
 * exactly how a schema one migration behind came out looking empty instead of
 * broken.
 */
export function isMissingTable(error: QueryError, table: string): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const message = error.message ?? ''
  return message.includes(table) && message.includes('relation')
}

/**
 * The table is there but a column this build asks for is not. Recoverable:
 * everything except that column still exists, so the caller retries without it
 * rather than reporting nothing.
 *
 * 42703 is undefined_column; PGRST204 is PostgREST's version.
 */
export function isMissingColumn(error: QueryError): boolean {
  if (error.code === '42703' || error.code === 'PGRST204') return true
  const message = error.message ?? ''
  return message.includes('column') && message.includes('does not exist')
}
