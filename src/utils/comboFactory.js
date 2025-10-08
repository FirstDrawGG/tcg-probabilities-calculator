/**
 * Combo Factory
 * Creates standardized combo data structures
 */

export const createCombo = (id, index) => ({
  id,
  name: `Combo ${index + 1}`,
  cards: [{
    starterCard: '',
    cardId: null,
    isCustom: false,
    startersInDeck: 3,
    minCopiesInHand: 1,
    maxCopiesInHand: 3,
    logicOperator: 'AND'  // Default to AND, only relevant for 2nd+ cards
  }]
});
