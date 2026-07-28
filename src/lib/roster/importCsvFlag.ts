/**
 * The `import_csv` feature flag: this game may build its roster from a file.
 *
 * Sold with the organizations plan, which is what the flag's `default_plans`
 * says in the admin panel - so no per-game row is needed for an organization,
 * and a customer on another plan who bought the import gets a row granting it.
 * Neither case is a code change, which is the whole point.
 *
 * What it gates is every door into the import: the buttons on the participants
 * and groups steps, the wording that offers it, and the dialog itself. A game
 * without it sees no import at all - not a locked one - so nothing in the UI
 * mentions a capability that game does not have.
 *
 * It resolves off while the catalogue is still loading, so the button appears
 * a moment after the step rather than flashing and vanishing for the games that
 * do not have it. That is the same trade every gate in the app makes.
 */

import { useFeatureFlag } from '@/contexts/EventFeaturesContext'

export const IMPORT_CSV_FLAG = 'import_csv'

/** Can this game import a roster from a spreadsheet? False outside a game. */
export function useImportCsv(): boolean {
  return useFeatureFlag(IMPORT_CSV_FLAG)
}

/**
 * True when a write failed only because migration 083 has not been applied to
 * this database - the two halves of a name have nowhere to go.
 *
 * Only the games with this flag can reach it. Everywhere else a name is written
 * whole into `name`, the column that has always been there, so a database
 * missing 083 behaves exactly as it did before.
 */
export function isMissingNamePartsColumnError(message: string | null | undefined): boolean {
  if (!message) return false
  const missing = message.includes('does not exist') || message.includes('schema cache')
  return missing && (message.includes('first_name') || message.includes('last_name'))
}

export const MISSING_NAME_PARTS_COLUMN_MESSAGE =
  'פיצול שם פרטי ומשפחה עדיין לא מותקן במסד הנתונים. הריצו את APPLY_PARTICIPANT_NAME_PARTS.sql ונסו שוב.'
