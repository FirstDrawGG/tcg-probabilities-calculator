/**
 * Hand-trap identification service for Yu-Gi-Oh! cards
 * Identifies cards that can be activated from hand during opponent's turn
 */
class HandTrapService {
  /**
   * Popular hand-trap cards that should always be identified (AC #11)
   */
  static KNOWN_HAND_TRAPS = new Set([
    // Monster Hand-Traps
    'Ash Blossom & Joyous Spring',
    'Effect Veiler',
    'Nibiru, the Primal Being',
    'Ghost Ogre & Snow Rabbit',
    'D.D. Crow',
    'Droll & Lock Bird',
    // Trap Hand-Traps
    'Infinite Impermanence',
    'Dominus Impulse',
    'Dominus Purge'
  ]);

  /**
   * Monster hand-trap text patterns (AC #3)
   */
  static MONSTER_PATTERNS = [
    // Pattern 1: "(Quick Effect): You can discard this card"
    {
      regex: /\(quick effect\):\s*you can discard this card/i,
      description: 'Quick Effect discard'
    },
    // Pattern 2: "During your opponent's turn" AND "from your hand"
    {
      regex: /during your opponent's turn.*from your hand|from your hand.*during your opponent's turn/i,
      description: 'Opponent turn from hand'
    },
    // Pattern 3: "When your opponent" AND "you can" AND "from your hand"
    {
      regex: /when your opponent.*you can.*from your hand/i,
      description: 'When opponent triggers from hand'
    },
    // Pattern 4: "If your opponent" AND "discard this card from your hand"
    {
      regex: /if your opponent.*discard this card from your hand/i,
      description: 'If opponent discard from hand'
    }
  ];

  /**
   * Trap hand-trap text patterns (AC #4)
   */
  static TRAP_PATTERNS = [
    // Pattern 1: "you can activate this card from your hand"
    {
      regex: /you can activate this card from your hand/i,
      description: 'Activate from hand'
    },
    // Pattern 2: "If you control no cards, you can activate this card from your hand"
    {
      regex: /if you control no cards,\s*you can activate this card from your hand/i,
      description: 'No cards control activate from hand'
    },
    // Pattern 3: "If your opponent controls a card, you can activate this card from your hand"
    {
      regex: /if your opponent controls a card,\s*you can activate this card from your hand/i,
      description: 'Opponent controls activate from hand'
    }
  ];

  /**
   * Patterns to EXCLUDE from hand-trap identification (AC #6)
   */
  static EXCLUSION_PATTERNS = [
    // Cards that only activate from hand during YOUR turn
    /during your turn.*from your hand|from your hand.*during your turn/i,
    // Cards that must be revealed but not discarded/activated from hand
    /reveal.*from your hand/i,
    // Cards that only work on your turn
    /during your main phase.*from your hand/i
  ];

  /**
   * Check if a card is a hand-trap based on its data
   * @param {Object} cardData - Card data from Yu-Gi-Oh API
   * @returns {boolean} - True if card is identified as hand-trap
   */
  static isHandTrap(cardData) {
    if (!cardData) return false;

    const cardName = cardData.name;
    const cardType = cardData.type?.toLowerCase() || '';
    const cardDesc = cardData.desc || '';
    const atk = cardData.atk;
    const def = cardData.def;

    // AC #11: Check known hand-traps first
    if (this.KNOWN_HAND_TRAPS.has(cardName)) {
      console.log(`✅ Hand-trap identified (known): ${cardName}`);
      return true;
    }

    // AC #6: Exclude spell cards - only monster and trap hand-traps
    if (cardType.includes('spell')) {
      return false;
    }

    // Check exclusion patterns first (AC #6 & #10)
    for (const pattern of this.EXCLUSION_PATTERNS) {
      if (pattern.test(cardDesc)) {
        console.log(`❌ Card excluded from hand-trap (exclusion pattern): ${cardName}`);
        return false;
      }
    }

    // Check monster hand-traps (AC #3)
    if (cardType.includes('monster')) {
      // AC #5: Special check for 0 ATK/0 DEF monsters with "from your hand"
      if (atk === 0 && def === 0 && /from your hand/i.test(cardDesc)) {
        console.log(`✅ Hand-trap identified (0/0 monster with hand effect): ${cardName}`);
        return true;
      }

      // Check monster patterns
      for (const pattern of this.MONSTER_PATTERNS) {
        if (pattern.regex.test(cardDesc)) {
          console.log(`✅ Hand-trap identified (monster pattern - ${pattern.description}): ${cardName}`);
          return true;
        }
      }
    }

    // Check trap hand-traps (AC #4)
    if (cardType.includes('trap')) {
      for (const pattern of this.TRAP_PATTERNS) {
        if (pattern.regex.test(cardDesc)) {
          console.log(`✅ Hand-trap identified (trap pattern - ${pattern.description}): ${cardName}`);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get hand-trap information for a card
   * @param {Object} cardData - Card data from Yu-Gi-Oh API
   * @returns {Object|null} - Hand-trap info or null if not a hand-trap
   */
  static getHandTrapInfo(cardData) {
    if (!this.isHandTrap(cardData)) return null;

    return {
      isHandTrap: true,
      tooltip: "Hand-trap: This card can be activated from your hand during your opponent's turn",
      cardName: cardData.name,
      cardType: cardData.type
    };
  }

  /**
   * Count hand-traps in a deck list
   * @param {Array} cards - Array of card objects with cardData
   * @returns {number} - Number of hand-trap cards
   */
  static countHandTraps(cards) {
    if (!Array.isArray(cards)) return 0;

    return cards.reduce((count, card) => {
      if (card.cardData && this.isHandTrap(card.cardData)) {
        return count + (card.quantity || 1);
      }
      return count;
    }, 0);
  }

  /**
   * Filter hand-trap cards from a deck list
   * @param {Array} cards - Array of card objects with cardData
   * @returns {Array} - Array of hand-trap cards only
   */
  static getHandTrapCards(cards) {
    if (!Array.isArray(cards)) return [];

    return cards.filter(card => 
      card.cardData && this.isHandTrap(card.cardData)
    );
  }
}

export default HandTrapService;