/**
 * URLService - Handles encoding and decoding calculation state to/from URL hash
 * Enables shareable links for calculation configurations
 */

const URLService = {
  encodeCalculation: (deckSize, handSize, combos, ydkFile = null, testHandFromDecklist = true) => {
    try {
      const data = {
        d: deckSize,
        h: handSize,
        c: combos.map(combo => ({
          i: combo.id,
          n: combo.name,
          cards: combo.cards.map(card => ({
            s: card.starterCard,
            cId: card.cardId,
            iC: card.isCustom,
            deck: card.startersInDeck,
            min: card.minCopiesInHand,
            max: card.maxCopiesInHand,
            logic: card.logicOperator || 'AND'  // AC #6: Save AND/OR logic in URLs
          }))
        })),
        testHand: testHandFromDecklist
      };

      // Add YDK file data if present
      if (ydkFile) {
        data.ydk = {
          name: ydkFile.name,
          content: ydkFile.content
        };
      }

      const jsonString = JSON.stringify(data);
      const encoded = btoa(jsonString);
      return encoded;
    } catch (error) {
      console.error('Failed to encode calculation:', error);
      return null;
    }
  },

  decodeCalculation: () => {
    try {
      const hash = window.location.hash;
      const match = hash.match(/#calc=(.+)/);
      if (!match) return null;

      const decoded = atob(match[1]);
      const data = JSON.parse(decoded);

      if (!data.d || !data.h || !data.c || !Array.isArray(data.c)) {
        return null;
      }

      const result = {
        deckSize: data.d,
        handSize: data.h,
        combos: data.c.map(combo => ({
          id: combo.i,
          name: combo.n,
          cards: combo.cards.map(card => ({
            starterCard: card.s || '',
            cardId: card.cId || null,
            isCustom: card.iC || false,
            startersInDeck: card.deck,
            minCopiesInHand: card.min,
            maxCopiesInHand: card.max,
            logicOperator: card.logic || 'AND'  // AC #6: Default to AND for old URLs
          }))
        })),
        testHandFromDecklist: data.testHand !== undefined ? data.testHand : true
      };

      // Add YDK file data if present
      if (data.ydk) {
        result.ydkFile = {
          name: data.ydk.name,
          content: data.ydk.content
        };
      }

      return result;
    } catch (error) {
      console.error('Failed to decode calculation:', error);
      return null;
    }
  },

  updateURL: (deckSize, handSize, combos, ydkFile = null, testHandFromDecklist = true) => {
    const encoded = URLService.encodeCalculation(deckSize, handSize, combos, ydkFile, testHandFromDecklist);
    if (encoded) {
      window.history.replaceState(null, '', `#calc=${encoded}`);
    }
  }
};

export default URLService;
