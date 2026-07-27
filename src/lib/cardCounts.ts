/**
 * How many cards each deck would print, for the same participants and actions.
 *
 * `combined` and `split` are the two totals - keyed by ScanMode, so callers can
 * index them with the mode in hand. The two halves the split deck is made of
 * are kept alongside, because "55 cards" says nothing about how they are made
 * up until it is broken into participant cards and task cards.
 */
export interface CardCounts {
  combined: number
  split: number
  /** One per participant - the split deck's first half. */
  participantCards: number
  /** One per active action - the split deck's second half. */
  actionCards: number
}

/** What every deck counts to before anything has loaded. */
export const EMPTY_CARD_COUNTS: CardCounts = {
  combined: 0,
  split: 0,
  participantCards: 0,
  actionCards: 0,
}

/** Only the fields the deck maths needs - keeps this usable from tests. */
export interface CountableParticipant {
  groupIds: string[]
}

export interface CountableAction {
  /** Empty means the action is open to every group. */
  groupIds: string[]
}

/**
 * Actions a participant can actually be given a card for.
 *
 * An action with no groups is open to everyone; otherwise the participant must
 * share at least one group with it.
 */
export function isActionRelevantTo(action: CountableAction, participantGroupIds: Set<string>): boolean {
  return action.groupIds.length === 0 || action.groupIds.some((id) => participantGroupIds.has(id))
}

/**
 * Deck sizes for both scan modes.
 *
 * The combined deck is deliberately not `participants × actions`: group
 * targeting means many pairings never get printed, so it has to be summed
 * per participant. Callers must not substitute a flat multiplication, and must
 * not feed this inactive actions - pass the same rows that will be printed.
 */
export function computeCardCounts(
  participants: CountableParticipant[],
  actions: CountableAction[],
): CardCounts {
  const combined = participants.reduce((sum, participant) => {
    const groupIds = new Set(participant.groupIds)
    return sum + actions.filter((action) => isActionRelevantTo(action, groupIds)).length
  }, 0)

  return {
    combined,
    split: participants.length + actions.length,
    participantCards: participants.length,
    actionCards: actions.length,
  }
}
