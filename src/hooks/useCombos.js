import { useState } from 'react';

/**
 * Custom hook for managing combo state
 * @param {Object} initialCombo - Initial combo configuration
 * @returns {Object} Combo state and handlers
 */
const useCombos = (initialCombo = null) => {
  const [combos, setCombos] = useState(
    initialCombo ? [initialCombo] : [{
      id: crypto.randomUUID(),
      name: 'Combo 1',
      cards: [{
        starterCard: '',
        cardId: null,
        isCustom: false,
        startersInDeck: 3,
        minCopiesInHand: 1,
        maxCopiesInHand: 3,
        logicOperator: 'AND'
      }]
    }]
  );

  const addCombo = () => {
    const newComboNumber = combos.length + 1;
    setCombos(prev => [...prev, {
      id: crypto.randomUUID(),
      name: `Combo ${newComboNumber}`,
      cards: [{
        starterCard: '',
        cardId: null,
        isCustom: false,
        startersInDeck: 3,
        minCopiesInHand: 1,
        maxCopiesInHand: 3,
        logicOperator: 'AND'
      }]
    }]);
  };

  const updateCombo = (comboId, updatedCombo) => {
    setCombos(prev => prev.map(combo =>
      combo.id === comboId ? { ...combo, ...updatedCombo } : combo
    ));
  };

  const deleteCombo = (comboId) => {
    setCombos(prev => prev.filter(combo => combo.id !== comboId));
  };

  const addCardToCombo = (comboId) => {
    setCombos(prev => prev.map(combo => {
      if (combo.id === comboId) {
        return {
          ...combo,
          cards: [...combo.cards, {
            starterCard: '',
            cardId: null,
            isCustom: false,
            startersInDeck: 3,
            minCopiesInHand: 1,
            maxCopiesInHand: 3,
            logicOperator: 'AND'
          }]
        };
      }
      return combo;
    }));
  };

  const removeCardFromCombo = (comboId, cardIndex) => {
    setCombos(prev => prev.map(combo => {
      if (combo.id === comboId) {
        return {
          ...combo,
          cards: combo.cards.filter((_, index) => index !== cardIndex)
        };
      }
      return combo;
    }));
  };

  const updateCardInCombo = (comboId, cardIndex, updatedCard) => {
    setCombos(prev => prev.map(combo => {
      if (combo.id === comboId) {
        return {
          ...combo,
          cards: combo.cards.map((card, index) =>
            index === cardIndex ? { ...card, ...updatedCard } : card
          )
        };
      }
      return combo;
    }));
  };

  const resetCombos = () => {
    setCombos([{
      id: crypto.randomUUID(),
      name: 'Combo 1',
      cards: [{
        starterCard: '',
        cardId: null,
        isCustom: false,
        startersInDeck: 3,
        minCopiesInHand: 1,
        maxCopiesInHand: 3,
        logicOperator: 'AND'
      }]
    }]);
  };

  return {
    combos,
    addCombo,
    updateCombo,
    deleteCombo,
    addCardToCombo,
    removeCardFromCombo,
    updateCardInCombo,
    resetCombos,
    setCombos // For loading from URL
  };
};

export default useCombos;
