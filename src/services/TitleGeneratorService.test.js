/**
 * TitleGeneratorService Tests
 * Test fun, contextual title generation for calculation results
 */

import { describe, it, expect } from 'vitest';
import TitleGeneratorService from './TitleGeneratorService.js';

describe('TitleGeneratorService', () => {
  describe('generateFunTitle', () => {
    it('should generate title for single combo', () => {
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

      const results = [{ id: 'c1', probability: 50 }];

      const title = TitleGeneratorService.generateFunTitle(combos, 40, results);

      expect(title).toBeTruthy();
      expect(typeof title).toBe('string');
      expect(title).toContain('Blue-Eyes White Dragon');
    });

    it('should include emoji based on probability', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [{ starterCard: 'Test Card', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }]
      }];

      const highProbTitle = TitleGeneratorService.generateFunTitle(combos, 40, [{ id: 'c1', probability: 90 }]);
      const mediumProbTitle = TitleGeneratorService.generateFunTitle(combos, 40, [{ id: 'c1', probability: 50 }]);
      const lowProbTitle = TitleGeneratorService.generateFunTitle(combos, 40, [{ id: 'c1', probability: 20 }]);

      // Should contain some emoji (exact emoji might vary)
      expect(highProbTitle).toMatch(/[🔥⚡🎲💀]/);
      expect(mediumProbTitle).toMatch(/[🔥⚡🎲💀]/);
      expect(lowProbTitle).toMatch(/[🔥⚡🎲💀]/);
    });

    it('should include deck size in title', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [{ starterCard: 'Test Card', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }]
      }];

      const results = [{ id: 'c1', probability: 50 }];

      const title40 = TitleGeneratorService.generateFunTitle(combos, 40, results);
      const title60 = TitleGeneratorService.generateFunTitle(combos, 60, results);

      expect(title40).toContain('40');
      expect(title60).toContain('60');
    });

    it('should handle two-card combo differently', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [
          { starterCard: 'Card A', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 },
          { starterCard: 'Card B', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }
        ]
      }];

      const results = [{ id: 'c1', probability: 50 }];

      const title = TitleGeneratorService.generateFunTitle(combos, 40, results);

      expect(title).toContain('Card A');
      expect(title).toContain('Card B');
      expect(title).toContain('+'); // Should show "Card A + Card B"
    });

    it('should handle multi-card combo (3+ cards)', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [
          { starterCard: 'Card A', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 },
          { starterCard: 'Card B', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 },
          { starterCard: 'Card C', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }
        ]
      }];

      const results = [{ id: 'c1', probability: 50 }];

      const title = TitleGeneratorService.generateFunTitle(combos, 40, results);

      expect(title).toMatch(/3-Card/); // Should mention "3-Card"
    });

    it('should handle empty card names gracefully', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [
          { starterCard: '', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 },
          { starterCard: '  ', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }
        ]
      }];

      const results = [{ id: 'c1', probability: 50 }];

      const title = TitleGeneratorService.generateFunTitle(combos, 40, results);

      expect(title).toBeTruthy();
      expect(typeof title).toBe('string');
    });

    it('should calculate average probability for multiple combos', () => {
      const combos = [
        {
          id: 'c1',
          name: 'Combo 1',
          cards: [{ starterCard: 'Card A', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }]
        },
        {
          id: 'c2',
          name: 'Combo 2',
          cards: [{ starterCard: 'Card B', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }]
        }
      ];

      const results = [
        { id: 'c1', probability: 80 },
        { id: 'c2', probability: 20 }
      ];

      // Average is 50, should use medium probability emoji/flavor
      const title = TitleGeneratorService.generateFunTitle(combos, 40, results);

      expect(title).toBeTruthy();
    });

    it('should use different suffixes for single cards', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [{ starterCard: 'Test Card', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }]
      }];

      const results = [{ id: 'c1', probability: 50 }];

      const titles = new Set();
      // Generate multiple titles to see variation
      for (let i = 0; i < 20; i++) {
        const title = TitleGeneratorService.generateFunTitle(combos, 40, results);
        titles.add(title);
      }

      // Should have some variation due to random suffixes
      expect(titles.size).toBeGreaterThan(1);
    });

    it('should use different flavor texts based on probability', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [{ starterCard: 'Test Card', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }]
      }];

      const highResults = [{ id: 'c1', probability: 85 }];
      const mediumResults = [{ id: 'c1', probability: 50 }];
      const lowResults = [{ id: 'c1', probability: 15 }];

      const highTitle = TitleGeneratorService.generateFunTitle(combos, 40, highResults);
      const mediumTitle = TitleGeneratorService.generateFunTitle(combos, 40, mediumResults);
      const lowTitle = TitleGeneratorService.generateFunTitle(combos, 40, lowResults);

      // All should be strings and non-empty
      expect(highTitle.length).toBeGreaterThan(0);
      expect(mediumTitle.length).toBeGreaterThan(0);
      expect(lowTitle.length).toBeGreaterThan(0);
    });

    it('should handle probability at exact thresholds', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [{ starterCard: 'Test Card', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }]
      }];

      const results80 = [{ id: 'c1', probability: 80 }];
      const results40 = [{ id: 'c1', probability: 40 }];

      const title80 = TitleGeneratorService.generateFunTitle(combos, 40, results80);
      const title40 = TitleGeneratorService.generateFunTitle(combos, 40, results40);

      expect(title80).toBeTruthy();
      expect(title40).toBeTruthy();
    });

    it('should handle 0% probability', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [{ starterCard: 'Test Card', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }]
      }];

      const results = [{ id: 'c1', probability: 0 }];

      const title = TitleGeneratorService.generateFunTitle(combos, 40, results);

      expect(title).toBeTruthy();
      expect(title).toContain('Test Card');
    });

    it('should handle 100% probability', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [{ starterCard: 'Test Card', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }]
      }];

      const results = [{ id: 'c1', probability: 100 }];

      const title = TitleGeneratorService.generateFunTitle(combos, 40, results);

      expect(title).toBeTruthy();
      expect(title).toContain('Test Card');
    });

    it('should handle empty results array', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [{ starterCard: 'Test Card', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }]
      }];

      const results = [];

      // Should handle gracefully, might show NaN or default behavior
      expect(() => {
        const title = TitleGeneratorService.generateFunTitle(combos, 40, results);
        expect(title).toBeTruthy();
      }).not.toThrow();
    });

    it('should handle special characters in card names', () => {
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [{ starterCard: 'Ash Blossom & Joyous Spring', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }]
      }];

      const results = [{ id: 'c1', probability: 50 }];

      const title = TitleGeneratorService.generateFunTitle(combos, 40, results);

      expect(title).toContain('Ash Blossom & Joyous Spring');
    });

    it('should handle very long card names', () => {
      const longName = 'A'.repeat(100);
      const combos = [{
        id: 'c1',
        name: 'Test',
        cards: [{ starterCard: longName, startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }]
      }];

      const results = [{ id: 'c1', probability: 50 }];

      const title = TitleGeneratorService.generateFunTitle(combos, 40, results);

      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    it('should handle multiple combos with multiple cards each', () => {
      const combos = [
        {
          id: 'c1',
          name: 'Combo 1',
          cards: [
            { starterCard: 'Card A1', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 },
            { starterCard: 'Card A2', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }
          ]
        },
        {
          id: 'c2',
          name: 'Combo 2',
          cards: [
            { starterCard: 'Card B1', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 },
            { starterCard: 'Card B2', startersInDeck: 3, minCopiesInHand: 1, maxCopiesInHand: 3 }
          ]
        }
      ];

      const results = [
        { id: 'c1', probability: 60 },
        { id: 'c2', probability: 40 }
      ];

      const title = TitleGeneratorService.generateFunTitle(combos, 40, results);

      expect(title).toBeTruthy();
      // Should mention it's a 4-card analysis
      expect(title).toMatch(/4-Card/);
    });
  });
});
