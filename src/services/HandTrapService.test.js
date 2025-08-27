/**
 * HandTrapService Tests
 * Test hand-trap identification functionality
 */

import { expect, describe, it } from 'vitest';
import HandTrapService from './HandTrapService.js';

describe('HandTrapService', () => {
  describe('Known Hand-Trap Detection', () => {
    it('should identify known monster hand-traps correctly', () => {
      const ashBlossom = {
        name: 'Ash Blossom & Joyous Spring',
        type: 'Effect Monster',
        desc: 'When a card or effect is activated that includes any of these effects (Quick Effect): You can discard this card; negate that activation.',
        atk: 0,
        def: 1800
      };

      expect(HandTrapService.isHandTrap(ashBlossom)).toBe(true);
    });

    it('should identify known trap hand-traps correctly', () => {
      const infiniteImpermanence = {
        name: 'Infinite Impermanence',
        type: 'Trap Card',
        desc: 'Target 1 Effect Monster your opponent controls; negate its effects (until the end of this turn), also negate the effects of all monsters in that monster\'s column. If you control no cards, you can activate this card from your hand.',
        atk: null,
        def: null
      };

      expect(HandTrapService.isHandTrap(infiniteImpermanence)).toBe(true);
    });

    it('should identify Effect Veiler as hand-trap', () => {
      const effectVeiler = {
        name: 'Effect Veiler',
        type: 'Effect Monster',
        desc: 'During your opponent\'s Main Phase (Quick Effect): You can discard this card, then target 1 Effect Monster your opponent controls; negate that monster\'s effects until the end of this turn.',
        atk: 0,
        def: 0
      };

      expect(HandTrapService.isHandTrap(effectVeiler)).toBe(true);
    });
  });

  describe('Pattern-Based Detection', () => {
    it('should detect monster hand-traps with Quick Effect discard pattern', () => {
      const testCard = {
        name: 'Test Hand-Trap',
        type: 'Effect Monster',
        desc: '(Quick Effect): You can discard this card to activate this effect.',
        atk: 0,
        def: 0
      };

      expect(HandTrapService.isHandTrap(testCard)).toBe(true);
    });

    it('should detect monster hand-traps with opponent turn pattern', () => {
      const testCard = {
        name: 'Test Opponent Turn Hand-Trap',
        type: 'Effect Monster', 
        desc: 'During your opponent\'s turn, you can discard this card from your hand to activate this effect.',
        atk: 1000,
        def: 1000
      };

      expect(HandTrapService.isHandTrap(testCard)).toBe(true);
    });

    it('should detect trap hand-traps with activation from hand pattern', () => {
      const testCard = {
        name: 'Test Trap Hand-Trap',
        type: 'Trap Card',
        desc: 'If your opponent controls a card, you can activate this card from your hand.',
        atk: null,
        def: null
      };

      expect(HandTrapService.isHandTrap(testCard)).toBe(true);
    });

    it('should detect 0 ATK/0 DEF monsters with hand effects', () => {
      const testCard = {
        name: 'Test 0/0 Hand Effect',
        type: 'Effect Monster',
        desc: 'You can discard this card from your hand to draw 1 card.',
        atk: 0,
        def: 0
      };

      expect(HandTrapService.isHandTrap(testCard)).toBe(true);
    });
  });

  describe('Exclusion Patterns', () => {
    it('should NOT identify spell cards as hand-traps', () => {
      const spellCard = {
        name: 'Test Spell',
        type: 'Spell Card',
        desc: 'You can activate this card from your hand during your opponent\'s turn.',
        atk: null,
        def: null
      };

      expect(HandTrapService.isHandTrap(spellCard)).toBe(false);
    });

    it('should NOT identify cards that only work during your turn', () => {
      const yourTurnCard = {
        name: 'Your Turn Only',
        type: 'Effect Monster',
        desc: 'During your turn, you can discard this card from your hand to draw 1 card.',
        atk: 1200,
        def: 800
      };

      expect(HandTrapService.isHandTrap(yourTurnCard)).toBe(false);
    });

    it('should NOT identify reveal effects as hand-traps', () => {
      const revealCard = {
        name: 'Reveal Effect',
        type: 'Effect Monster',
        desc: 'You can reveal this card from your hand to activate this effect.',
        atk: 1000,
        def: 1000
      };

      expect(HandTrapService.isHandTrap(revealCard)).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    it('should count hand-traps in a deck correctly', () => {
      const deckCards = [
        { 
          cardData: { name: 'Ash Blossom & Joyous Spring', type: 'Effect Monster' },
          quantity: 3 
        },
        {
          cardData: { name: 'Blue-Eyes White Dragon', type: 'Normal Monster' },
          quantity: 3
        },
        {
          cardData: { name: 'Effect Veiler', type: 'Effect Monster' },
          quantity: 2
        }
      ];

      const handTrapCount = HandTrapService.countHandTraps(deckCards);
      expect(handTrapCount).toBe(5); // 3 Ash + 2 Veiler
    });

    it('should filter hand-trap cards from deck list', () => {
      const deckCards = [
        { cardData: { name: 'Ash Blossom & Joyous Spring', type: 'Effect Monster' } },
        { cardData: { name: 'Blue-Eyes White Dragon', type: 'Normal Monster' } },
        { cardData: { name: 'Effect Veiler', type: 'Effect Monster' } }
      ];

      const handTrapCards = HandTrapService.getHandTrapCards(deckCards);
      expect(handTrapCards).toHaveLength(2);
      expect(handTrapCards[0].cardData.name).toBe('Ash Blossom & Joyous Spring');
      expect(handTrapCards[1].cardData.name).toBe('Effect Veiler');
    });

    it('should handle null/undefined input gracefully', () => {
      expect(HandTrapService.isHandTrap(null)).toBe(false);
      expect(HandTrapService.isHandTrap(undefined)).toBe(false);
      expect(HandTrapService.countHandTraps(null)).toBe(0);
      expect(HandTrapService.getHandTrapCards(null)).toEqual([]);
    });
  });
});