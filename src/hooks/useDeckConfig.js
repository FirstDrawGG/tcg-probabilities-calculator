import { useState } from 'react';
import { DEFAULT_DECK_SIZE, DEFAULT_HAND_SIZE } from '../constants/config';

/**
 * Custom hook for managing deck configuration
 * @returns {Object} Deck config state and handlers
 */
const useDeckConfig = () => {
  const [deckSize, setDeckSize] = useState(DEFAULT_DECK_SIZE);
  const [handSize, setHandSize] = useState(DEFAULT_HAND_SIZE);

  const updateDeckSize = (size) => {
    const parsedSize = parseInt(size) || 0;
    if (parsedSize > 0 && parsedSize <= 100) {
      setDeckSize(parsedSize);
    }
  };

  const updateHandSize = (size) => {
    const parsedSize = parseInt(size) || 0;
    if (parsedSize > 0 && parsedSize <= 20) {
      setHandSize(parsedSize);
    }
  };

  const validateConfig = () => {
    const errors = {};

    if (deckSize < 1 || deckSize > 100) {
      errors.deckSize = 'Deck size must be between 1 and 100';
    }

    if (handSize < 1 || handSize > 20) {
      errors.handSize = 'Hand size must be between 1 and 20';
    }

    if (handSize > deckSize) {
      errors.handSize = 'Hand size cannot exceed deck size';
    }

    return errors;
  };

  return {
    deckSize,
    handSize,
    setDeckSize,
    setHandSize,
    updateDeckSize,
    updateHandSize,
    validateConfig
  };
};

export default useDeckConfig;
