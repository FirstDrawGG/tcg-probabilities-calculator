import { describe, it, expect, beforeEach } from 'vitest';
import ProbabilityService from './ProbabilityService.js';

describe('ProbabilityService', () => {
  beforeEach(() => {
    // Clear cache before each test
    ProbabilityService.clearCache();
  });

  describe('Cache Management', () => {
    it('should clear cache when clearCache is called', () => {
      // Add something to cache
      const combo = {
        cards: [{
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      };
      
      ProbabilityService.monteCarloSimulation(combo, 40, 5, 1000);
      expect(ProbabilityService.resultCache.size).toBeGreaterThan(0);
      
      ProbabilityService.clearCache();
      expect(ProbabilityService.resultCache.size).toBe(0);
    });

    it('should generate consistent cache keys', () => {
      const combo = {
        cards: [{
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      };

      const key1 = ProbabilityService.getCacheKey(combo, 40, 5);
      const key2 = ProbabilityService.getCacheKey(combo, 40, 5);
      expect(key1).toBe(key2);

      const key3 = ProbabilityService.getCacheKey(combo, 40, 6);
      expect(key1).not.toBe(key3);
    });
  });

  describe('Monte Carlo Simulation', () => {
    it('should return 0% for impossible scenarios', () => {
      const combo = {
        cards: [{
          startersInDeck: 0, // No cards in deck
          minCopiesInHand: 1, // But need 1 in hand
          maxCopiesInHand: 3
        }]
      };

      const probability = ProbabilityService.monteCarloSimulation(combo, 40, 5, 1000);
      expect(probability).toBe(0);
    });

    it('should return 100% for guaranteed scenarios', () => {
      const combo = {
        cards: [{
          startersInDeck: 40, // All cards in deck are this card
          minCopiesInHand: 1,  // Need at least 1
          maxCopiesInHand: 5   // Max is hand size
        }]
      };

      const probability = ProbabilityService.monteCarloSimulation(combo, 40, 5, 1000);
      expect(probability).toBe(100);
    });

    it('should handle edge case with 0 cards in deck', () => {
      const combo = {
        cards: [{
          startersInDeck: 0,
          minCopiesInHand: 0,
          maxCopiesInHand: 0
        }]
      };

      const probability = ProbabilityService.monteCarloSimulation(combo, 40, 5, 1000);
      expect(probability).toBe(100); // Should succeed because we need 0 and get 0
    });

    it('should return reasonable probability for typical scenarios', () => {
      const combo = {
        cards: [{
          startersInDeck: 3, // 3 copies in 40 card deck
          minCopiesInHand: 1, // Need at least 1
          maxCopiesInHand: 3
        }]
      };

      const probability = ProbabilityService.monteCarloSimulation(combo, 40, 5, 10000);
      
      // Should be between 25% and 45% (rough hypergeometric expectation)
      expect(probability).toBeGreaterThan(25);
      expect(probability).toBeLessThan(45);
    });

    it('should use cache for repeated calculations', () => {
      const combo = {
        cards: [{
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      };

      const result1 = ProbabilityService.monteCarloSimulation(combo, 40, 5, 1000);
      const result2 = ProbabilityService.monteCarloSimulation(combo, 40, 5, 1000);
      
      // Should return exact same result from cache
      expect(result1).toBe(result2);
    });
  });

  describe('Multiple Combos Calculation', () => {
    it('should calculate individual probabilities correctly', () => {
      const combos = [
        {
          id: 'combo1',
          cards: [{
            starterCard: 'Card A',
            cardId: '1',
            startersInDeck: 3,
            minCopiesInHand: 1,
            maxCopiesInHand: 3
          }]
        },
        {
          id: 'combo2',
          cards: [{
            starterCard: 'Card B',
            cardId: '2',
            startersInDeck: 2,
            minCopiesInHand: 1,
            maxCopiesInHand: 2
          }]
        }
      ];

      const result = ProbabilityService.calculateMultipleCombos(combos, 40, 5);
      
      expect(result.individual).toHaveLength(2);
      expect(result.individual[0].id).toBe('combo1');
      expect(result.individual[1].id).toBe('combo2');
      expect(result.individual[0].probability).toBeGreaterThan(0);
      expect(result.individual[1].probability).toBeGreaterThan(0);
      expect(result.combined).not.toBeNull();
    });

    it('should not calculate combined probability for single combo', () => {
      const combos = [
        {
          id: 'combo1',
          cards: [{
            starterCard: 'Card A',
            cardId: '1',
            startersInDeck: 3,
            minCopiesInHand: 1,
            maxCopiesInHand: 3
          }]
        }
      ];

      const result = ProbabilityService.calculateMultipleCombos(combos, 40, 5);
      
      expect(result.individual).toHaveLength(1);
      expect(result.combined).toBeNull();
    });

    it('should handle empty combos array', () => {
      const result = ProbabilityService.calculateMultipleCombos([], 40, 5);
      
      expect(result.individual).toHaveLength(0);
      expect(result.combined).toBeNull();
    });
  });

  describe('Combined Monte Carlo Simulation', () => {
    it('should return higher probability than individual when combos dont overlap', () => {
      const combos = [
        {
          cards: [{
            starterCard: 'Card A',
            cardId: '1',
            startersInDeck: 2,
            minCopiesInHand: 1,
            maxCopiesInHand: 2
          }]
        },
        {
          cards: [{
            starterCard: 'Card B', 
            cardId: '2',
            startersInDeck: 2,
            minCopiesInHand: 1,
            maxCopiesInHand: 2
          }]
        }
      ];

      const individual1 = ProbabilityService.monteCarloSimulation(combos[0], 40, 5, 10000);
      const individual2 = ProbabilityService.monteCarloSimulation(combos[1], 40, 5, 10000);
      const combined = ProbabilityService.combinedMonteCarloSimulation(combos, 40, 5, 10000);

      // Combined should be higher than either individual (OR logic)
      expect(combined).toBeGreaterThan(individual1);
      expect(combined).toBeGreaterThan(individual2);
      
      // But less than sum (not independent events)
      expect(combined).toBeLessThan(individual1 + individual2);
    });
  });
});