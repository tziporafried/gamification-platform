import { lazy, type ComponentType } from 'react'
import { FamilyVacationHero } from './heroes/FamilyVacationHero'

/**
 * The homepage versions. They all share the same page (Landing.tsx); what
 * changes between them is the opening section at the top - the hero. Each
 * version is a full React component (src/pages/home/heroes/), so a seasonal
 * hero can have its own fonts, images, layout and animations.
 *
 * Which one `/` shows is decided in this order:
 *   1. The choice saved in the admin panel (אדמין ← דף הבית), if any.
 *   2. Otherwise CODE_DEFAULT_HOME below.
 *
 * Every version is also reachable directly at /home/<id> no matter which one
 * is active - for previewing a holiday version before switching to it, or for
 * a campaign link to a specific version.
 *
 * Adding a version:
 *   1. Create a component in src/pages/home/heroes/ (copy FamilyVacationHero.tsx as a
 *      starting point; shared.tsx has the regular animations and <Brand>).
 *      Images can go in public/ or be imported next to the component.
 *   2. Add an entry below with lazy(...), so visitors who get a different
 *      version do not download its images and code.
 *   3. It appears in the admin panel and at /home/<id> automatically.
 */

export interface HomePageDef {
  /** URL slug: /home/<id>. Lowercase English letters, digits and dashes. */
  id: string
  /** Name shown in the admin panel. */
  label: string
  /** Short note for the admin panel - when this version is meant to run. */
  description?: string
  /** The opening section of the homepage. */
  Hero: ComponentType
}

/** Load a hero from heroes/ only when it is shown. */
export function lazyHero(load: () => Promise<{ default: ComponentType }>): ComponentType {
  return lazy(load)
}

export const HOME_PAGES: HomePageDef[] = [
  {
    id: 'family-vacation',
    label: 'נופש משפחתי',
    description: 'הגרסה של כל השנה',
    Hero: FamilyVacationHero,
  },
  {
    id: 'hanukkah',
    label: 'חנוכה',
    description: 'חנוכיה נדלקת וטקסטים לחג - לשבועות שלפני חנוכה ובמהלכו',
    Hero: lazyHero(() => import('./heroes/HanukkahHero').then((m) => ({ default: m.HanukkahHero }))),
  },
]

/**
 * The version `/` shows when nothing is chosen in the admin panel.
 * Change this in code when the season changes.
 */
export const CODE_DEFAULT_HOME = 'family-vacation'

export function findHomePage(id: string | null | undefined): HomePageDef | undefined {
  if (!id) return undefined
  return HOME_PAGES.find((p) => p.id === id)
}

/** The code default, falling back to the first version if the constant is mistyped. */
export function codeDefaultHomePage(): HomePageDef {
  return findHomePage(CODE_DEFAULT_HOME) ?? HOME_PAGES[0]
}
