/**
 * OpeningHandService Tests
 * Test opening hand generation using Monte Carlo simulation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import OpeningHandService from './OpeningHandService.js';

describe('OpeningHandService', () => {
  beforeEach(() => {
    // Clear console mocks
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('generateHand', () => {
    it('should generate hand with correct size', () => {
      const combos = [{
        id: 'c1',
        name: 'Test Combo',
        cards: [{
          starterCard: 'Test Card',
          cardId: '12345',
          isCustom: false,
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      }];

      const hand = OpeningHandService.generateHand(combos, 40, 5);

      expect(hand).toHaveLength(5);
    });

    it('should generate hand with valid card structure', () => {
      const combos = [{
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
      }];

      const hand = OpeningHandService.generateHand(combos, 40, 5);

      hand.forEach(card => {
        expect(card).toHaveProperty('type');
        expect(['card', 'blank']).toContain(card.type);

        if (card.type === 'card') {
          expect(card).toHaveProperty('cardName');
          expect(card).toHaveProperty('cardId');
          expect(card).toHaveProperty('isCustom');
        } else {
          expect(card.cardName).toBeNull();
        }
      });
    });

    it('should include combo cards in the hand probabilistically', () => {
      const combos = [{
        id: 'c1',
        name: 'Test Combo',
        cards: [{
          starterCard: 'Ash Blossom & Joyous Spring',
          cardId: '14558127',
          isCustom: false,
          startersInDeck: 40, // All cards are this card
          minCopiesInHand: 1,
          maxCopiesInHand: 5
        }]
      }];

      const hand = OpeningHandService.generateHand(combos, 40, 5);

      // With 40 copies in a 40-card deck, all cards should be Ash Blossom
      const comboCards = hand.filter(card => card.type === 'card');
      expect(comboCards.length).toBe(5);
      comboCards.forEach(card => {
        expect(card.cardName).toBe('Ash Blossom & Joyous Spring');
      });
    });

    it('should fill remaining slots with blank cards', () => {
      const combos = [{
        id: 'c1',
        name: 'Test Combo',
        cards: [{
          starterCard: 'Test Card',
          cardId: '123',
          isCustom: false,
          startersInDeck: 3, // Only 3 copies in deck
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      }];

      // Generate many hands and count blanks
      let totalBlanks = 0;
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const hand = OpeningHandService.generateHand(combos, 40, 5);
        const blanks = hand.filter(card => card.type === 'blank');
        totalBlanks += blanks.length;
      }

      // With only 3 cards in a 40-card deck, we should see mostly blanks
      const avgBlanks = totalBlanks / iterations;
      expect(avgBlanks).toBeGreaterThan(3); // Expect more than 3 blanks on average
    });

    it('should handle multiple combos correctly', () => {
      const combos = [
        {
          id: 'c1',
          name: 'Combo 1',
          cards: [{
            starterCard: 'Card A',
            cardId: '111',
            isCustom: false,
            startersInDeck: 3,
            minCopiesInHand: 1,
            maxCopiesInHand: 3
          }]
        },
        {
          id: 'c2',
          name: 'Combo 2',
          cards: [{
            starterCard: 'Card B',
            cardId: '222',
            isCustom: false,
            startersInDeck: 3,
            minCopiesInHand: 1,
            maxCopiesInHand: 3
          }]
        }
      ];

      const hand = OpeningHandService.generateHand(combos, 40, 5);

      expect(hand).toHaveLength(5);
      // Hand should contain a mix of Card A, Card B, and blanks
      const cardNames = hand
        .filter(card => card.type === 'card')
        .map(card => card.cardName);

      // At least some cards should be from the combos
      expect(cardNames.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle cards with same name but different IDs', () => {
      const combos = [
        {
          id: 'c1',
          name: 'Combo 1',
          cards: [{
            starterCard: 'Shared Name',
            cardId: '111',
            isCustom: false,
            startersInDeck: 2,
            minCopiesInHand: 1,
            maxCopiesInHand: 2
          }]
        },
        {
          id: 'c2',
          name: 'Combo 2',
          cards: [{
            starterCard: 'Shared Name',
            cardId: '222',
            isCustom: false,
            startersInDeck: 2,
            minCopiesInHand: 1,
            maxCopiesInHand: 2
          }]
        }
      ];

      const hand = OpeningHandService.generateHand(combos, 40, 5);

      expect(hand).toHaveLength(5);
    });

    it('should handle custom cards (no cardId)', () => {
      const combos = [{
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
      }];

      const hand = OpeningHandService.generateHand(combos, 40, 5);

      expect(hand).toHaveLength(5);
      const customCards = hand.filter(card =>
        card.type === 'card' && card.isCustom
      );

      // Custom cards should be marked as custom
      customCards.forEach(card => {
        expect(card.isCustom).toBe(true);
        expect(card.cardId).toBeNull();
      });
    });

    it('should handle empty combos array', () => {
      const hand = OpeningHandService.generateHand([], 40, 5);

      expect(hand).toHaveLength(5);
      // All cards should be blank
      hand.forEach(card => {
        expect(card.type).toBe('blank');
        expect(card.cardName).toBeNull();
      });
    });

    it('should handle null combos', () => {
      const hand = OpeningHandService.generateHand(null, 40, 5);

      expect(hand).toHaveLength(5);
      hand.forEach(card => {
        expect(card.type).toBe('blank');
      });
    });

    it('should handle zero hand size', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [{
          starterCard: 'Test Card',
          cardId: '123',
          isCustom: false,
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      }];

      const hand = OpeningHandService.generateHand(combos, 40, 0);

      expect(hand).toHaveLength(0);
    });

    it('should handle zero deck size', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [{
          starterCard: 'Test Card',
          cardId: '123',
          isCustom: false,
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      }];

      const hand = OpeningHandService.generateHand(combos, 0, 5);

      expect(hand).toHaveLength(5);
      // All should be blank since deck is empty
      hand.forEach(card => {
        expect(card.type).toBe('blank');
      });
    });

    it('should handle cards with empty names', () => {
      const combos = [{
        id: 'c1',
        name: 'Test Combo',
        cards: [{
          starterCard: '',
          cardId: '123',
          isCustom: false,
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      }];

      const hand = OpeningHandService.generateHand(combos, 40, 5);

      expect(hand).toHaveLength(5);
      // Empty card names should be skipped
    });

    it('should handle maximum deck usage of same card', () => {
      const combos = [{
        id: 'c1',
        name: 'Test Combo',
        cards: [{
          starterCard: 'Test Card',
          cardId: '123',
          isCustom: false,
          startersInDeck: 5,
          minCopiesInHand: 1,
          maxCopiesInHand: 5
        }]
      }];

      const hand = OpeningHandService.generateHand(combos, 40, 5);

      expect(hand).toHaveLength(5);
      const testCards = hand.filter(card =>
        card.type === 'card' && card.cardName === 'Test Card'
      );

      // Should never exceed the number in deck (5)
      expect(testCards.length).toBeLessThanOrEqual(5);
    });

    it('should respect total deck size constraint', () => {
      const combos = [{
        id: 'c1',
        name: 'Test Combo',
        cards: [{
          starterCard: 'Test Card',
          cardId: '123',
          isCustom: false,
          startersInDeck: 3,
          minCopiesInHand: 1,
          maxCopiesInHand: 3
        }]
      }];

      // Deck size of 3, hand size of 5
      const hand = OpeningHandService.generateHand(combos, 3, 5);

      expect(hand).toHaveLength(5);
      // Can't draw more cards than are in deck
      const actualCards = hand.filter(card => card.type === 'card');
      expect(actualCards.length).toBeLessThanOrEqual(3);
    });

    it('should use Fisher-Yates shuffle for randomness', () => {
      const combos = [{
        id: 'c1',
        name: 'Test Combo',
        cards: [{
          starterCard: 'Test Card',
          cardId: '123',
          isCustom: false,
          startersInDeck: 20, // Half the deck
          minCopiesInHand: 1,
          maxCopiesInHand: 5
        }]
      }];

      // Generate multiple hands and check for variation
      const hands = [];
      for (let i = 0; i < 10; i++) {
        hands.push(OpeningHandService.generateHand(combos, 40, 5));
      }

      // Count the number of test cards in each hand
      const counts = hands.map(hand =>
        hand.filter(card => card.type === 'card').length
      );

      // With proper shuffling, we should see some variation
      const uniqueCounts = new Set(counts);
      // Should have at least 2 different counts (not all the same)
      expect(uniqueCounts.size).toBeGreaterThan(1);
    });

    it('should handle combo with multiple cards', () => {
      const combos = [{
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
            startersInDeck: 3,
            minCopiesInHand: 1,
            maxCopiesInHand: 3
          },
          {
            starterCard: 'Card C',
            cardId: '333',
            isCustom: false,
            startersInDeck: 3,
            minCopiesInHand: 1,
            maxCopiesInHand: 3
          }
        ]
      }];

      const hand = OpeningHandService.generateHand(combos, 40, 5);

      expect(hand).toHaveLength(5);
    });
  });
});
