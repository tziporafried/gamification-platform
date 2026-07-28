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
