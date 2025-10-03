/**
 * Validation utilities for deck configuration and combo validation
 */

export const validateDeckSize = (size) => {
  if (size < 1 || size > 100) {
    return 'Deck size must be between 1 and 100';
  }
  return null;
};

export const validateHandSize = (size, deckSize) => {
  if (size < 1 || size > 20) {
    return 'Hand size must be between 1 and 20';
  }
  if (size > deckSize) {
    return 'Hand size cannot exceed deck size';
  }
  return null;
};

export const validateCombo = (combo) => {
  const errors = [];

  if (!combo.cards || combo.cards.length === 0) {
    errors.push('Combo must have at least one card');
  }

  combo.cards.forEach((card, index) => {
    if (!card.starterCard || card.starterCard.trim().length === 0) {
      errors.push(`Card ${index + 1}: Card name is required`);
    }

    if (card.startersInDeck < 0) {
      errors.push(`Card ${index + 1}: Copies in deck cannot be negative`);
    }

    if (card.minCopiesInHand < 0) {
      errors.push(`Card ${index + 1}: Min copies cannot be negative`);
    }

    if (card.maxCopiesInHand < card.minCopiesInHand) {
      errors.push(`Card ${index + 1}: Max copies cannot be less than min copies`);
    }

    if (card.maxCopiesInHand > card.startersInDeck) {
      errors.push(`Card ${index + 1}: Max copies in hand cannot exceed copies in deck`);
    }
  });

  return errors;
};
