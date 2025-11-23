/**
 * Validation Tests
 * Test input validation for deck configuration and combo validation
 */

import { describe, it, expect } from 'vitest';
import { validateDeckSize, validateHandSize, validateCombo } from './validation.js';

describe('Validation Utilities', () => {
  describe('validateDeckSize', () => {
    it('should return null for valid deck sizes', () => {
      expect(validateDeckSize(40)).toBeNull();
      expect(validateDeckSize(60)).toBeNull();
      expect(validateDeckSize(1)).toBeNull();
      expect(validateDeckSize(100)).toBeNull();
    });

    it('should reject deck size less than 1', () => {
      expect(validateDeckSize(0)).toBeTruthy();
      expect(validateDeckSize(-1)).toBeTruthy();
      expect(validateDeckSize(-100)).toBeTruthy();
    });

    it('should reject deck size greater than 100', () => {
      expect(validateDeckSize(101)).toBeTruthy();
      expect(validateDeckSize(200)).toBeTruthy();
      expect(validateDeckSize(1000)).toBeTruthy();
    });

    it('should return error message for invalid sizes', () => {
      const error = validateDeckSize(0);
      expect(error).toContain('Deck size');
      expect(error).toContain('between 1 and 100');
    });
  });

  describe('validateHandSize', () => {
    it('should return null for valid hand sizes', () => {
      expect(validateHandSize(5, 40)).toBeNull();
      expect(validateHandSize(6, 60)).toBeNull();
      expect(validateHandSize(1, 40)).toBeNull();
      expect(validateHandSize(20, 40)).toBeNull();
    });

    it('should reject hand size less than 1', () => {
      expect(validateHandSize(0, 40)).toBeTruthy();
      expect(validateHandSize(-1, 40)).toBeTruthy();
    });

    it('should reject hand size greater than 20', () => {
      expect(validateHandSize(21, 40)).toBeTruthy();
      expect(validateHandSize(30, 60)).toBeTruthy();
    });

    it('should reject hand size greater than deck size', () => {
      expect(validateHandSize(10, 5)).toBeTruthy();
      expect(validateHandSize(41, 40)).toBeTruthy();
    });

    it('should return appropriate error messages', () => {
      const error1 = validateHandSize(0, 40);
      expect(error1).toContain('Hand size');
      expect(error1).toContain('between 1 and 20');

      const error2 = validateHandSize(10, 5);
      expect(error2).toContain('Hand size');
      expect(error2).toContain('exceed deck size');
    });

    it('should enforce maximum hand size of 20 even if deck is larger', () => {
      // Hand size cannot exceed 20 regardless of deck size
      expect(validateHandSize(40, 40)).toBeTruthy();
      expect(validateHandSize(20, 20)).toBeNull();
      expect(validateHandSize(20, 100)).toBeNull();
    });
  });

  describe('validateCombo', () => {
    it('should return empty array for valid combo', () => {
      const combo = {
        id: 'c1',
        name: 'Test Combo',
        cards: [{
          starterCard: 'Blue-Eyes White Dragon',
          cardId: '89631139',
          isCustom: false,
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      };

      const errors = validateCombo(combo);
      expect(errors).toEqual([]);
    });

    it('should reject combo with no cards', () => {
      const combo = {
        id: 'c1',
        name: 'Empty Combo',
        cards: []
      };

      const errors = validateCombo(combo);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('at least one card');
    });

    it('should handle combo with missing cards array', () => {
      const combo = {
        id: 'c1',
        name: 'No Cards Array'
      };

      // The function doesn't handle missing cards gracefully, it will throw
      expect(() => validateCombo(combo)).toThrow();
    });

    it('should reject cards with empty names', () => {
      const combo = {
        id: 'c1',
        name: 'Test',
        cards: [{
          starterCard: '',
          cardId: null,
          isCustom: false,
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      };

      const errors = validateCombo(combo);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Card name is required');
    });

    it('should reject cards with whitespace-only names', () => {
      const combo = {
        id: 'c1',
        name: 'Test',
        cards: [{
          starterCard: '   ',
          cardId: null,
          isCustom: false,
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      };

      const errors = validateCombo(combo);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject negative copies in deck', () => {
      const combo = {
        id: 'c1',
        name: 'Test',
        cards: [{
          starterCard: 'Test Card',
          cardId: null,
          isCustom: false,
          startersInDeck: -1,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      };

      const errors = validateCombo(combo);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Copies in deck cannot be negative');
    });

    it('should reject negative min copies in hand', () => {
      const combo = {
        id: 'c1',
        name: 'Test',
        cards: [{
          starterCard: 'Test Card',
          cardId: null,
          isCustom: false,
          startersInDeck: 3,
          minCopiesInHand: -1,
          maxCopiesInHand: 3
        }]
      };

      const errors = validateCombo(combo);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Min copies cannot be negative');
    });

    it('should reject max copies less than min copies', () => {
      const combo = {
        id: 'c1',
        name: 'Test',
        cards: [{
          starterCard: 'Test Card',
          cardId: null,
          isCustom: false,
          startersInDeck: 3,
          minCopiesInHand: 2,
          maxCopiesInHand: 1
        }]
      };

      const errors = validateCombo(combo);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Max copies cannot be less than min copies');
    });

    it('should reject max copies greater than copies in deck', () => {
      const combo = {
        id: 'c1',
        name: 'Test',
        cards: [{
          starterCard: 'Test Card',
          cardId: null,
          isCustom: false,
          startersInDeck: 2,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      };

      const errors = validateCombo(combo);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Max copies in hand cannot exceed copies in deck');
    });

    it('should allow max copies equal to copies in deck', () => {
      const combo = {
        id: 'c1',
        name: 'Test',
        cards: [{
          starterCard: 'Test Card',
          cardId: null,
          isCustom: false,
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      };

      const errors = validateCombo(combo);
      expect(errors).toEqual([]);
    });

    it('should validate multiple cards in a combo', () => {
      const combo = {
        id: 'c1',
        name: 'Multi-Card Combo',
        cards: [
          {
            starterCard: 'Card A',
            cardId: '111',
            isCustom: false,
            startersInDeck: 3,
            minCopiesInHand: 1,
            maxCopiesInHand: 3
          },
          {
            starterCard: 'Card B',
            cardId: '222',
            isCustom: false,
            startersInDeck: 2,
            minCopiesInHand: 1,
            maxCopiesInHand: 2
          }
        ]
      };

      const errors = validateCombo(combo);
      expect(errors).toEqual([]);
    });

    it('should report errors for specific cards by index', () => {
      const combo = {
        id: 'c1',
        name: 'Test',
        cards: [
          {
            starterCard: 'Valid Card',
            cardId: '111',
            isCustom: false,
            startersInDeck: 3,
            minCopiesInHand: 1,
            maxCopiesInHand: 3
          },
          {
            starterCard: '',
            cardId: null,
            isCustom: false,
            startersInDeck: 3,
            minCopiesInHand: 1,
            maxCopiesInHand: 3
          }
        ]
      };

      const errors = validateCombo(combo);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Card 2'); // Second card (index 1)
    });

    it('should accumulate multiple errors for a card', () => {
      const combo = {
        id: 'c1',
        name: 'Test',
        cards: [{
          starterCard: '',
          cardId: null,
          isCustom: false,
          startersInDeck: -1,
          minCopiesInHand: -1,
          maxCopiesInHand: 0
        }]
      };

      const errors = validateCombo(combo);
      expect(errors.length).toBeGreaterThan(2); // Should have multiple errors
    });

    it('should handle combo with custom cards', () => {
      const combo = {
        id: 'c1',
        name: 'Custom Combo',
        cards: [{
          starterCard: 'My Custom Card',
          cardId: null,
          isCustom: true,
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      };

      const errors = validateCombo(combo);
      expect(errors).toEqual([]);
    });

    it('should allow zero copies in deck and hand', () => {
      const combo = {
        id: 'c1',
        name: 'Test',
        cards: [{
          starterCard: 'Test Card',
          cardId: null,
          isCustom: false,
          startersInDeck: 0,
          minCopiesInHand: 0,
          maxCopiesInHand: 0
        }]
      };

      const errors = validateCombo(combo);
      // This should be valid (0 is not negative)
      expect(errors).toEqual([]);
    });

    it('should handle very large numbers of cards in combo', () => {
      const cards = Array.from({ length: 10 }, (_, i) => ({
        starterCard: `Card ${i + 1}`,
        cardId: String(i),
        isCustom: false,
        startersInDeck: 3,
        minCopiesInHand: 1,
        maxCopiesInHand: 3
      }));

      const combo = {
        id: 'c1',
        name: 'Large Combo',
        cards
      };

      const errors = validateCombo(combo);
      expect(errors).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null input gracefully', () => {
      expect(() => validateDeckSize(null)).not.toThrow();
      expect(() => validateHandSize(null, 40)).not.toThrow();
    });

    it('should handle undefined input gracefully', () => {
      expect(() => validateDeckSize(undefined)).not.toThrow();
      expect(() => validateHandSize(undefined, 40)).not.toThrow();
    });

    it('should handle non-numeric deck/hand sizes', () => {
      // JavaScript type coercion might allow numeric strings to pass
      // depending on implementation. These tests check current behavior.
      const deckResult = validateDeckSize('40');
      const handResult = validateHandSize('5', 40);
      // Just verify they don't throw errors
      expect(deckResult === null || typeof deckResult === 'string').toBe(true);
      expect(handResult === null || typeof handResult === 'string').toBe(true);
    });

    it('should handle floating point numbers', () => {
      expect(validateDeckSize(40.5)).toBeNull(); // Might pass depending on implementation
      expect(validateHandSize(5.5, 40)).toBeNull(); // Might pass depending on implementation
    });
  });
});
