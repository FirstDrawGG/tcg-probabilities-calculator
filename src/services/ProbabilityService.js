/**
 * ProbabilityService - Core probability calculation engine for TCG scenarios
 * 
 * This service handles Monte Carlo simulations for calculating the probability
 * of drawing specific card combinations in trading card games.
 */

class ProbabilityService {
  constructor() {
    this.resultCache = new Map();
  }

  /**
   * Clears the probability calculation cache
   */
  clearCache() {
    this.resultCache.clear();
  }

  /**
   * Generates a cache key for a single combo
   */
  getCacheKey(combo, deckSize, handSize) {
    const cardsKey = combo.cards.map(card => 
      `${card.startersInDeck}-${card.minCopiesInHand}-${card.maxCopiesInHand}`
    ).join('|');
    return `${cardsKey}-${deckSize}-${handSize}`;
  }

  /**
   * Generates a cache key for multiple combos
   */
  getCombinedCacheKey(combos, deckSize, handSize) {
    const combosKey = combos.map(combo => 
      combo.cards.map(card => 
        `${card.startersInDeck}-${card.minCopiesInHand}-${card.maxCopiesInHand}`
      ).join('|')
    ).join('||');
    return `combined-${combosKey}-${deckSize}-${handSize}`;
  }

  /**
   * Runs Monte Carlo simulation for a single combo
   * @param {Object} combo - The combo configuration
   * @param {number} deckSize - Total deck size
   * @param {number} handSize - Hand size to draw
   * @param {number} simulations - Number of simulations to run (default: 100000)
   * @returns {number} Probability percentage
   */
  monteCarloSimulation(combo, deckSize, handSize, simulations = 100000) {
    const cacheKey = this.getCacheKey(combo, deckSize, handSize);
    
    if (this.resultCache.has(cacheKey)) {
      return this.resultCache.get(cacheKey);
    }
    
    let successes = 0;
    
    for (let i = 0; i < simulations; i++) {
      const deck = [];
      let currentPosition = 0;
      
      // Add cards to deck based on combo requirements
      combo.cards.forEach((card, cardIndex) => {
        for (let j = 0; j < card.startersInDeck; j++) {
          deck.push(cardIndex);
        }
        currentPosition += card.startersInDeck;
      });
      
      // Fill remaining deck slots with non-combo cards
      for (let j = currentPosition; j < deckSize; j++) {
        deck.push(-1);
      }
      
      // Shuffle deck using Fisher-Yates algorithm
      for (let j = deck.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [deck[j], deck[k]] = [deck[k], deck[j]];
      }
      
      // Count cards drawn in hand
      const cardCounts = new Array(combo.cards.length).fill(0);
      for (let j = 0; j < handSize; j++) {
        if (deck[j] >= 0) {
          cardCounts[deck[j]]++;
        }
      }
      
      // Check if combo criteria are met
      let allCardsCriteriaMet = true;
      for (let cardIndex = 0; cardIndex < combo.cards.length; cardIndex++) {
        const card = combo.cards[cardIndex];
        const drawnCount = cardCounts[cardIndex];
        
        if (drawnCount < card.minCopiesInHand || drawnCount > card.maxCopiesInHand) {
          allCardsCriteriaMet = false;
          break;
        }
      }
      
      if (allCardsCriteriaMet) {
        successes++;
      }
    }
    
    const probability = (successes / simulations) * 100;
    this.resultCache.set(cacheKey, probability);
    
    return probability;
  }

  /**
   * Runs Monte Carlo simulation for multiple combos (OR logic)
   * @param {Array} combos - Array of combo configurations
   * @param {number} deckSize - Total deck size
   * @param {number} handSize - Hand size to draw
   * @param {number} simulations - Number of simulations to run (default: 100000)
   * @returns {number} Probability percentage
   */
  combinedMonteCarloSimulation(combos, deckSize, handSize, simulations = 100000) {
    const cacheKey = this.getCombinedCacheKey(combos, deckSize, handSize);
    
    if (this.resultCache.has(cacheKey)) {
      return this.resultCache.get(cacheKey);
    }
    
    let successes = 0;
    
    // Create a unified card mapping for all combos
    const allUniqueCards = new Map();
    let cardIdCounter = 0;
    
    combos.forEach(combo => {
      combo.cards.forEach(card => {
        const cardKey = `${card.starterCard}-${card.cardId || 'custom'}`;
        if (!allUniqueCards.has(cardKey)) {
          allUniqueCards.set(cardKey, {
            id: cardIdCounter++,
            name: card.starterCard,
            totalInDeck: 0
          });
        }
        allUniqueCards.get(cardKey).totalInDeck = Math.max(
          allUniqueCards.get(cardKey).totalInDeck,
          card.startersInDeck
        );
      });
    });
    
    for (let i = 0; i < simulations; i++) {
      const deck = [];
      
      // Build deck with all unique cards
      allUniqueCards.forEach((cardInfo) => {
        for (let j = 0; j < cardInfo.totalInDeck; j++) {
          deck.push(cardInfo.id);
        }
      });
      
      // Fill remaining deck slots
      for (let j = deck.length; j < deckSize; j++) {
        deck.push(-1);
      }
      
      // Shuffle deck
      for (let j = deck.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [deck[j], deck[k]] = [deck[k], deck[j]];
      }
      
      // Count cards in hand
      const handCounts = new Map();
      allUniqueCards.forEach((cardInfo) => {
        handCounts.set(cardInfo.id, 0);
      });
      
      for (let j = 0; j < handSize; j++) {
        if (deck[j] >= 0) {
          handCounts.set(deck[j], (handCounts.get(deck[j]) || 0) + 1);
        }
      }
      
      // Check if ANY combo succeeds
      let anyComboSucceeds = false;
      
      for (const combo of combos) {
        let comboSucceeds = true;
        
        for (const card of combo.cards) {
          const cardKey = `${card.starterCard}-${card.cardId || 'custom'}`;
          const cardInfo = allUniqueCards.get(cardKey);
          const drawnCount = handCounts.get(cardInfo.id) || 0;
          
          if (drawnCount < card.minCopiesInHand || drawnCount > card.maxCopiesInHand) {
            comboSucceeds = false;
            break;
          }
        }
        
        if (comboSucceeds) {
          anyComboSucceeds = true;
          break;
        }
      }
      
      if (anyComboSucceeds) {
        successes++;
      }
    }
    
    const probability = (successes / simulations) * 100;
    this.resultCache.set(cacheKey, probability);
    
    return probability;
  }

  /**
   * Calculates probabilities for multiple combos
   * @param {Array} combos - Array of combo configurations
   * @param {number} deckSize - Total deck size
   * @param {number} handSize - Hand size to draw
   * @returns {Object} Object containing individual and combined results
   */
  calculateMultipleCombos(combos, deckSize, handSize) {
    const individualResults = combos.map(combo => ({
      id: combo.id,
      probability: this.monteCarloSimulation(combo, deckSize, handSize),
      cards: combo.cards
    }));
    
    // Calculate combined probability only if there are multiple combos
    let combinedProbability = null;
    if (combos.length > 1) {
      combinedProbability = this.combinedMonteCarloSimulation(combos, deckSize, handSize);
    }
    
    return {
      individual: individualResults,
      combined: combinedProbability
    };
  }
}

// Export singleton instance
export default new ProbabilityService();