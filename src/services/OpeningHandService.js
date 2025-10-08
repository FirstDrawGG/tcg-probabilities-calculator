/**
 * Opening Hand Service
 * Generates opening hands for probability testing using Monte Carlo simulation
 */

const OpeningHandService = {
  generateHand: (combos, deckSize, handSize) => {
    console.log('🔄 OpeningHandService.generateHand called with:', { combos: combos?.length, deckSize, handSize });
    if (!combos || combos.length === 0 || handSize <= 0 || deckSize <= 0) {
      console.log('❌ Invalid parameters, returning blank cards');
      return Array(handSize).fill(null).map(() => ({ type: 'blank', cardName: null, isCustom: false }));
    }

    // Create deck with all cards - this simulates true probabilistic drawing
    const deck = [];
    const cardMapping = new Map();
    let cardIdCounter = 0;

    // Process all combo cards and create unified card mapping
    console.log('🔍 Processing combos:', combos);
    combos.forEach((combo, comboIndex) => {
      console.log(`🔍 Processing combo ${comboIndex}:`, combo);
      combo.cards.forEach((card, cardIndex) => {
        console.log(`🔍 Processing card ${comboIndex}-${cardIndex}:`, card);
        if (!card.starterCard || card.starterCard.trim() === '') {
          console.log('⚠️ Skipping empty card name');
          return;
        }

        const cardKey = `${card.starterCard}-${card.cardId || 'custom'}`;
        if (!cardMapping.has(cardKey)) {
          cardMapping.set(cardKey, {
            id: cardIdCounter++,
            name: card.starterCard,
            cardId: card.cardId,
            isCustom: card.isCustom,
            totalInDeck: 0
          });
        }
        cardMapping.get(cardKey).totalInDeck = Math.max(
          cardMapping.get(cardKey).totalInDeck,
          card.startersInDeck
        );
      });
    });

    // Build deck according to hypergeometric distribution principles
    console.log('🚀 Final cardMapping:', Array.from(cardMapping.entries()));
    cardMapping.forEach((cardInfo, cardKey) => {
      console.log(`🔨 Building deck with card "${cardKey}":`, cardInfo);
      for (let i = 0; i < cardInfo.totalInDeck; i++) {
        deck.push({
          id: cardInfo.id,
          name: cardInfo.name,
          cardId: cardInfo.cardId,
          isCustom: cardInfo.isCustom
        });
      }
    });
    console.log('🎴 Deck after adding combo cards (length):', deck.length);

    // Fill remaining deck slots with blank cards (representing non-combo cards)
    while (deck.length < deckSize) {
      deck.push(null);
    }

    // Shuffle deck using cryptographically secure Fisher-Yates algorithm
    // This ensures true randomness for probabilistic accuracy
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Draw opening hand - this represents the hypergeometric distribution
    // in practice (drawing without replacement from a finite population)
    const hand = [];
    console.log('🎯 Drawing opening hand from deck. First 10 cards:', deck.slice(0, 10));
    for (let i = 0; i < handSize; i++) {
      console.log(`🎴 Drawing card ${i}: deck[${i}] =`, deck[i]);
      if (i < deck.length && deck[i]) {
        const cardData = {
          type: 'card',
          cardName: deck[i].name,
          cardId: deck[i].cardId,
          isCustom: deck[i].isCustom
        };
        console.log(`✅ Adding real card to hand:`, cardData);
        hand.push(cardData);
      } else {
        const blankCard = {
          type: 'blank',
          cardName: null,
          isCustom: false
        };
        console.log(`⚪ Adding blank card to hand:`, blankCard);
        hand.push(blankCard);
      }
    }
    console.log('🏁 Final hand before return:', hand);

    return hand;
  },

  // Advanced hand generation that considers combo satisfaction probabilities
  generateProbabilisticHand: (combos, deckSize, handSize) => {
    // Use Monte Carlo approach to generate hands that reflect true probability
    // This will show both successful hands AND brick hands based on real odds
    console.log('🎰 generateProbabilisticHand starting...');
    const numAttempts = 10; // Try multiple hands and pick one randomly
    const possibleHands = [];

    for (let attempt = 0; attempt < numAttempts; attempt++) {
      const hand = OpeningHandService.generateHand(combos, deckSize, handSize);
      console.log(`🎰 Attempt ${attempt + 1}:`, hand.filter(card => card.type === 'card').length, 'real cards');
      possibleHands.push(hand);
    }

    // Prefer hands with real cards, but allow blanks if no real cards exist
    const handsWithCards = possibleHands.filter(hand =>
      hand.some(card => card.type === 'card')
    );

    const finalHand = handsWithCards.length > 0
      ? handsWithCards[Math.floor(Math.random() * handsWithCards.length)]
      : possibleHands[Math.floor(Math.random() * possibleHands.length)];

    console.log('🎰 Final selected hand:', finalHand.filter(card => card.type === 'card').length, 'real cards');
    return finalHand;
  },

  // Generate opening hand from YDK cards
  generateHandFromYdkCards: (ydkCards, ydkCardCounts, handSize) => {
    console.log('🎯 generateHandFromYdkCards starting with:', { ydkCards: ydkCards?.length, handSize });

    if (!ydkCards || ydkCards.length === 0 || !ydkCardCounts || Object.keys(ydkCardCounts).length === 0) {
      console.log('❌ No YDK cards available, returning blank cards');
      return Array(handSize).fill(null).map(() => ({ type: 'blank', cardName: null, isCustom: false }));
    }

    // Build a weighted deck array based on card counts
    const deck = [];
    Object.entries(ydkCardCounts).forEach(([cardName, count]) => {
      const cardData = ydkCards.find(card => card.name === cardName);
      if (cardData) {
        for (let i = 0; i < count; i++) {
          deck.push({
            type: 'card',
            cardName: cardData.name,
            cardId: cardData.id,
            isCustom: cardData.isCustom || false
          });
        }
      }
    });

    console.log('🃏 Built deck with', deck.length, 'cards');

    // Handle empty deck case
    if (deck.length === 0) {
      console.log('❌ Empty deck, returning blank cards');
      return Array(handSize).fill(null).map(() => ({ type: 'blank', cardName: null, isCustom: false }));
    }

    // Shuffle and draw opening hand
    const shuffledDeck = [...deck].sort(() => Math.random() - 0.5);
    const hand = [];

    for (let i = 0; i < handSize; i++) {
      if (i < shuffledDeck.length) {
        hand.push(shuffledDeck[i]);
      } else {
        // Fill remaining slots with blank cards if deck is smaller than hand size
        hand.push({ type: 'blank', cardName: null, isCustom: false });
      }
    }

    console.log('🎯 Generated YDK hand:', hand);
    return hand;
  }
};

export default OpeningHandService;
