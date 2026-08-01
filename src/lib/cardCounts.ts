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
  /** One card per answer of every active task - the split deck's second half. */
  actionCards: number
  /** How many of the tasks are questions. 0 in a game with no trivia. */
  triviaTasks: number
  /** The cards those questions account for - `triviaTasks × 3`, in the split deck. */
  triviaCards: number
}

/** What every deck counts to before anything has loaded. */
export const EMPTY_CARD_COUNTS: CardCounts = {
  combined: 0,
  split: 0,
  participantCards: 0,
  actionCards: 0,
  triviaTasks: 0,
  triviaCards: 0,
}

/** Only the fields the deck maths needs - keeps this usable from tests. */
export interface CountableParticipant {
  groupIds: string[]
}

export interface CountableAction {
  /** Empty means the action is open to every group. */
  groupIds: string[]
  /**
   * How many cards this one task prints: 1 for a standard task, one per answer
   * for a trivia question (088). Absent counts as 1, which is what every caller
   * written before questions existed means.
   */
  cardCount?: number
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

/** Cards one task prints. A task that never said is a plain one-card task. */
export function actionCardCount(action: CountableAction): number {
  return action.cardCount ?? 1
}

/**
 * Deck sizes for both scan modes.
 *
 * The combined deck is deliberately not `participants × actions`: group
 * targeting means many pairings never get printed, so it has to be summed
 * per participant. Callers must not substitute a flat multiplication, and must
 * not feed this inactive actions - pass the same rows that will be printed.
 *
 * A trivia question is where the two decks stop being comparable. It prints
 * three cards, so in the split deck it costs two extra sheets once - but in the
 * combined deck it costs two extra *per participant*, because a combined card
 * names the participant on it. Sixty players and four questions is 720 cards
 * one way and twelve the other. That is a number the cards step has to say out
 * loud, which is what `triviaTasks` and `triviaCards` are here for.
 */
export function computeCardCounts(
  participants: CountableParticipant[],
  actions: CountableAction[],
): CardCounts {
  const combined = participants.reduce((sum, participant) => {
    const groupIds = new Set(participant.groupIds)
    return sum + actions
      .filter((action) => isActionRelevantTo(action, groupIds))
      .reduce((cards, action) => cards + actionCardCount(action), 0)
  }, 0)

  const actionCards = actions.reduce((sum, action) => sum + actionCardCount(action), 0)
  const trivia = actions.filter((action) => actionCardCount(action) > 1)

  return {
    combined,
    split: participants.length + actionCards,
    participantCards: participants.length,
    actionCards,
    triviaTasks: trivia.length,
    triviaCards: trivia.reduce((sum, action) => sum + actionCardCount(action), 0),
  }
}
