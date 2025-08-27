/**
 * ProbabilityService - Core probability calculation engine for TCG scenarios
 * 
 * This service handles Monte Carlo simulations for calculating the probability
 * of drawing specific card combinations in trading card games.
 */

import HandTrapService from './HandTrapService.js';

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
      `${card.startersInDeck}-${card.minCopiesInHand}-${card.maxCopiesInHand}-${card.logicOperator || 'AND'}`
    ).join('|');
    return `${cardsKey}-${deckSize}-${handSize}`;
  }

  /**
   * Generates a cache key for multiple combos
   */
  getCombinedCacheKey(combos, deckSize, handSize) {
    const combosKey = combos.map(combo => 
      combo.cards.map(card => 
        `${card.startersInDeck}-${card.minCopiesInHand}-${card.maxCopiesInHand}-${card.logicOperator || 'AND'}`
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
      
      // Check if combo criteria are met with AND/OR logic
      let comboMet = false;
      
      if (combo.cards.length === 1) {
        // Single card combo - just check the one card
        const card = combo.cards[0];
        const drawnCount = cardCounts[0];
        comboMet = (drawnCount >= card.minCopiesInHand && drawnCount <= card.maxCopiesInHand);
      } else {
        // Multi-card combo: 1st AND 2nd AND/OR 3rd+ cards
        const firstCard = combo.cards[0];
        const firstCardMet = (cardCounts[0] >= firstCard.minCopiesInHand && cardCounts[0] <= firstCard.maxCopiesInHand);
        
        if (combo.cards.length === 2) {
          // Two-card combo: 1st AND 2nd
          const secondCard = combo.cards[1];
          const secondCardMet = (cardCounts[1] >= secondCard.minCopiesInHand && cardCounts[1] <= secondCard.maxCopiesInHand);
          comboMet = firstCardMet && secondCardMet;
        } else {
          // Three+ card combo: 1st AND 2nd, then AND/OR for 3rd+ cards
          const secondCard = combo.cards[1];
          const secondCardMet = (cardCounts[1] >= secondCard.minCopiesInHand && cardCounts[1] <= secondCard.maxCopiesInHand);
          
          // First two cards must be met (AND logic)
          let baseResult = firstCardMet && secondCardMet;
          
          // Process 3rd+ cards with their logic operators against the base (1st AND 2nd)
          for (let cardIndex = 2; cardIndex < combo.cards.length; cardIndex++) {
            const card = combo.cards[cardIndex];
            const drawnCount = cardCounts[cardIndex];
            const cardMet = (drawnCount >= card.minCopiesInHand && drawnCount <= card.maxCopiesInHand);
            const logicOp = card.logicOperator || 'AND';
            
            if (logicOp === 'AND') {
              baseResult = baseResult && cardMet;
            } else if (logicOp === 'OR') {
              baseResult = baseResult || cardMet;
            }
          }
          
          comboMet = baseResult;
        }
      }
      
      if (comboMet) {
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
        let comboSucceeds = false;
        
        if (combo.cards.length === 1) {
          // Single card combo
          const card = combo.cards[0];
          const cardKey = `${card.starterCard}-${card.cardId || 'custom'}`;
          const cardInfo = allUniqueCards.get(cardKey);
          const drawnCount = handCounts.get(cardInfo.id) || 0;
          comboSucceeds = (drawnCount >= card.minCopiesInHand && drawnCount <= card.maxCopiesInHand);
        } else {
          // Multi-card combo: 1st AND 2nd AND/OR 3rd+ cards
          const firstCard = combo.cards[0];
          const firstCardKey = `${firstCard.starterCard}-${firstCard.cardId || 'custom'}`;
          const firstCardInfo = allUniqueCards.get(firstCardKey);
          const firstDrawnCount = handCounts.get(firstCardInfo.id) || 0;
          const firstCardMet = (firstDrawnCount >= firstCard.minCopiesInHand && firstDrawnCount <= firstCard.maxCopiesInHand);
          
          if (combo.cards.length === 2) {
            // Two-card combo: 1st AND 2nd
            const secondCard = combo.cards[1];
            const secondCardKey = `${secondCard.starterCard}-${secondCard.cardId || 'custom'}`;
            const secondCardInfo = allUniqueCards.get(secondCardKey);
            const secondDrawnCount = handCounts.get(secondCardInfo.id) || 0;
            const secondCardMet = (secondDrawnCount >= secondCard.minCopiesInHand && secondDrawnCount <= secondCard.maxCopiesInHand);
            comboSucceeds = firstCardMet && secondCardMet;
          } else {
            // Three+ card combo: 1st AND 2nd, then AND/OR for 3rd+ cards
            const secondCard = combo.cards[1];
            const secondCardKey = `${secondCard.starterCard}-${secondCard.cardId || 'custom'}`;
            const secondCardInfo = allUniqueCards.get(secondCardKey);
            const secondDrawnCount = handCounts.get(secondCardInfo.id) || 0;
            const secondCardMet = (secondDrawnCount >= secondCard.minCopiesInHand && secondDrawnCount <= secondCard.maxCopiesInHand);
            
            // First two cards must be met (AND logic)
            let baseResult = firstCardMet && secondCardMet;
            
            // Process 3rd+ cards with their logic operators against the base (1st AND 2nd)
            for (let cardIndex = 2; cardIndex < combo.cards.length; cardIndex++) {
              const card = combo.cards[cardIndex];
              const cardKey = `${card.starterCard}-${card.cardId || 'custom'}`;
              const cardInfo = allUniqueCards.get(cardKey);
              const drawnCount = handCounts.get(cardInfo.id) || 0;
              const cardMet = (drawnCount >= card.minCopiesInHand && drawnCount <= card.maxCopiesInHand);
              const logicOp = card.logicOperator || 'AND';
              
              if (logicOp === 'AND') {
                baseResult = baseResult && cardMet;
              } else if (logicOp === 'OR') {
                baseResult = baseResult || cardMet;
              }
            }
            
            comboSucceeds = baseResult;
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

  /**
   * Calculate opening hand-trap probability for a deck
   * @param {Array} ydkCards - Array of cards in the deck
   * @param {Object} ydkCardCounts - Card counts in the deck
   * @param {number} deckSize - Total deck size
   * @param {number} handSize - Hand size to draw
   * @param {number} simulations - Number of simulations to run (default: 100000)
   * @returns {number} Probability percentage of opening at least one hand-trap
   */
  calculateHandTrapProbability(ydkCards, ydkCardCounts, deckSize, handSize, simulations = 100000) {
    if (!ydkCards || !ydkCardCounts) {
      return 0;
    }

    // Get all hand-trap cards in the deck
    const handTrapCards = ydkCards.filter(card => HandTrapService.isHandTrap(card));
    
    if (handTrapCards.length === 0) {
      return 0; // No hand-traps in deck
    }

    // Create deck array with hand-traps marked
    const deck = [];
    let handTrapCardId = 1;
    const nonHandTrapCardId = 0;

    // Add hand-trap cards to deck
    handTrapCards.forEach(card => {
      const cardCount = ydkCardCounts[card.name] || 0;
      for (let i = 0; i < cardCount; i++) {
        deck.push(handTrapCardId);
      }
    });

    // Fill remaining deck with non-hand-trap cards
    while (deck.length < deckSize) {
      deck.push(nonHandTrapCardId);
    }

    let successCount = 0;

    for (let sim = 0; sim < simulations; sim++) {
      // Shuffle deck using Fisher-Yates algorithm
      const shuffledDeck = [...deck];
      for (let i = shuffledDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
      }

      // Draw opening hand and check for hand-traps
      let hasHandTrap = false;
      for (let i = 0; i < Math.min(handSize, shuffledDeck.length); i++) {
        if (shuffledDeck[i] === handTrapCardId) {
          hasHandTrap = true;
          break;
        }
      }

      if (hasHandTrap) {
        successCount++;
      }
    }

    return (successCount / simulations) * 100;
  }
}

// Export singleton instance
export default new ProbabilityService();