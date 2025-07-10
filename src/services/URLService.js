// src/services/URLService.js

export const URLService = {
  encodeCalculation: (deckSize, handSize, combos) => {
    const data = {
      d: deckSize,
      h: handSize,
      c: combos.map(combo => ({
        n: combo.name,
        cards: combo.cards.map(card => ({
          s: card.starterCard,
          sid: card.startersInDeck,
          min: card.minCopiesInHand,
          max: card.maxCopiesInHand,
          cid: card.cardId
        }))
      }))
    };
    
    return btoa(JSON.stringify(data));
  },
  
  decodeCalculation: () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get('calc');
      
      if (!encoded) return null;
      
      const decoded = JSON.parse(atob(encoded));
      
      return {
        deckSize: decoded.d,
        handSize: decoded.h,
        combos: decoded.c.map((combo, index) => ({
          id: index + 1,
          name: combo.n || `Combo ${index + 1}`,
          cards: combo.cards.map(card => ({
            starterCard: card.s || '',
            startersInDeck: card.sid || 0,
            minCopiesInHand: card.min || 0,
            maxCopiesInHand: card.max || 0,
            cardId: card.cid || null
          }))
        }))
      };
    } catch (error) {
      console.error('Failed to decode URL calculation:', error);
      return null;
    }
  },
  
  updateURL: (deckSize, handSize, combos) => {
    const encoded = URLService.encodeCalculation(deckSize, handSize, combos);
    const newURL = `${window.location.pathname}?calc=${encoded}`;
    window.history.replaceState(null, '', newURL);
  }
};