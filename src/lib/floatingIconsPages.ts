/** Page ids for the floating background icons layer. Remove a page from FLOATING_ICONS_ENABLED_PAGES to disable. */
export const FLOATING_ICONS_PAGE_IDS = {
  landing: 'landing',
  login: 'login',
  myEvents: 'my-events',
  wizard: 'wizard',
  control: 'control',
} as const

export type FloatingIconsPageId = (typeof FLOATING_ICONS_PAGE_IDS)[keyof typeof FLOATING_ICONS_PAGE_IDS]

export const FLOATING_ICONS_ENABLED_PAGES: readonly FloatingIconsPageId[] = [
  FLOATING_ICONS_PAGE_IDS.landing,
  FLOATING_ICONS_PAGE_IDS.login,
  FLOATING_ICONS_PAGE_IDS.myEvents,
  FLOATING_ICONS_PAGE_IDS.wizard,
  FLOATING_ICONS_PAGE_IDS.control,
]

export function isFloatingIconsEnabled(pageId: FloatingIconsPageId): boolean {
  return FLOATING_ICONS_ENABLED_PAGES.includes(pageId)
}
