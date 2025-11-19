/**
 * ProbabilityService - Core probability calculation engine for TCG scenarios
 *
 * This service handles Monte Carlo simulations for calculating the probability
 * of drawing specific card combinations in trading card games.
 *
 * Uses strict AND logic only - all cards in a combo must be drawn for success.
 */

import HandTrapService from './HandTrapService.js';

// Expression tree node classes for AND-only evaluation
class PredicateNode {
  constructor(cardIndex, minCopies, maxCopies) {
    this.cardIndex = cardIndex;
    this.minCopies = minCopies;
    this.maxCopies = maxCopies;
  }

  eval(cardCounts) {
    const count = cardCounts[this.cardIndex] || 0;
    return count >= this.minCopies && count <= this.maxCopies;
  }
}

class AndNode {
  constructor(left, right) {
    this.left = left;
    this.right = right;
  }

  eval(cardCounts) {
    return this.left.eval(cardCounts) && this.right.eval(cardCounts);
  }
}

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
   * All cards are connected with AND logic only
   */
  getCacheKey(combo, deckSize, handSize) {
    const cardsKey = combo.cards.map(card =>
      `${card.startersInDeck}-${card.minCopiesInHand}-${card.maxCopiesInHand}`
    ).join('|');
    return `${cardsKey}-${deckSize}-${handSize}`;
  }

  /**
   * Generates a cache key for multiple combos
   * All cards within each combo are connected with AND logic only
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
   * Validates combo configuration for edge cases
   * @param {Object} combo - The combo configuration
   * @param {number} deckSize - Total deck size
   * @param {number} handSize - Hand size to draw
   * @returns {Object} { valid: boolean, error: string }
   */
  validateCombo(combo, deckSize, handSize) {
    // Edge case: Check if deck composition is valid
    const totalCopiesInDeck = combo.cards.reduce((sum, card) => sum + card.startersInDeck, 0);
    if (totalCopiesInDeck > deckSize) {
      return { valid: false, error: 'Total card copies exceed deck size' };
    }

    // Edge case: Check for impossible constraints
    for (const card of combo.cards) {
      // Min copies can't exceed copies in deck
      if (card.minCopiesInHand > card.startersInDeck) {
        return { valid: false, error: `Min copies in hand (${card.minCopiesInHand}) exceeds copies in deck (${card.startersInDeck})` };
      }

      // Min copies can't exceed hand size
      if (card.minCopiesInHand > handSize) {
        return { valid: false, error: `Min copies in hand (${card.minCopiesInHand}) exceeds hand size (${handSize})` };
      }

      // Max copies can't be less than min copies
      if (card.maxCopiesInHand < card.minCopiesInHand) {
        return { valid: false, error: 'Max copies cannot be less than min copies' };
      }

      // Zero copies in deck means only count=0 can be satisfied
      if (card.startersInDeck === 0 && card.minCopiesInHand > 0) {
        return { valid: false, error: 'Card has 0 copies in deck but requires min > 0 in hand' };
      }
    }

    // Edge case: Sum of minimums can't exceed hand size
    const sumOfMins = combo.cards.reduce((sum, card) => sum + card.minCopiesInHand, 0);
    if (sumOfMins > handSize) {
      return { valid: false, error: `Sum of minimum copies (${sumOfMins}) exceeds hand size (${handSize})` };
    }

    return { valid: true };
  }

  /**
   * Builds an expression tree from combo cards using strict AND logic
   * All cards must be drawn for the combo to succeed
   *
   * Logic rules:
   * - Single card: returns a predicate for that card
   * - Multiple cards: chains all cards with AND operators
   * - Example: Card1 AND Card2 AND Card3 AND Card4
   *
   * @param {Array} cards - Array of card configurations
   * @returns {Object} Expression tree root node
   */
  buildExpressionTree(cards) {
    if (cards.length === 0) {
      return null;
    }

    if (cards.length === 1) {
      // Single card: just return the predicate
      return new PredicateNode(0, cards[0].minCopiesInHand, cards[0].maxCopiesInHand);
    }

    // Start with the first card as the root
    let root = new PredicateNode(0, cards[0].minCopiesInHand, cards[0].maxCopiesInHand);

    // Chain all remaining cards with AND operators
    for (let i = 1; i < cards.length; i++) {
      const card = cards[i];
      const predicate = new PredicateNode(i, card.minCopiesInHand, card.maxCopiesInHand);
      // Always use AND - no OR logic supported
      root = new AndNode(root, predicate);
    }

    return root;
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

    // Validate combo configuration
    const validation = this.validateCombo(combo, deckSize, handSize);
    if (!validation.valid) {
      console.warn('Invalid combo configuration:', validation.error);
      return 0; // Impossible scenario returns 0%
    }

    // Build expression tree for proper AND/OR evaluation
    const expressionTree = this.buildExpressionTree(combo.cards);
    if (!expressionTree) {
      return 0;
    }

    let successes = 0;

    for (let i = 0; i < simulations; i++) {
      // Build deck as multiset of card labels
      const deck = [];

      // Add cards to deck based on combo requirements
      combo.cards.forEach((card, cardIndex) => {
        for (let j = 0; j < card.startersInDeck; j++) {
          deck.push(cardIndex);
        }
      });

      // Fill remaining deck slots with "Other" cards (-1)
      const otherCount = deckSize - deck.length;
      for (let j = 0; j < otherCount; j++) {
        deck.push(-1);
      }

      // Shuffle deck using Fisher-Yates algorithm (uniform random sampling)
      for (let j = deck.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [deck[j], deck[k]] = [deck[k], deck[j]];
      }

      // Draw hand (first handSize cards after shuffle = random sample without replacement)
      const cardCounts = new Array(combo.cards.length).fill(0);
      for (let j = 0; j < handSize; j++) {
        if (deck[j] >= 0) {
          cardCounts[deck[j]]++;
        }
      }

      // Evaluate expression tree
      if (expressionTree.eval(cardCounts)) {
        successes++;
      }
    }

    const probability = (successes / simulations) * 100;
    this.resultCache.set(cacheKey, probability);

    return probability;
  }

  /**
   * Runs Monte Carlo simulation for multiple combos (OR logic between combos)
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

    // Create a unified card mapping for all combos
    // Cards are identified by their unique name + cardId combination
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
        // Use maximum copies in deck across all combos
        allUniqueCards.get(cardKey).totalInDeck = Math.max(
          allUniqueCards.get(cardKey).totalInDeck,
          card.startersInDeck
        );
      });
    });

    // Build expression trees for each combo
    const comboTrees = combos.map(combo => {
      // Map combo cards to global card IDs
      const cardsWithGlobalIds = combo.cards.map(card => {
        const cardKey = `${card.starterCard}-${card.cardId || 'custom'}`;
        const globalCardInfo = allUniqueCards.get(cardKey);
        return {
          ...card,
          globalCardId: globalCardInfo.id
        };
      });

      return {
        tree: this.buildExpressionTreeForGlobalCards(cardsWithGlobalIds),
        cards: cardsWithGlobalIds
      };
    });

    let successes = 0;

    for (let i = 0; i < simulations; i++) {
      const deck = [];

      // Build deck with all unique cards
      allUniqueCards.forEach((cardInfo) => {
        for (let j = 0; j < cardInfo.totalInDeck; j++) {
          deck.push(cardInfo.id);
        }
      });

      // Fill remaining deck slots with "Other" cards
      const otherCount = deckSize - deck.length;
      for (let j = 0; j < otherCount; j++) {
        deck.push(-1);
      }

      // Shuffle deck
      for (let j = deck.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [deck[j], deck[k]] = [deck[k], deck[j]];
      }

      // Count cards in hand using global card IDs
      const globalHandCounts = new Map();
      allUniqueCards.forEach((cardInfo) => {
        globalHandCounts.set(cardInfo.id, 0);
      });

      for (let j = 0; j < handSize; j++) {
        if (deck[j] >= 0) {
          globalHandCounts.set(deck[j], (globalHandCounts.get(deck[j]) || 0) + 1);
        }
      }

      // Check if ANY combo succeeds (OR logic between combos)
      let anyComboSucceeds = false;

      for (const comboTree of comboTrees) {
        if (comboTree.tree && comboTree.tree.eval(globalHandCounts)) {
          anyComboSucceeds = true;
          break; // Short-circuit: at least one combo succeeded
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
   * Builds expression tree using global card IDs (for combined simulation)
   * Uses strict AND logic only - all cards must be drawn
   * @param {Array} cards - Array of cards with globalCardId
   * @returns {Object} Expression tree root node
   */
  buildExpressionTreeForGlobalCards(cards) {
    if (cards.length === 0) {
      return null;
    }

    if (cards.length === 1) {
      return new PredicateNodeGlobal(
        cards[0].globalCardId,
        cards[0].minCopiesInHand,
        cards[0].maxCopiesInHand
      );
    }

    let root = new PredicateNodeGlobal(
      cards[0].globalCardId,
      cards[0].minCopiesInHand,
      cards[0].maxCopiesInHand
    );

    // Chain all cards with AND operators only
    for (let i = 1; i < cards.length; i++) {
      const card = cards[i];
      const predicate = new PredicateNodeGlobal(
        card.globalCardId,
        card.minCopiesInHand,
        card.maxCopiesInHand
      );
      // Always use AND - no OR logic supported
      root = new AndNode(root, predicate);
    }

    return root;
  }

  /**
   * Identifies independent combo starters (unique first cards)
   * @param {Array} combos - Array of combo configurations
   * @returns {Array} Array of unique starter cards with their deck counts
   */
  getIndependentStarters(combos) {
    const starterMap = new Map();

    combos.forEach(combo => {
      if (combo.cards && combo.cards.length > 0) {
        const firstCard = combo.cards[0];
        const cardKey = `${firstCard.starterCard}-${firstCard.cardId || 'custom'}`;

        if (!starterMap.has(cardKey)) {
          starterMap.set(cardKey, {
            name: firstCard.starterCard,
            cardId: firstCard.cardId,
            copiesInDeck: firstCard.startersInDeck
          });
        } else {
          // Use maximum copies across all combos
          const existing = starterMap.get(cardKey);
          existing.copiesInDeck = Math.max(existing.copiesInDeck, firstCard.startersInDeck);
        }
      }
    });

    return Array.from(starterMap.values());
  }

  /**
   * Calculates probability of opening N or more independent combo starters
   * @param {Array} independentStarters - Array of unique starter cards
   * @param {number} minStarters - Minimum number of different starters required (2 or 3)
   * @param {number} deckSize - Total deck size
   * @param {number} handSize - Hand size to draw
   * @param {number} simulations - Number of simulations to run (default: 100000)
   * @returns {number} Probability percentage
   */
  calculateMultiStarterProbability(independentStarters, minStarters, deckSize, handSize, simulations = 100000) {
    if (independentStarters.length < minStarters) {
      return 0;
    }

    let successes = 0;

    for (let i = 0; i < simulations; i++) {
      const deck = [];

      // Build deck with starter cards
      independentStarters.forEach((starter, starterIndex) => {
        for (let j = 0; j < starter.copiesInDeck; j++) {
          deck.push(starterIndex);
        }
      });

      // Fill remaining deck slots with "Other" cards
      const otherCount = deckSize - deck.length;
      for (let j = 0; j < otherCount; j++) {
        deck.push(-1);
      }

      // Shuffle deck using Fisher-Yates algorithm
      for (let j = deck.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [deck[j], deck[k]] = [deck[k], deck[j]];
      }

      // Count unique starters in hand
      const startersInHand = new Set();
      for (let j = 0; j < handSize; j++) {
        if (deck[j] >= 0) {
          startersInHand.add(deck[j]);
        }
      }

      // Check if we have at least minStarters different starters
      if (startersInHand.size >= minStarters) {
        successes++;
      }
    }

    return (successes / simulations) * 100;
  }

  /**
   * Calculates probabilities for multiple combos
   * @param {Array} combos - Array of combo configurations
   * @param {number} deckSize - Total deck size
   * @param {number} handSize - Hand size to draw
   * @param {Array} ydkCards - Optional array of cards in the deck (for hand-trap calculations)
   * @param {Object} ydkCardCounts - Optional card counts in the deck (for hand-trap calculations)
   * @returns {Object} Object containing individual and combined results
   */
  calculateMultipleCombos(combos, deckSize, handSize, ydkCards = null, ydkCardCounts = null) {
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

    // Calculate multi-starter probabilities
    const independentStarters = this.getIndependentStarters(combos);
    let multiStarter = null;

    if (independentStarters.length >= 2) {
      multiStarter = {
        independentStarters: independentStarters.length,
        twoPlus: this.calculateMultiStarterProbability(independentStarters, 2, deckSize, handSize)
      };

      // Only calculate 3+ if there are at least 3 independent starters
      if (independentStarters.length >= 3) {
        multiStarter.threePlus = this.calculateMultiStarterProbability(independentStarters, 3, deckSize, handSize);
      }
    }

    // Calculate multi-hand-trap probabilities (AC#1-AC#9)
    let multiHandTrap = null;
    if (ydkCards && ydkCardCounts) {
      const uniqueHandTraps = this.getUniqueHandTraps(ydkCards, ydkCardCounts);

      // AC#1: Only show if deck has 2+ unique hand-traps
      if (uniqueHandTraps.length >= 2) {
        multiHandTrap = {
          uniqueHandTraps: uniqueHandTraps.length,
          twoPlus: this.calculateMultiHandTrapProbability(ydkCards, ydkCardCounts, 2, deckSize, handSize)
        };

        // AC#8: Calculate 3+ if there are at least 3 unique hand-traps
        if (uniqueHandTraps.length >= 3) {
          multiHandTrap.threePlus = this.calculateMultiHandTrapProbability(ydkCards, ydkCardCounts, 3, deckSize, handSize);
        }

        // AC#9: Calculate 4+ if there are at least 4 unique hand-traps
        if (uniqueHandTraps.length >= 4) {
          multiHandTrap.fourPlus = this.calculateMultiHandTrapProbability(ydkCards, ydkCardCounts, 4, deckSize, handSize);
        }
      }
    }

    return {
      individual: individualResults,
      combined: combinedProbability,
      multiStarter: multiStarter,
      multiHandTrap: multiHandTrap
    };
  }

  /**
   * Helper function to calculate binomial coefficient (n choose k)
   * @param {number} n - Total items
   * @param {number} k - Items to choose
   * @returns {number} Binomial coefficient
   */
  binomial(n, k) {
    if (k > n || k < 0) return 0;
    if (k === 0 || k === n) return 1;

    let result = 1;
    for (let i = 0; i < Math.min(k, n - k); i++) {
      result = result * (n - i) / (i + 1);
    }
    return result;
  }

  /**
   * Calculate hypergeometric probability
   * Used for exact probability calculations (not Monte Carlo)
   * @param {number} N - Population size (deck size)
   * @param {number} K - Success states in population (copies in deck)
   * @param {number} n - Sample size (hand size)
   * @param {number} k - Number of successes in sample (copies in hand)
   * @returns {number} Probability percentage
   */
  calculateHypergeometricProbability(N, K, n, k) {
    const numerator = this.binomial(K, k) * this.binomial(N - K, n - k);
    const denominator = this.binomial(N, n);
    return (numerator / denominator) * 100;
  }

  /**
   * Generate formula data for display purposes
   * @param {Object} result - Calculation result containing cards and probability
   * @param {number} deckSize - Total deck size
   * @param {number} handSize - Hand size to draw
   * @returns {Object} Formula data structure for display
   */
  generateFormulaData(result, deckSize, handSize) {
    if (!result || !result.cards || result.cards.length === 0) {
      return {
        type: 'error',
        scenarios: [],
        totalPercentage: '0.00%',
        metadata: { totalCards: deckSize, handSize }
      };
    }

    const card = result.cards[0]; // For single card scenarios

    if (result.cards.length === 1) {
      const N = deckSize; // Population size
      const K = card.startersInDeck; // Success states in population
      const n = handSize; // Sample size
      const k_min = card.minCopiesInHand;
      const k_max = card.maxCopiesInHand;

      if (k_min === k_max) {
        // Exact probability - single line
        const k = k_min;
        const probability = this.calculateHypergeometricProbability(N, K, n, k);

        return {
          type: 'exact',
          scenarios: [{
            probability,
            n: K,
            k,
            remaining: N - K,
            drawn: n - k,
            percentage: `${probability.toFixed(2)}%`
          }],
          totalPercentage: `${probability.toFixed(2)}%`,
          metadata: { totalCards: N, handSize: n }
        };
      } else {
        // Range probability - multiple lines with sum
        const scenarios = [];
        let totalProbability = 0;

        for (let k = k_min; k <= k_max; k++) {
          const probability = this.calculateHypergeometricProbability(N, K, n, k);
          totalProbability += probability;

          scenarios.push({
            probability,
            n: K,
            k,
            remaining: N - K,
            drawn: n - k,
            percentage: `${probability.toFixed(2)}%`
          });
        }

        return {
          type: 'range',
          scenarios,
          totalPercentage: `${totalProbability.toFixed(2)}%`,
          metadata: { totalCards: N, handSize: n }
        };
      }
    } else {
      // Multi-card combo - show individual card probabilities with full range expansion
      const scenarios = [];

      result.cards.forEach((card, cardIndex) => {
        const N = deckSize;
        const K = card.startersInDeck;
        const n = handSize;
        const k_min = card.minCopiesInHand;
        const k_max = card.maxCopiesInHand;

        // Add card header for multi-card display
        if (cardIndex > 0) {
          scenarios.push({
            isCardDivider: true,
            cardName: card.starterCard,
            logicOperator: card.logicOperator || 'AND'
          });
        } else {
          scenarios.push({
            isCardHeader: true,
            cardName: card.starterCard
          });
        }

        if (k_min === k_max) {
          // Exact probability for this card
          const k = k_min;
          const probability = this.calculateHypergeometricProbability(N, K, n, k);

          scenarios.push({
            probability,
            n: K,
            k,
            remaining: N - K,
            drawn: n - k,
            percentage: `${probability.toFixed(2)}%`,
            cardName: card.starterCard,
            isCardContent: true
          });
        } else {
          // Range probability for this card - show ALL individual P(X=k) scenarios
          for (let k = k_min; k <= k_max; k++) {
            const probability = this.calculateHypergeometricProbability(N, K, n, k);

            scenarios.push({
              probability,
              n: K,
              k,
              remaining: N - K,
              drawn: n - k,
              percentage: `${probability.toFixed(2)}%`,
              cardName: card.starterCard,
              isCardContent: true
            });
          }
        }
      });

      return {
        type: 'multi-card',
        scenarios,
        totalPercentage: `${result.probability.toFixed(2)}% (Monte Carlo)`,
        metadata: {
          totalCards: deckSize,
          handSize,
          cardCount: result.cards.length,
          logicOperator: result.cards.length > 1 ? (result.cards[1].logicOperator || 'AND') : 'AND'
        }
      };
    }
  }

  /**
   * Generate combined formula data for multiple combos
   * @param {Array} results - Array of individual combo results
   * @returns {Object} Combined formula data structure for display
   */
  generateCombinedFormulaData(results) {
    if (!results || results.length === 0) {
      return {
        type: 'combined',
        scenarios: [],
        totalPercentage: '0.00%',
        metadata: { totalCards: 0, handSize: 0 }
      };
    }

    if (results.length === 1) {
      return {
        type: 'combined',
        scenarios: [{
          probability: results[0].probability,
          n: 0,
          k: 0,
          remaining: 0,
          drawn: 0,
          percentage: 'P(Any Combo) = P(Combo 1)'
        }],
        totalPercentage: `${results[0].probability.toFixed(2)}%`,
        metadata: { totalCards: 0, handSize: 0 }
      };
    }

    // Calculate combined probability using inclusion-exclusion principle
    const combinedProbability = results.reduce((sum, result) => sum + result.probability, 0);

    return {
      type: 'combined',
      scenarios: [{
        probability: combinedProbability,
        n: 0,
        k: 0,
        remaining: 0,
        drawn: 0,
        percentage: `Using inclusion-exclusion principle for ${results.length} combos`
      }],
      totalPercentage: `${combinedProbability.toFixed(2)}%`,
      metadata: { totalCards: 0, handSize: 0 }
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

  /**
   * Get unique hand-trap cards from a deck
   * @param {Array} ydkCards - Array of cards in the deck
   * @param {Object} ydkCardCounts - Card counts in the deck
   * @returns {Array} Array of unique hand-trap cards with their counts
   */
  getUniqueHandTraps(ydkCards, ydkCardCounts) {
    if (!ydkCards || !ydkCardCounts) {
      return [];
    }

    // Get all hand-trap cards in the deck
    const handTrapCards = ydkCards.filter(card => HandTrapService.isHandTrap(card));

    // Map to unique hand-trap cards with their counts
    return handTrapCards.map(card => ({
      name: card.name,
      cardId: card.id,
      copiesInDeck: ydkCardCounts[card.name] || 0
    }));
  }

  /**
   * Calculate probability of opening N or more different hand-trap cards
   * @param {Array} ydkCards - Array of cards in the deck
   * @param {Object} ydkCardCounts - Card counts in the deck
   * @param {number} minDifferentHandTraps - Minimum number of different hand-traps required (2, 3, or 4)
   * @param {number} deckSize - Total deck size
   * @param {number} handSize - Hand size to draw
   * @param {number} simulations - Number of simulations to run (default: 100000)
   * @returns {number} Probability percentage
   */
  calculateMultiHandTrapProbability(ydkCards, ydkCardCounts, minDifferentHandTraps, deckSize, handSize, simulations = 100000) {
    if (!ydkCards || !ydkCardCounts) {
      return 0;
    }

    // Get unique hand-trap cards
    const uniqueHandTraps = this.getUniqueHandTraps(ydkCards, ydkCardCounts);

    // AC#2: If deck doesn't have enough unique hand-traps, return 0%
    if (uniqueHandTraps.length < minDifferentHandTraps) {
      return 0;
    }

    let successes = 0;

    for (let i = 0; i < simulations; i++) {
      const deck = [];

      // Build deck with unique hand-trap cards (each gets a unique ID)
      uniqueHandTraps.forEach((handTrap, handTrapIndex) => {
        for (let j = 0; j < handTrap.copiesInDeck; j++) {
          deck.push(handTrapIndex);
        }
      });

      // Fill remaining deck slots with "Other" cards
      const otherCount = deckSize - deck.length;
      for (let j = 0; j < otherCount; j++) {
        deck.push(-1);
      }

      // Shuffle deck using Fisher-Yates algorithm
      for (let j = deck.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [deck[j], deck[k]] = [deck[k], deck[j]];
      }

      // Count unique hand-traps in opening hand
      const uniqueHandTrapsInHand = new Set();
      for (let j = 0; j < handSize; j++) {
        if (deck[j] >= 0) {
          uniqueHandTrapsInHand.add(deck[j]);
        }
      }

      // Check if we have at least minDifferentHandTraps different hand-traps
      if (uniqueHandTrapsInHand.size >= minDifferentHandTraps) {
        successes++;
      }
    }

    return (successes / simulations) * 100;
  }
}

// Predicate node for global card IDs (used in combined simulation)
class PredicateNodeGlobal {
  constructor(globalCardId, minCopies, maxCopies) {
    this.globalCardId = globalCardId;
    this.minCopies = minCopies;
    this.maxCopies = maxCopies;
  }

  eval(globalHandCounts) {
    const count = globalHandCounts.get(this.globalCardId) || 0;
    return count >= this.minCopies && count <= this.maxCopies;
  }
}

// Export singleton instance
export default new ProbabilityService();
