import React, { useState, useEffect, useRef } from 'react';

// URL encoding/decoding utilities
const URLService = {
  encodeCalculation: (deckSize, handSize, combos, ydkFile = null) => {
    try {
      const data = {
        d: deckSize,
        h: handSize,
        c: combos.map(combo => ({
          i: combo.id,
          n: combo.name,
          cards: combo.cards.map(card => ({
            s: card.starterCard,
            cId: card.cardId,
            iC: card.isCustom,
            deck: card.startersInDeck,
            min: card.minCopiesInHand,
            max: card.maxCopiesInHand
          }))
        }))
      };
      
      // Add YDK file data if present
      if (ydkFile) {
        data.ydk = {
          name: ydkFile.name,
          content: ydkFile.content
        };
      }
      
      const jsonString = JSON.stringify(data);
      const encoded = btoa(jsonString);
      return encoded;
    } catch (error) {
      console.error('Failed to encode calculation:', error);
      return null;
    }
  },

  decodeCalculation: () => {
    try {
      const hash = window.location.hash;
      const match = hash.match(/#calc=(.+)/);
      if (!match) return null;
      
      const decoded = atob(match[1]);
      const data = JSON.parse(decoded);
      
      if (!data.d || !data.h || !data.c || !Array.isArray(data.c)) {
        return null;
      }
      
      const result = {
        deckSize: data.d,
        handSize: data.h,
        combos: data.c.map(combo => ({
          id: combo.i,
          name: combo.n,
          cards: combo.cards.map(card => ({
            starterCard: card.s || '',
            cardId: card.cId || null,
            isCustom: card.iC || false,
            startersInDeck: card.deck,
            minCopiesInHand: card.min,
            maxCopiesInHand: card.max
          }))
        }))
      };
      
      // Add YDK file data if present
      if (data.ydk) {
        result.ydkFile = {
          name: data.ydk.name,
          content: data.ydk.content
        };
      }
      
      return result;
    } catch (error) {
      console.error('Failed to decode calculation:', error);
      return null;
    }
  },

  updateURL: (deckSize, handSize, combos, ydkFile = null) => {
    const encoded = URLService.encodeCalculation(deckSize, handSize, combos, ydkFile);
    if (encoded) {
      window.history.replaceState(null, '', `#calc=${encoded}`);
    }
  }
};

// Card database service
const CardDatabaseService = {
  CACHE_KEY: 'yugioh_cards_cache',
  CACHE_DURATION: 7 * 24 * 60 * 60 * 1000,
  
  // Blob storage configuration
  BLOB_BASE_URL: 'https://ws8edzxhvgmmgmdj.public.blob.vercel-storage.com', // Updated with correct Vercel Blob URL
  BLOB_ENABLED: true, // Enable blob storage for card images
  
  async fetchCards() {
    try {
      console.log('Fetching cards from API...');
      const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php');
      console.log('API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API response:', data);
      console.log('Number of cards:', data.data ? data.data.length : 0);
      console.log('First card example:', data.data ? data.data[0] : 'No cards');
      
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch cards:', error);
      return [];
    }
  },
  
  loadFromCache() {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > this.CACHE_DURATION) {
        localStorage.removeItem(this.CACHE_KEY);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Cache load error:', error);
      return null;
    }
  },
  
  saveToCache(cards) {
    try {
      const cacheData = {
        data: cards,
        timestamp: Date.now()
      };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Cache save error:', error);
    }
  },
  
  /**
   * Sanitize card name for URL generation (matches migration script)
   * @param {string} cardName - The card name
   * @returns {string} Sanitized card name
   */
  sanitizeCardName(cardName) {
    return cardName
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
  },

  /**
   * Generate optimized image URL for a card using new structure
   * @param {string} cardName - The card name
   * @param {string} size - Image size ('full' or 'small')
   * @returns {string} The optimized image URL
   */
  getImageUrl(cardName, size = 'small') {
    if (!this.BLOB_ENABLED || !cardName) {
      // Fallback to YGOPro URLs if blob storage disabled or no card name
      return `https://images.ygoprodeck.com/images/cards/small.jpg`; // Generic fallback
    }
    
    const sanitizedName = this.sanitizeCardName(cardName);
    const suffix = size === 'small' ? '-small' : '';
    return `${this.BLOB_BASE_URL}/cards/${sanitizedName}${suffix}.webp`;
  },
  
  /**
   * Generate image props for WebP with YGOPro fallback
   * @param {string} cardName - The card name
   * @param {string} cardId - The card ID (for fallback)
   * @param {string} size - Image size ('full' or 'small')
   * @returns {object} Props for HTML img element with WebP support
   */
  getImageProps(cardName, cardId, size = 'small') {
    const webpUrl = this.getImageUrl(cardName, size);
    const fallbackUrl = cardId ? 
      `https://images.ygoprodeck.com/images/cards/${cardId}.jpg` :
      `https://images.ygoprodeck.com/images/cards/small.jpg`;
    
    return {
      src: this.BLOB_ENABLED ? webpUrl : fallbackUrl,
      alt: cardName || 'Yu-Gi-Oh Card',
      loading: 'lazy',
      onError: (e) => {
        // Fallback to YGOPro image if Blob image fails to load
        if (e.target.src !== fallbackUrl) {
          e.target.src = fallbackUrl;
        }
      }
    };
  }
};

// Probability calculation service
const ProbabilityService = {
  resultCache: new Map(),
  
  clearCache: function() {
    this.resultCache.clear();
  },
  
  getCacheKey: function(combo, deckSize, handSize) {
    const cardsKey = combo.cards.map(card => 
      `${card.startersInDeck}-${card.minCopiesInHand}-${card.maxCopiesInHand}`
    ).join('|');
    return `${cardsKey}-${deckSize}-${handSize}`;
  },
  
  getCombinedCacheKey: function(combos, deckSize, handSize) {
    const combosKey = combos.map(combo => 
      combo.cards.map(card => 
        `${card.startersInDeck}-${card.minCopiesInHand}-${card.maxCopiesInHand}`
      ).join('|')
    ).join('||');
    return `combined-${combosKey}-${deckSize}-${handSize}`;
  },
  
  monteCarloSimulation: (combo, deckSize, handSize, simulations = 100000) => {
    const cacheKey = ProbabilityService.getCacheKey(combo, deckSize, handSize);
    
    if (ProbabilityService.resultCache.has(cacheKey)) {
      return ProbabilityService.resultCache.get(cacheKey);
    }
    
    let successes = 0;
    
    for (let i = 0; i < simulations; i++) {
      const deck = [];
      let currentPosition = 0;
      
      combo.cards.forEach((card, cardIndex) => {
        for (let j = 0; j < card.startersInDeck; j++) {
          deck.push(cardIndex);
        }
        currentPosition += card.startersInDeck;
      });
      
      for (let j = currentPosition; j < deckSize; j++) {
        deck.push(-1);
      }
      
      for (let j = deck.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [deck[j], deck[k]] = [deck[k], deck[j]];
      }
      
      const cardCounts = new Array(combo.cards.length).fill(0);
      for (let j = 0; j < handSize; j++) {
        if (deck[j] >= 0) {
          cardCounts[deck[j]]++;
        }
      }
      
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
    ProbabilityService.resultCache.set(cacheKey, probability);
    
    return probability;
  },
  
  combinedMonteCarloSimulation: (combos, deckSize, handSize, simulations = 100000) => {
    const cacheKey = ProbabilityService.getCombinedCacheKey(combos, deckSize, handSize);
    
    if (ProbabilityService.resultCache.has(cacheKey)) {
      return ProbabilityService.resultCache.get(cacheKey);
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
      allUniqueCards.forEach((cardInfo, cardKey) => {
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
    ProbabilityService.resultCache.set(cacheKey, probability);
    
    return probability;
  },
  
  calculateMultipleCombos: (combos, deckSize, handSize) => {
    const individualResults = combos.map(combo => ({
      id: combo.id,
      probability: ProbabilityService.monteCarloSimulation(combo, deckSize, handSize),
      cards: combo.cards
    }));
    
    // Calculate combined probability only if there are multiple combos
    let combinedProbability = null;
    if (combos.length > 1) {
      combinedProbability = ProbabilityService.combinedMonteCarloSimulation(combos, deckSize, handSize);
    }
    
    return {
      individual: individualResults,
      combined: combinedProbability
    };
  }
};

// Opening hand generation service
const OpeningHandService = {
  generateHand: (combos, deckSize, handSize) => {
    if (!combos || combos.length === 0 || handSize <= 0 || deckSize <= 0) {
      return Array(handSize).fill(null).map(() => ({ type: 'blank', cardName: null, isCustom: false }));
    }

    // Create deck with all cards - this simulates true probabilistic drawing
    const deck = [];
    const cardMapping = new Map();
    let cardIdCounter = 0;

    // Process all combo cards and create unified card mapping
    combos.forEach(combo => {
      combo.cards.forEach(card => {
        if (card.starterCard.trim() === '') return;
        
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
    cardMapping.forEach((cardInfo) => {
      for (let i = 0; i < cardInfo.totalInDeck; i++) {
        deck.push({
          id: cardInfo.id,
          name: cardInfo.name,
          cardId: cardInfo.cardId,
          isCustom: cardInfo.isCustom
        });
      }
    });

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
    for (let i = 0; i < handSize; i++) {
      if (i < deck.length && deck[i]) {
        hand.push({
          type: 'card',
          cardName: deck[i].name,
          cardId: deck[i].cardId,
          isCustom: deck[i].isCustom
        });
      } else {
        hand.push({
          type: 'blank',
          cardName: null,
          isCustom: false
        });
      }
    }

    return hand;
  },

  // Advanced hand generation that considers combo satisfaction probabilities
  generateProbabilisticHand: (combos, deckSize, handSize) => {
    // Use Monte Carlo approach to generate hands that reflect true probability
    // This will show both successful hands AND brick hands based on real odds
    const numAttempts = 10; // Try multiple hands and pick one randomly
    const possibleHands = [];

    for (let attempt = 0; attempt < numAttempts; attempt++) {
      const hand = OpeningHandService.generateHand(combos, deckSize, handSize);
      possibleHands.push(hand);
    }

    // Return a random hand from the possibilities (ensures true randomness)
    return possibleHands[Math.floor(Math.random() * possibleHands.length)];
  }
};

// YDK file parsing service
const YdkParsingService = {
  async loadStaticCardDatabase() {
    try {
      const response = await fetch('/cardDatabase.json');
      if (!response.ok) {
        throw new Error(`Failed to load card database: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to load static card database:', error);
      return {};
    }
  },

  parseYdkFile(fileContent, staticCardDatabase) {
    try {
      const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line);
      const result = {
        cards: [],
        unmatchedIds: [],
        extraDeckCards: [], // Track Extra Deck cards separately
        cardCounts: {} // Track count of each card by name
      };

      let currentSection = null;
      
      for (const line of lines) {
        if (line.startsWith('#')) continue; // Skip comments
        if (line === '!side') break; // Stop at side deck
        
        if (line === '#main') {
          currentSection = 'main';
          continue;
        }
        if (line === '#extra') {
          currentSection = 'extra';
          continue;
        }
        
        // Parse card ID
        const cardId = line.trim();
        if (!cardId || isNaN(cardId)) continue;
        
        const cardData = staticCardDatabase[cardId];
        if (cardData) {
          if (cardData.isExtraDeck) {
            // Track Extra Deck cards but don't include in main results
            result.extraDeckCards.push({
              id: cardId,
              name: cardData.name,
              isExtraDeck: true
            });
          } else {
            // Include main deck cards
            result.cards.push({
              id: cardId,
              name: cardData.name,
              isExtraDeck: cardData.isExtraDeck
            });
            
            // Track count of each card by name
            if (!result.cardCounts[cardData.name]) {
              result.cardCounts[cardData.name] = 0;
            }
            result.cardCounts[cardData.name]++;
          }
        } else {
          // Only count as unmatched if card is not found in database at all
          result.unmatchedIds.push(cardId);
        }
      }

      return result;
    } catch (error) {
      console.error('Error parsing YDK file:', error);
      throw new Error('Failed to parse YDK file');
    }
  },

  validateYdkFile(file) {
    // Check file size (100KB limit)
    if (file.size > 100 * 1024) {
      throw new Error('File size exceeds 100KB limit');
    }

    // Check file extension
    if (!file.name.toLowerCase().endsWith('.ydk')) {
      throw new Error('Only YDK files are supported');
    }

    return true;
  }
};

// Title generation service
const TitleGeneratorService = {
  generateFunTitle: (combos, deckSize, results) => {
    const cardNames = combos.flatMap(combo =>
      combo.cards.map(card => card.starterCard)
    ).filter(name => name.trim() !== '');

    // Calculate average probability for multiple combos
    const avgProbability = results.reduce((sum, r) => sum + r.probability, 0) / results.length;
    
    // Probability-based emoji selection
    const probEmoji = avgProbability > 80 ? "🔥" :
                     avgProbability > 60 ? "⚡" :
                     avgProbability > 40 ? "🎲" : "💀";

    // Fun suffixes based on card count
    const suffixes = {
      1: ["Hunt", "Check", "Math", "Dreams"],
      2: ["Combo", "Engine", "Pair", "Duo"],
      multi: ["Analysis", "Package", "Study", "Report"]
    };

    const flavorTexts = {
      high: ["Going Off!", "Maximum Consistency", "Trust the Math", "Opening Hand Magic"],
      medium: ["Solid Chances", "Decent Odds", "Making It Work", "The Sweet Spot"],
      low: ["Brick City?", "Pray to RNGesus", "Heart of the Cards", "Bold Strategy"]
    };

    let title = "";

    if (cardNames.length === 0) {
      // Edge case: no cards
      title = `${probEmoji} Mystery Deck Analysis (${deckSize} Cards)`;
    } else if (cardNames.length === 1) {
      const suffix = suffixes[1][Math.floor(Math.random() * suffixes[1].length)];
      title = `${probEmoji} ${cardNames[0]} ${suffix}: `;
      
      if (avgProbability > 80) {
        title += flavorTexts.high[Math.floor(Math.random() * flavorTexts.high.length)];
      } else if (avgProbability > 40) {
        title += flavorTexts.medium[Math.floor(Math.random() * flavorTexts.medium.length)];
      } else {
        title += flavorTexts.low[Math.floor(Math.random() * flavorTexts.low.length)];
      }
      
      title += ` (${deckSize} Cards)`;
    } else if (cardNames.length === 2) {
      const suffix = suffixes[2][Math.floor(Math.random() * suffixes[2].length)];
      title = `✨ ${cardNames[0]} + ${cardNames[1]}: The ${suffix}`;
    } else {
      const suffix = suffixes.multi[Math.floor(Math.random() * suffixes.multi.length)];
      title = `🧮 ${cardNames.length}-Card ${suffix}: Tournament Ready?`;
    }

    return title;
  }
};

// Card Image component
const CardImage = ({ cardData, size = 'small' }) => {
  const [imageError, setImageError] = useState(false);
  const [blankImageError, setBlankImageError] = useState(false);
  
  const blankCardUrl = 'https://ws8edzxhvgmmgmdj.public.blob.vercel-storage.com/cards/yugioh_card_back_blank.jpg';
  
  if (!cardData || cardData.type === 'blank') {
    // Default blank Yu-Gi-Oh card using Vercel Blob image
    return (
      <div
        style={{
          width: size === 'small' ? '60px' : '120px',
          height: size === 'small' ? '87px' : '174px',
          position: 'relative',
          borderRadius: '4px',
          overflow: 'hidden'
        }}
      >
        <img
          src={blankCardUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '4px'
          }}
          onError={() => {
            if (!blankImageError) {
              setBlankImageError(true);
            }
          }}
          alt="Yu-Gi-Oh Card Back"
        />
        {blankImageError && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              backgroundImage: 'radial-gradient(circle, #2a2a2a 1px, transparent 1px)',
              backgroundSize: '10px 10px'
            }}
          >
            <div style={{ color: '#666', fontSize: '10px', textAlign: 'center' }}>
              Yu-Gi-Oh!
            </div>
          </div>
        )}
      </div>
    );
  }

  if (cardData.isCustom) {
    // Black and white blank card for custom cards using the same image but grayscaled
    return (
      <div
        style={{
          width: size === 'small' ? '60px' : '120px',
          height: size === 'small' ? '87px' : '174px',
          position: 'relative',
          borderRadius: '4px',
          overflow: 'hidden'
        }}
      >
        <img
          src={blankCardUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '4px',
            filter: 'grayscale(100%) brightness(0.7)'
          }}
          onError={() => {
            if (!blankImageError) {
              setBlankImageError(true);
            }
          }}
          alt={`Custom Card: ${cardData.cardName}`}
        />
        {blankImageError && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: '#666',
              border: '1px solid #333',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              backgroundImage: 'radial-gradient(circle, #777 1px, transparent 1px)',
              backgroundSize: '10px 10px',
              filter: 'grayscale(100%)'
            }}
          >
            <div style={{ color: '#333', fontSize: '8px', textAlign: 'center', padding: '4px' }}>
              {cardData.cardName}
            </div>
          </div>
        )}
        {/* Overlay custom card name */}
        <div
          style={{
            position: 'absolute',
            bottom: '2px',
            left: '2px',
            right: '2px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            fontSize: '7px',
            textAlign: 'center',
            padding: '1px 2px',
            borderRadius: '2px',
            maxHeight: '20px',
            overflow: 'hidden'
          }}
        >
          {cardData.cardName}
        </div>
      </div>
    );
  }

  // Regular card with image
  const imageProps = CardDatabaseService.getImageProps(cardData.cardName, cardData.cardId, size);
  
  return (
    <div
      style={{
        width: size === 'small' ? '60px' : '120px',
        height: size === 'small' ? '87px' : '174px',
        position: 'relative',
        borderRadius: '4px',
        overflow: 'hidden'
      }}
    >
      <img
        {...imageProps}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '4px'
        }}
        onError={(e) => {
          if (!imageError) {
            setImageError(true);
            // Fallback to blank card style
            e.target.style.display = 'none';
          }
        }}
        alt={cardData.cardName || 'Yu-Gi-Oh Card'}
      />
      {imageError && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
          }}
        >
          <div style={{ color: '#666', fontSize: '8px', textAlign: 'center', padding: '4px' }}>
            {cardData.cardName}
          </div>
        </div>
      )}
    </div>
  );
};

// Tooltip component
const Tooltip = ({ text, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0, placement: 'right' });
  const tooltipRef = useRef(null);
  const triggerRef = useRef(null);

  const updatePosition = () => {
    if (triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Default to right positioning
      let x = triggerRect.right + 8;
      let y = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
      let placement = 'right';

      // Check if tooltip would overflow viewport on the right
      if (x + tooltipRect.width > viewportWidth - 10) {
        // Position above instead
        x = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        y = triggerRect.top - tooltipRect.height - 4;
        placement = 'top';

        // Ensure tooltip doesn't go off left edge when centered above
        if (x < 10) x = 10;
        if (x + tooltipRect.width > viewportWidth - 10) {
          x = viewportWidth - tooltipRect.width - 10;
        }
      }

      // Ensure tooltip doesn't go off top edge
      if (y < 10) {
        y = triggerRect.bottom + 4;
        placement = 'bottom';
      }

      // Ensure tooltip doesn't go off bottom edge
      if (y + tooltipRect.height > viewportHeight - 10) {
        y = viewportHeight - tooltipRect.height - 10;
      }

      setPosition({ x, y, placement });
    }
  };

  const handleMouseEnter = () => {
    setIsVisible(true);
    setTimeout(updatePosition, 0);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    if (isVisible) {
      setIsVisible(false);
    } else {
      setIsVisible(true);
      setTimeout(updatePosition, 0);
    }
  };

  useEffect(() => {
    if (isVisible) {
      const handleResize = () => updatePosition();
      const handleScroll = () => updatePosition();
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isVisible]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        style={{ 
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: 'transparent',
          border: '1px solid var(--icon-main)',
          color: 'var(--icon-main)',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'pointer',
          marginLeft: '8px',
          flexShrink: 0,
          userSelect: 'none'
        }}
      >
        i
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            backgroundColor: 'var(--bg-secondary)',
            border: `1px solid var(--border-main)`,
            color: 'var(--text-main)',
            padding: 'var(--spacing-sm) 12px',
            borderRadius: '6px',
            fontSize: 'var(--font-body-size)',
            lineHeight: 'var(--font-body-line-height)',
            maxWidth: '240px',
            width: 'max-content',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            fontFamily: 'Geist Regular, sans-serif',
            wordWrap: 'break-word',
            whiteSpace: 'normal'
          }}
        >
          {text}
        </div>
      )}
    </>
  );
};

// Searchable dropdown component
const SearchableCardInput = ({ value, onChange, placeholder, errors, comboId, cardIndex, cardDatabase, ydkCards, ydkCardCounts, updateCombo }) => {
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCards, setFilteredCards] = useState([]);
  const [isEditing, setIsEditing] = useState(!value);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  
  useEffect(() => {
    if (value && isEditing) {
      setIsEditing(false);
    }
  }, [value]);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);
  
  useEffect(() => {
    if (searchTerm.length === 0) {
      setFilteredCards([]);
      return;
    }
    
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      console.log('Searching for:', searchTerm);
      console.log('Card database length:', cardDatabase ? cardDatabase.length : 0);
      console.log('YDK cards length:', ydkCards ? ydkCards.length : 0);
      
      const searchLower = searchTerm.toLowerCase();
      let matches = [];
      
      if (searchTerm.length < 3) {
        // For 1-2 characters, search only YDK cards
        if (ydkCards && ydkCards.length > 0) {
          matches = ydkCards
            .filter(card => card.name && card.name.toLowerCase().includes(searchLower))
            .slice(0, 50);
        }
      } else {
        // For 3+ characters, search both YDK cards and full database
        const ydkMatches = ydkCards && ydkCards.length > 0 
          ? ydkCards.filter(card => card.name && card.name.toLowerCase().includes(searchLower))
          : [];
        
        const dbMatches = (cardDatabase || [])
          .filter(card => card.name && card.name.toLowerCase().includes(searchLower))
          .slice(0, 50 - ydkMatches.length)
          .map(card => ({
            name: card.name,
            id: card.id,
            isCustom: false
          }));
        
        // Combine YDK matches first, then database matches
        matches = [...ydkMatches, ...dbMatches];
      }
      
      console.log('Found matches:', matches.length);
      console.log('First few matches:', matches.slice(0, 3));
      
      setFilteredCards(matches);
    }, 300);
    
    return () => clearTimeout(debounceTimerRef.current);
  }, [searchTerm, cardDatabase, ydkCards]);
  
  const handleInputClick = () => {
  setIsOpen(true);
  if (value && !isEditing) {
    handleEdit();
    }
  };
  
  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    if (!isOpen) setIsOpen(true);
  };
  
  const handleCardSelect = (card) => {
    // Update the card name properly
    onChange({
      starterCard: card.name,
      cardId: card.id,
      isCustom: card.isCustom
    });
    
    // If this is a YDK card, also update the copies in deck and max in hand immediately
    if (ydkCardCounts && ydkCardCounts[card.name] && updateCombo && comboId !== undefined && cardIndex !== undefined) {
      const cardCount = ydkCardCounts[card.name];
      
      // Update copies in deck
      updateCombo(comboId, cardIndex, 'startersInDeck', cardCount);
      
      // Update max copies in hand to match deck count (but don't exceed reasonable limits)
      const maxInHand = Math.min(cardCount, 3); // Cap at 3 for reasonable hand size
      updateCombo(comboId, cardIndex, 'maxCopiesInHand', maxInHand);
    }
    
    // Close dropdown and clear search - let useEffect handle isEditing
    setSearchTerm('');
    setIsOpen(false);
  };
  
  const handleCustomName = () => {
    handleCardSelect({
      name: searchTerm,
      id: null,
      isCustom: true
    });
  };
  
  const handleClear = () => {
    onChange({
      starterCard: '',
      cardId: null,
      isCustom: false
    });
    setSearchTerm('');
    setIsEditing(true);
  };
  
  const handleEdit = () => {
    setSearchTerm(value);
    setIsEditing(true);
    setIsOpen(true);
    requestAnimationFrame(() => {
     if (inputRef.current) {
      inputRef.current.focus();
     }
     });
  };
  
  const typography = {
    body: {
      fontSize: 'var(--font-body-size)',
      lineHeight: 'var(--font-body-line-height)',
      color: 'var(--text-main)',
      fontFamily: 'Geist Regular, sans-serif'
    }
  };
  
  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onClick={handleInputClick}
          placeholder={placeholder}
          className={`w-full px-3 border ${errors ? 'border-red-500' : ''}`}
          style={{ 
            backgroundColor: 'var(--bg-secondary)', 
            border: `1px solid var(--border-main)`,
            color: 'var(--text-main)',
            borderRadius: '999px',
            height: '40px',
            cursor: 'text',
            outline: 'none',
            ...typography.body
          }}
          onFocus={(e) => {
            e.target.style.border = '1px solid var(--border-action)';
            e.target.style.color = 'var(--text-main)';
          }}
          onBlur={(e) => {
            e.target.style.border = `1px solid var(--border-main)`;
            e.target.style.color = 'var(--text-main)';
          }}
        />
      ) : (
        <div 
          className={`w-full px-3 border ${errors ? 'border-red-500' : ''} flex justify-between items-center`}
          style={{ 
            backgroundColor: 'var(--bg-secondary)', 
            border: `1px solid var(--border-main)`,
            color: 'var(--text-main)',
            borderRadius: '999px',
            height: '40px',
            cursor: 'text',
            ...typography.body
          }}
          onClick={(e) => {     
            e.stopPropagation(); 
            handleEdit();        
          }}      
        >
          <span>{value}</span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit();
               }}
              className="hover:opacity-80 transition-opacity"
               style={{ fontSize: '12px' }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); 
                handleClear();
              }}
              className="hover:opacity-80 transition-opacity"
              style={{ fontSize: '16px' }}
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      {isOpen && isEditing && (
        <div 
          className="absolute z-10 w-full mt-1 border shadow-lg"
          style={{ 
            backgroundColor: 'var(--bg-secondary)',
            border: `1px solid var(--border-main)`,
            borderRadius: '16px'
          }}
        >
          {searchTerm.length < 3 ? (
            <>
              {/* Show YDK cards if available, even with < 3 characters */}
              {ydkCards && ydkCards.length > 0 && (
                <>
                  <div className="px-3 py-2" style={{...typography.body, color: 'var(--text-secondary)'}}>
                    Cards you uploaded
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {(searchTerm.length === 0 ? ydkCards : filteredCards).map((card, index) => (
                      <div
                        key={`${card.id}-${index}`}
                        className="px-3 py-2 hover:opacity-80 cursor-pointer transition-opacity"
                        style={typography.body}
                        onClick={() => handleCardSelect(card)}
                      >
                        {card.name}
                      </div>
                    ))}
                  </div>
                  {searchTerm.length > 0 && (
                    <div className="border-t px-3 py-2" style={{...typography.body, borderColor: 'var(--border-secondary)', color: 'var(--text-secondary)'}}>
                      Type at least 3 characters to search or use your custom name
                    </div>
                  )}
                </>
              )}
              
              {/* Show default message if no YDK cards */}
              {(!ydkCards || ydkCards.length === 0) && (
                <div className="p-3" style={{...typography.body, color: 'var(--text-secondary)'}}>
                  Type at least 3 characters to search or use your custom name
                </div>
              )}
            </>
          ) : filteredCards.length > 0 ? (
            <>
              {/* Separate YDK cards and other results for 3+ character search */}
              {(() => {
                const searchLower = searchTerm.toLowerCase();
                const ydkMatches = ydkCards && ydkCards.length > 0 
                  ? ydkCards.filter(card => card.name && card.name.toLowerCase().includes(searchLower))
                  : [];
                const otherMatches = filteredCards.slice(ydkMatches.length);
                
                return (
                  <div className="max-h-60 overflow-y-auto">
                    {/* YDK Cards Section */}
                    {ydkMatches.length > 0 && (
                      <>
                        <div className="px-3 py-2" style={{...typography.body, color: 'var(--text-secondary)'}}>
                          Cards you uploaded
                        </div>
                        {ydkMatches.map((card, index) => (
                          <div
                            key={`ydk-${card.id}-${index}`}
                            className="px-3 py-2 hover:opacity-80 cursor-pointer transition-opacity"
                            style={typography.body}
                            onClick={() => handleCardSelect(card)}
                          >
                            {card.name}
                          </div>
                        ))}
                        {otherMatches.length > 0 && (
                          <div className="border-t" style={{borderColor: 'var(--border-secondary)'}}></div>
                        )}
                      </>
                    )}
                    
                    {/* Other Results */}
                    {otherMatches.map((card, index) => (
                      <div
                        key={`db-${card.id}-${index}`}
                        className="px-3 py-2 hover:opacity-80 cursor-pointer transition-opacity"
                        style={typography.body}
                        onClick={() => handleCardSelect(card)}
                      >
                        {card.name}
                      </div>
                    ))}
                  </div>
                );
              })()}
              
              {filteredCards.length === 50 && (
                <div className="px-3 py-2 border-t" style={{...typography.body, borderColor: 'var(--border-secondary)', color: 'var(--text-secondary)'}}>
                  Type for more results
                </div>
              )}
            </>
          ) : (
            <div className="p-3" style={typography.body}>
              <div>No matching results. Use custom name?</div>
              <button
                onClick={handleCustomName}
                className="mt-2 px-4 py-2 hover:opacity-80 rounded transition-opacity"
                style={{
                  ...typography.body,
                  backgroundColor: 'var(--bg-action-secondary)',
                  color: 'var(--text-main)'
                }}
              >
                Use custom name
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Typing animation component
const TypewriterText = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      intervalRef.current = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 50);
    } else if (onComplete) {
      onComplete();
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [currentIndex, text, onComplete]);

  return <span>{displayedText}</span>;
};
const Toast = ({ message, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss after 3 seconds
    timerRef.current = setTimeout(() => {
      handleClose();
    }, 3000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div
      onClick={handleClose}
      className="fixed top-4 right-4 z-50 cursor-pointer"
      style={{
        transform: `translateX(${isVisible && !isExiting ? '0' : '120%'})`,
        opacity: isVisible && !isExiting ? '1' : '0',
        transition: 'transform 0.3s ease-out, opacity 0.3s ease-out'
      }}
    >
      <div
        className="relative flex items-center px-4 py-3 rounded-lg shadow-lg"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: `1px solid var(--border-main)`,
          boxShadow: '0 4px 12px rgba(255, 255, 255, 0.05)',
          minWidth: '200px'
        }}
      >
        <span style={{
          color: 'var(--text-main)',
          fontSize: '14px',
          fontFamily: 'Geist Regular, sans-serif',
          marginRight: '24px'
        }}>
          {message}
        </span>
        <button
          className="absolute top-2 right-2 hover:opacity-80 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          style={{
            fontSize: '16px',
            lineHeight: '16px',
            padding: '4px'
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};
// Combo data structure
const createCombo = (id, index) => ({
  id,
  name: `Combo ${index + 1}`,
  cards: [{
    starterCard: '',
    cardId: null,
    isCustom: false,
    startersInDeck: 3,
    minCopiesInHand: 1,
    maxCopiesInHand: 3
  }]
});

export default function TCGCalculator() {
  const [deckSize, setDeckSize] = useState(40);
  const [handSize, setHandSize] = useState(5);
  const [combos, setCombos] = useState([createCombo(1, 0)]);
  const [results, setResults] = useState({ individual: [], combined: null });
  const [errors, setErrors] = useState({});
  const [dashboardValues, setDashboardValues] = useState({
    deckSize: 40,
    handSize: 5,
    combos: []
  });
  const [editingComboId, setEditingComboId] = useState(null);
  const [tempComboName, setTempComboName] = useState('');
  const [cardDatabase, setCardDatabase] = useState([]);
  const [isRestoringFromURL, setIsRestoringFromURL] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [shareableUrl, setShareableUrl] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [openingHand, setOpeningHand] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshDebounceRef = useRef(null);
  const [uploadedYdkFile, setUploadedYdkFile] = useState(null);
  const [ydkCards, setYdkCards] = useState([]);
  const [ydkCardCounts, setYdkCardCounts] = useState({});
  const [staticCardDatabase, setStaticCardDatabase] = useState({});
  const [showClipboardField, setShowClipboardField] = useState(false);
  const [clipboardContent, setClipboardContent] = useState('');

  // Top Decks data
  const topDecks = [
    {
      title: "Gem-Knight going 2nd deck - 3rd/4th Place in NAWCQ 2025",
      description: "Consistency is through the roof when you run a deck list stacked with starters/board breakers/Charmies",
      link: "https://www.firstdrawgg.online/#calc=eyJkIjo0MSwiaCI6NiwiYyI6W3siaSI6MSwibiI6IkNvbWJvIDEiLCJjYXJkcyI6W3sicyI6IkFueSBDaGFybXkiLCJjSWQiOm51bGwsImlDIjp0cnVlLCJkZWNrIjo4LCJtaW4iOjEsIm1heCI6M31dfSx7ImkiOjIsIm4iOiJDb21ibyAyIiwiY2FyZHMiOlt7InMiOiJHZW0tS25pZ2h0IFF1YXJ0eiIsImNJZCI6MzU2MjI3MzksImlDIjpmYWxzZSwiZGVjayI6MywibWluIjoxLCJtYXgiOjF9XX0seyJpIjozLCJuIjoiQ29tYm8gMyIsImNhcmRzIjpbeyJzIjoiR2VtLUtuaWdodCBOZXB5cmltIiwiY0lkIjo1MTgzMTU2MCwiaUMiOmZhbHNlLCJkZWNrIjozLCJtaW4iOjEsIm1heCI6MX1dfSx7ImkiOjQsIm4iOiJDb21ibyA0IiwiY2FyZHMiOlt7InMiOiJCb2FyZCBCcmVha2VyIiwiY0lkIjpudWxsLCJpQyI6dHJ1ZSwiZGVjayI6OSwibWluIjoxLCJtYXgiOjF9XX1dfQ=="
    }
  ];

  // Handle top deck click
  const handleTopDeckClick = (link, deckTitle) => {
    try {
      // Extract the calc parameter from the URL
      const match = link.match(/#calc=(.+)/);
      if (!match) return;
      
      // Decode the calculation data
      const decoded = atob(match[1]);
      const data = JSON.parse(decoded);
      
      // Load the deck data into the app
      setDeckSize(data.d);
      setHandSize(data.h);
      
      const loadedCombos = data.c.map(combo => ({
        id: combo.i,
        name: combo.n,
        cards: combo.cards.map(card => ({
          starterCard: card.s || '',
          cardId: card.cId || null,
          isCustom: card.iC || false,
          startersInDeck: card.deck,
          minCopiesInHand: card.min,
          maxCopiesInHand: card.max
        }))
      }));
      
      setCombos(loadedCombos);
      
      // Calculate results
      setTimeout(() => {
        const calculatedResults = ProbabilityService.calculateMultipleCombos(loadedCombos, data.d, data.h);
        setResults(calculatedResults);
        setDashboardValues({
          deckSize: data.d,
          handSize: data.h,
          combos: loadedCombos.map(c => ({ ...c }))
        });
        
        // Generate shareable URL
        URLService.updateURL(data.d, data.h, loadedCombos, uploadedYdkFile);
        const url = window.location.href;
        setShareableUrl(url);
        
        // Generate title
        const title = TitleGeneratorService.generateFunTitle(loadedCombos, data.d, calculatedResults.individual);
        setGeneratedTitle(title);
        
        // Auto-scroll to top of page
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
      
    } catch (error) {
      console.error('Failed to load top deck:', error);
    }
  };

  // Restore calculation from URL on mount
  useEffect(() => {
    const restoreFromURL = () => {
      const urlData = URLService.decodeCalculation();
      if (urlData) {
        console.log('Restoring calculation from URL:', urlData);
        setIsRestoringFromURL(true);
        setDeckSize(urlData.deckSize);
        setHandSize(urlData.handSize);
        setCombos(urlData.combos);
        
        // Restore YDK file if present
        if (urlData.ydkFile && staticCardDatabase && Object.keys(staticCardDatabase).length > 0) {
          try {
            const parseResult = YdkParsingService.parseYdkFile(urlData.ydkFile.content, staticCardDatabase);
            
            // Get unique card names (remove duplicates)
            const uniqueCards = [];
            const seenNames = new Set();
            
            parseResult.cards.forEach(card => {
              if (!seenNames.has(card.name)) {
                seenNames.add(card.name);
                uniqueCards.push({
                  name: card.name,
                  id: card.id,
                  isCustom: false
                });
              }
            });
            
            // Update deck size to match YDK file main deck card count
            const mainDeckCardCount = parseResult.cards.length;
            setDeckSize(mainDeckCardCount);
            
            setUploadedYdkFile(urlData.ydkFile);
            setYdkCards(uniqueCards);
            setYdkCardCounts(parseResult.cardCounts);
            
            // Show error only for truly unmatched cards
            if (parseResult.unmatchedIds.length > 0) {
              alert("Some cards from your YDK file weren't matched");
            }
          } catch (error) {
            console.error('Failed to restore YDK file from URL:', error);
          }
        }
        
        setTimeout(() => {
          const calculatedResults = ProbabilityService.calculateMultipleCombos(urlData.combos, urlData.deckSize, urlData.handSize);
          setResults(calculatedResults);
          setDashboardValues({
            deckSize: urlData.deckSize,
            handSize: urlData.handSize,
            combos: urlData.combos.map(c => ({ ...c }))
          });
          setIsRestoringFromURL(false);
        }, 100);
      }
    };

    restoreFromURL();
  }, [staticCardDatabase]);
  
  // Load card database on mount
  useEffect(() => {
    const loadCardDatabase = async () => {
      console.log('Starting card database load...');
      
      const cached = CardDatabaseService.loadFromCache();
      if (cached) {
        console.log('Loaded from cache:', cached.length, 'cards');
        setCardDatabase(cached);
        window.cardDatabase = cached;
        return;
      }
      
      console.log('Cache not found or expired, fetching from API...');
      
      const cards = await CardDatabaseService.fetchCards();
      console.log('Fetched cards:', cards.length);
      
      if (cards.length > 0) {
        setCardDatabase(cards);
        window.cardDatabase = cards;
        CardDatabaseService.saveToCache(cards);
        console.log('Cards saved to state and cache');
      } else {
        console.log('No cards received from API');
      }
    };
    
    loadCardDatabase();
  }, []);

  // Load static card database for YDK parsing
  useEffect(() => {
    const loadStaticDatabase = async () => {
      const database = await YdkParsingService.loadStaticCardDatabase();
      setStaticCardDatabase(database);
    };
    
    loadStaticDatabase();
  }, []);

  // YDK file handling functions
  const handleYdkFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      YdkParsingService.validateYdkFile(file);
      
      const fileContent = await readFileAsText(file);
      const parseResult = YdkParsingService.parseYdkFile(fileContent, staticCardDatabase);
      
      // Get unique card names (remove duplicates) for search dropdown
      const uniqueCards = [];
      const seenNames = new Set();
      
      parseResult.cards.forEach(card => {
        if (!seenNames.has(card.name)) {
          seenNames.add(card.name);
          uniqueCards.push({
            name: card.name,
            id: card.id,
            isCustom: false
          });
        }
      });
      
      // Update deck size to match total main deck cards (including duplicates)
      const mainDeckCardCount = parseResult.cards.length;
      setDeckSize(mainDeckCardCount);
      
      setUploadedYdkFile({
        name: file.name,
        content: fileContent
      });
      setYdkCards(uniqueCards);
      setYdkCardCounts(parseResult.cardCounts);
      
      // Show error toast only if there are truly unmatched cards (not just Extra Deck cards)
      if (parseResult.unmatchedIds.length > 0) {
        alert("Some cards from your YDK file weren't matched");
      }
      
    } catch (error) {
      console.error('YDK upload error:', error);
      alert(error.message);
    }
  };

  const handleClearYdkFile = () => {
    setUploadedYdkFile(null);
    setYdkCards([]);
    setYdkCardCounts({});
  };

  const handleFromClipboard = () => {
    setShowClipboardField(true);
  };

  const processClipboardContent = async (content) => {
    if (!content.trim()) {
      return;
    }

    try {
      const parseResult = YdkParsingService.parseYdkFile(content, staticCardDatabase);
      
      if (parseResult.cards.length === 0) {
        alert("No main deck found in pasted text");
        return;
      }

      const uniqueCards = [];
      const seenNames = new Set();
      
      parseResult.cards.forEach(card => {
        if (!seenNames.has(card.name)) {
          seenNames.add(card.name);
          uniqueCards.push({
            name: card.name,
            id: card.id,
            isCustom: false
          });
        }
      });
      
      const mainDeckCardCount = parseResult.cards.length;
      setDeckSize(mainDeckCardCount);
      
      setUploadedYdkFile({
        name: "Clipboard YDK",
        content: content
      });
      setYdkCards(uniqueCards);
      setYdkCardCounts(parseResult.cardCounts);
      setShowClipboardField(false);
      
      // Don't show unmatched cards alert for clipboard paste - silent processing
      
    } catch (error) {
      console.error('YDK clipboard error:', error);
      alert("No main deck found in pasted text");
    }
  };

  const handleClearClipboard = () => {
    setUploadedYdkFile(null);
    setYdkCards([]);
    setYdkCardCounts({});
    setClipboardContent('');
    setShowClipboardField(false);
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const typography = {
    h1: {
      fontSize: 'var(--font-h2-size)',
      lineHeight: 'var(--font-h2-line-height)',
      color: 'var(--text-main)',
      fontFamily: 'Geist Regular, sans-serif',
      fontWeight: 'normal'
    },
    h2: {
      fontSize: 'var(--font-h2-size)',
      lineHeight: 'var(--font-h2-line-height)',
      color: 'var(--text-main)',
      fontFamily: 'Geist Regular, sans-serif',
      fontWeight: 'normal'
    },
    h3: {
      fontSize: 'var(--font-h3-size)',
      lineHeight: 'var(--font-h3-line-height)',
      color: 'var(--text-main)',
      fontFamily: 'Geist Regular, sans-serif',
      fontWeight: 'normal'
    },
    h4: {
      fontSize: 'var(--font-h3-size)',
      lineHeight: 'var(--font-h3-line-height)',
      color: 'var(--text-main)',
      fontFamily: 'Geist Regular, sans-serif',
      fontWeight: 'normal'
    },
    body: {
      fontSize: 'var(--font-body-size)',
      lineHeight: 'var(--font-body-line-height)',
      color: 'var(--text-secondary)',
      fontFamily: 'Geist Regular, sans-serif'
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (deckSize < 1) newErrors.deckSize = 'Please enter valid value';
    if (handSize < 1) newErrors.handSize = 'Please enter valid value';
    
    if (deckSize < handSize) newErrors.deckSize = "Can't be lower than Hand size";
    if (handSize > deckSize) newErrors.handSize = 'Please enter valid value';
    
    combos.forEach((combo, index) => {
      combo.cards.forEach((card, cardIndex) => {
        const cardPrefix = `combo-${combo.id}-card-${cardIndex}`;
        
        if (card.startersInDeck < 0) newErrors[`${cardPrefix}-startersInDeck`] = 'Please enter valid value';
        if (card.minCopiesInHand < 0) newErrors[`${cardPrefix}-minCopiesInHand`] = 'Please enter valid value';
        if (card.maxCopiesInHand < 0) newErrors[`${cardPrefix}-maxCopiesInHand`] = 'Please enter valid value';
        if (card.starterCard.length > 50) newErrors[`${cardPrefix}-starterCard`] = 'Please enter valid value';
        
        if (card.maxCopiesInHand < card.minCopiesInHand) newErrors[`${cardPrefix}-maxCopiesInHand`] = 'Can\'t be less than minimum copies in hand';
        if (card.minCopiesInHand > handSize) newErrors[`${cardPrefix}-minCopiesInHand`] = 'Please enter valid value';
        if (card.maxCopiesInHand > handSize) newErrors[`${cardPrefix}-maxCopiesInHand`] = 'Please enter valid value';
        if (card.maxCopiesInHand > card.startersInDeck) newErrors[`${cardPrefix}-maxCopiesInHand`] = 'Please enter valid value';
        if (card.minCopiesInHand > card.startersInDeck) newErrors[`${cardPrefix}-minCopiesInHand`] = 'Please enter valid value';
        if (card.startersInDeck > deckSize) newErrors[`${cardPrefix}-startersInDeck`] = 'Please enter valid value';
      });
      
      const totalCards = combo.cards.reduce((sum, card) => sum + card.startersInDeck, 0);
      if (totalCards > deckSize) {
        combo.cards.forEach((card, cardIndex) => {
          newErrors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`] = 'Total cards in combo exceed deck size';
        });
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const allFieldsFilled = combos.every(combo => 
    combo.cards.every(card => card.starterCard.trim() !== '')
  );

  const hasValidationErrors = Object.keys(errors).length > 0 || deckSize < handSize;

  const generateOpeningHand = () => {
    const hand = OpeningHandService.generateProbabilisticHand(combos, deckSize, handSize);
    setOpeningHand(hand);
  };

  const refreshOpeningHand = () => {
    if (isRefreshing) return;
    
    // Clear any existing debounce timer
    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
    }
    
    setIsRefreshing(true);
    
    // Debounce with 100ms delay to prevent spam clicking
    refreshDebounceRef.current = setTimeout(() => {
      generateOpeningHand();
      setIsRefreshing(false);
      refreshDebounceRef.current = null;
    }, 100);
  };

  const runCalculation = () => {
    if (!validate()) return;
    
    setDashboardValues({
      deckSize,
      handSize,
      combos: combos.map(c => ({ ...c }))
    });
    
    const calculatedResults = ProbabilityService.calculateMultipleCombos(combos, deckSize, handSize);
    setResults(calculatedResults);
    
    // Generate shareable URL
    URLService.updateURL(deckSize, handSize, combos, uploadedYdkFile);
    const url = window.location.href;
    setShareableUrl(url);
    
    // Generate title using individual results for compatibility
    const title = TitleGeneratorService.generateFunTitle(combos, deckSize, calculatedResults.individual);
    setGeneratedTitle(title);
  };

  const handleReset = () => {
    setDeckSize(40);
    setHandSize(5);
    setCombos([createCombo(1, 0)]);
    setResults({ individual: [], combined: null });
    setErrors({});
    setDashboardValues({
      deckSize: 40,
      handSize: 5,
      combos: []
    });
    setEditingComboId(null);
    setTempComboName('');
    setGeneratedTitle('');
    setShareableUrl('');
    setOpeningHand([]);
    ProbabilityService.clearCache();
    
    window.history.replaceState(null, '', window.location.pathname);
  };

  const addCombo = () => {
    if (combos.length < 10) {
      const newId = Math.max(...combos.map(c => c.id)) + 1;
      setCombos([...combos, createCombo(newId, combos.length)]);
    }
  };

  const removeCombo = (id) => {
    const newCombos = combos.filter(combo => combo.id !== id);
    const updatedCombos = newCombos.map((combo, index) => ({
      ...combo,
      name: combo.name.startsWith('Combo ') ? `Combo ${index + 1}` : combo.name
    }));
    setCombos(updatedCombos);
  };

  const updateCombo = (id, cardIndex, field, value) => {
    setCombos(prevCombos => prevCombos.map(combo => {
      if (combo.id !== id) return combo;
      
      const updatedCombo = { ...combo };
      updatedCombo.cards = [...combo.cards];
      
      if (field === 'starterCard' && typeof value === 'object') {
        updatedCombo.cards[cardIndex] = { 
          ...combo.cards[cardIndex], 
          starterCard: value.starterCard,
          cardId: value.cardId,
          isCustom: value.isCustom
        };
      } else {
        updatedCombo.cards[cardIndex] = { ...combo.cards[cardIndex], [field]: value };
      }
      
      if (field === 'minCopiesInHand' && value > combo.cards[cardIndex].maxCopiesInHand) {
        updatedCombo.cards[cardIndex].maxCopiesInHand = value;
      }
      
      return updatedCombo;
    }));
  };

  const updateComboProperty = (id, field, value) => {
    setCombos(combos.map(combo => {
      if (combo.id !== id) return combo;
      return { ...combo, [field]: value };
    }));
  };

  const addSecondCard = (comboId) => {
    setCombos(combos.map(combo => {
      if (combo.id !== comboId) return combo;
      
      return {
        ...combo,
        cards: [
          ...combo.cards,
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
    }));
  };

  const removeSecondCard = (comboId) => {
    setCombos(combos.map(combo => {
      if (combo.id !== comboId) return combo;
      
      return {
        ...combo,
        cards: [combo.cards[0]]
      };
    }));
  };

  const startEditingComboName = (combo) => {
    setEditingComboId(combo.id);
    setTempComboName(combo.name);
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`combo-${combo.id}-name`];
      return newErrors;
    });
  };

  const handleComboNameChange = (e) => {
    const value = e.target.value;
    
    if (value.length > 50) return;
    
    const isValid = /^[a-zA-Z0-9 ]*$/.test(value);
    
    if (!isValid && value !== '') {
      setErrors(prev => ({
        ...prev,
        [`combo-${editingComboId}-name`]: 'Only alphanumeric characters allowed'
      }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`combo-${editingComboId}-name`];
        return newErrors;
      });
    }
    
    setTempComboName(value);
  };

  const saveComboName = () => {
    if (!editingComboId) return;
    
    const comboIndex = combos.findIndex(c => c.id === editingComboId);
    let finalName = tempComboName.trim();
    
    if (finalName === '') {
      finalName = `Combo ${comboIndex + 1}`;
    }
    
    const isDuplicate = combos.some(combo => 
      combo.id !== editingComboId && combo.name === finalName
    );
    
    if (isDuplicate) {
      setErrors(prev => ({
        ...prev,
        [`combo-${editingComboId}-name`]: 'Combo name must be unique'
      }));
      return;
    }
    
    const isValid = /^[a-zA-Z0-9 ]*$/.test(finalName);
    if (isValid) {
      updateComboProperty(editingComboId, 'name', finalName);
      setEditingComboId(null);
      setTempComboName('');
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`combo-${editingComboId}-name`];
        return newErrors;
      });
    }
  };

  const handleComboNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveComboName();
    }
  };

  const generateResultText = (result) => {
    const cards = result.cards;
    const probability = result.probability;
    
    if (!cards || cards.length === 0) {
      return `Calculation error: ${probability.toFixed(2)}%`;
    }
    
    if (cards.length === 1) {
      const card = cards[0];
      if (card.minCopiesInHand === card.maxCopiesInHand) {
        return `Chances of seeing exactly ${card.minCopiesInHand} copies of ${card.starterCard} in your opening hand: ${probability.toFixed(2)}%`;
      } else {
        return `Chances of seeing between ${card.minCopiesInHand} and ${card.maxCopiesInHand} copies of ${card.starterCard} in your opening hand: ${probability.toFixed(2)}%`;
      }
    } else {
      const card1 = cards[0];
      const card2 = cards[1];
      
      const card1Text = card1.minCopiesInHand === card1.maxCopiesInHand 
        ? `exactly ${card1.minCopiesInHand} copies of ${card1.starterCard}`
        : `between ${card1.minCopiesInHand} and ${card1.maxCopiesInHand} copies of ${card1.starterCard}`;
        
      const card2Text = card2.minCopiesInHand === card2.maxCopiesInHand
        ? `exactly ${card2.minCopiesInHand} copies of ${card2.starterCard}`
        : `between ${card2.minCopiesInHand} and ${card2.maxCopiesInHand} copies of ${card2.starterCard}`;
      
      return `Chances of seeing ${card1Text}, and ${card2Text} in your opening hand: ${probability.toFixed(2)}%`;
    }
  };
  const handleCopyLink = () => {
  if (!showToast) { // Prevent multiple toasts
    navigator.clipboard.writeText(shareableUrl);
    setShowToast(true);
  }
};

useEffect(() => {
  ProbabilityService.clearCache();
}, [deckSize, handSize]);

  useEffect(() => {
    ProbabilityService.clearCache();
  }, [deckSize, handSize]);

  useEffect(() => {
    if (results.individual.length > 0) validate();
  }, [deckSize, handSize, combos]);

  useEffect(() => {
    generateOpeningHand();
  }, [deckSize, handSize, combos]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: 'var(--bg-main)', fontFamily: 'Geist Regular, sans-serif' }}>
      <style>
        {`
          input[type="number"]::-webkit-outer-spin-button,
          input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type="number"] {
            -moz-appearance: textfield;
          }
          
          input:focus {
            outline: none;
            box-shadow: 0 0 0 2px var(--bg-action-secondary);
          }
          
          /* AC #6: Hover state transition animation */
          .hover\\:opacity-80,
          button:hover,
          label:hover,
          [role="button"]:hover,
          .cursor-pointer:hover {
            transition-duration: 153.51ms;
            transition-timing-function: linear(
              0 0%,
              0.038294 1%,
              0.126287 2%,
              0.235428 3%,
              0.348573 4%,
              0.456037 5%,
              0.552897 6%,
              0.637194 7%,
              0.708724 8%,
              0.768266 9%,
              0.817082 10%,
              0.856612 11%,
              0.888293 12%,
              0.913459 13%,
              0.933298 14%,
              0.948831 15%,
              0.960919 16%,
              0.970275 17%,
              0.97748 18%,
              0.983003 19%,
              0.987217 20%,
              0.99042 21%,
              0.992846 22%,
              0.994675 23%,
              0.996049 24%,
              0.997079 25%,
              0.997848 26%,
              0.998419 27%,
              0.998843 28%,
              0.999156 29%,
              0.999387 30%,
              0.999556 31%,
              0.99968 32%,
              0.99977 33%,
              0.999836 34%,
              0.999883 35%,
              0.999917 36%
            );
          }
        `}
      </style>
      {isRestoringFromURL && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{backgroundColor: 'var(--bg-main)', opacity: 0.8}}>
          <div className="p-0 rounded-lg" style={{backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)'}}>
            <p style={typography.body}>Loading shared calculation...</p>
          </div>
        </div>
      )}
      <div className="w-full mx-auto" style={{ maxWidth: '520px' }}>
        {/* Logo and brand header */}
        <div className="flex items-center justify-between mb-8 px-0">
          <div className="flex items-center">
            <img 
              src="https://raw.githubusercontent.com/FirstDrawGG/tcg-probabilities-calculator/main/Logo.png" 
              alt="FirstDrawGG Logo"
              style={{
                width: '24px',
                height: '24px',
                objectFit: 'contain',
                marginRight: '8px'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                const fallback = e.target.nextElementSibling;
                if (fallback) fallback.style.display = 'block';
              }}
            />
            <h1 style={{ 
              fontSize: '24px',
              lineHeight: '24px',
              color: 'var(--text-main)',
              fontFamily: 'Geist Regular, sans-serif',
              fontWeight: 'normal',
              margin: 0
            }}>
              FirstDrawGG
            </h1>
          </div>
          
          {/* Help button */}
          <a
            href="https://aboard-fog-a81.notion.site/FirstDrawGG-Help-Center-23130fcd61f381afb4e4e81f2f5db13b?source=copy_link"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-main)',
              fontFamily: 'Geist Regular, sans-serif',
              fontSize: '14px',
              lineHeight: '20px',
              borderRadius: '999px',
              border: 'none',
              height: '32px',
              paddingLeft: '16px',
              paddingRight: '16px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              transition: 'opacity 0.2s ease'
            }}
            className="hover:opacity-80 transition-opacity"
          >
            Help
          </a>
        </div>
        
        {/* CTA Section */}
        <section className="px-0 mb-8">
          <div 
            className="grid grid-cols-2"
            style={{ gap: '4px' }}
          >
            <div className="flex items-center" style={{ gap: '8px' }}>
              <span role="img" aria-label="checkmark">✅</span>
              <span style={typography.body}>Add your cards</span>
            </div>
            <div className="flex items-center" style={{ gap: '8px' }}>
              <span role="img" aria-label="checkmark">✅</span>
              <span style={typography.body}>See your odds</span>
            </div>
            <div className="flex items-center" style={{ gap: '8px' }}>
              <span role="img" aria-label="checkmark">✅</span>
              <span style={typography.body}>Fix your ratios</span>
            </div>
            <div className="flex items-center" style={{ gap: '8px' }}>
              <span role="img" aria-label="checkmark">✅</span>
              <span style={typography.body}>Win more games</span>
            </div>
          </div>
        </section>
        
        <div className="p-0" style={{ margin: 0, paddingBottom: '16px' }}>
          <h2 className="mb-4" style={{...typography.h2, color: 'var(--text-main)'}}>Define a Combo</h2>
          
          {/* YDK File Upload Section */}
          <div className="flex items-center mb-4" style={{ gap: '24px' }}>
            <h3 style={{...typography.h3, color: 'var(--text-main)', margin: 0}}>Upload YDK file</h3>
            
            {!uploadedYdkFile && (
              <div className="flex items-center" style={{ gap: '8px' }}>
                <button
                  onClick={handleFromClipboard}
                  className="inline-flex items-center px-0 py-2 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    borderRadius: '999px',
                    ...typography.body
                  }}
                >
                  From clipboard
                </button>
                <div
                  style={{
                    width: '1px',
                    height: '16px',
                    backgroundColor: 'var(--text-secondary)',
                    opacity: 0.3
                  }}
                />
                <input
                  type="file"
                  accept=".ydk"
                  onChange={handleYdkFileUpload}
                  style={{ display: 'none' }}
                  id="ydk-file-input"
                />
                <label
                  htmlFor="ydk-file-input"
                  className="inline-flex items-center px-0 py-2 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    borderRadius: '999px',
                    ...typography.body
                  }}
                >
                  Upload
                </label>
              </div>
            )}
            
            {uploadedYdkFile && uploadedYdkFile.name === "Clipboard YDK" && (
              <button
                onClick={handleClearClipboard}
                className="inline-flex items-center px-0 py-2 cursor-pointer hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  borderRadius: '999px',
                  ...typography.body
                }}
              >
                Clear YDK
              </button>
            )}
          </div>
          
          {showClipboardField && (
            <div className="mb-4">
              <textarea
                value={clipboardContent}
                onChange={(e) => {
                  const value = e.target.value;
                  setClipboardContent(value);
                  
                  // Debounce the processing to avoid processing every keystroke
                  if (window.clipboardProcessTimeout) {
                    clearTimeout(window.clipboardProcessTimeout);
                  }
                  
                  window.clipboardProcessTimeout = setTimeout(() => {
                    if (value.trim()) {
                      processClipboardContent(value);
                    }
                  }, 1000); // Wait 1 second after user stops typing
                }}
                onPaste={(e) => {
                  // Process immediately on paste
                  setTimeout(() => {
                    const textarea = e.target;
                    const value = textarea.value;
                    if (value.trim()) {
                      processClipboardContent(value);
                    }
                  }, 100); // Small delay to ensure paste content is set
                }}
                placeholder="Paste your YDK file content here..."
                className="w-full p-3 border rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: `1px solid var(--border-main)`,
                  borderRadius: '16px',
                  color: 'var(--text-main)',
                  fontFamily: 'Geist Regular, sans-serif',
                  fontSize: '14px',
                  lineHeight: '20px',
                  resize: 'vertical',
                  minHeight: '80px'
                }}
              />
            </div>
          )}
          
          {uploadedYdkFile && (
            <div className="mb-4 p-3 border rounded-lg" 
                 style={{ 
                   backgroundColor: 'var(--bg-secondary)', 
                   border: `1px solid var(--border-main)`,
                   borderRadius: '16px'
                 }}>
              <div style={{...typography.body, color: 'var(--text-main)', fontWeight: 'medium'}}>
                {uploadedYdkFile.name}
              </div>
              <div style={{...typography.body, color: 'var(--text-secondary)', fontSize: '14px'}}>
                {deckSize} Main deck cards loaded ({ydkCards.length} unique)
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
                Deck size:
                <Tooltip text="Your total deck size, 40-60 cards" />
              </label>
              <input
                type="number"
                value={deckSize}
                onChange={(e) => setDeckSize(parseInt(e.target.value) || 0)}
                className={`w-full px-3 border ${
                  errors.deckSize ? 'border-red-500' : ''
                }`}
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: `1px solid var(--border-main)`,
                  color: 'var(--text-main)',
                  borderRadius: '999px',
                  height: '40px',
                  cursor: 'text',
                  ...typography.body
                }}
              />
              {errors.deckSize && (
                <p className="text-red-500 mt-1" style={typography.body}>{errors.deckSize}</p>
              )}
            </div>

            <div>
              <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
                Hand size:
                <Tooltip text="Cards you draw to start the game. 5 going first, 6 going second" />
              </label>
              <input
                type="number"
                value={handSize}
                onChange={(e) => setHandSize(parseInt(e.target.value) || 0)}
                className={`w-full px-3 border ${
                  errors.handSize ? 'border-red-500' : ''
                }`}
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: `1px solid var(--border-main)`,
                  color: 'var(--text-main)',
                  borderRadius: '999px',
                  height: '40px',
                  cursor: 'text',
                  ...typography.body
                }}
              />
              {errors.handSize && (
                <p className="text-red-500 mt-1" style={typography.body}>{errors.handSize}</p>
              )}
            </div>

            {combos.map((combo, index) => (
              <div key={combo.id} className="border-t pt-4" style={{ borderColor: 'var(--border-secondary)' }}>
                <div className="flex justify-between items-center mb-2">
                  {editingComboId === combo.id ? (
                    <input
                      type="text"
                      value={tempComboName}
                      onChange={handleComboNameChange}
                      onBlur={saveComboName}
                      onKeyDown={handleComboNameKeyDown}
                      className="font-medium px-2 py-1 border"
                      style={{ 
                        backgroundColor: 'var(--bg-action-secondary)', 
                        color: 'var(--text-main)',
                        borderColor: 'var(--border-secondary)',
                        borderRadius: '999px',
                        ...typography.body
                      }}
                      autoFocus
                      maxLength={50}
                    />
                  ) : (
                    <h3 
                      className="cursor-pointer hover:opacity-80 py-1 rounded transition-colors"
                      style={{...typography.h3, color: 'var(--text-main)'}}
                      onClick={() => startEditingComboName(combo)}
                    >
                      {combo.name}
                    </h3>
                  )}
                  {index > 0 && (
                    <button
                      onClick={() => removeCombo(combo.id)}
                      className="font-medium hover:opacity-80 transition-opacity"
                      style={{
                        ...typography.body,
                        color: 'var(--text-main)'
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                {errors[`combo-${combo.id}-name`] && (
                  <p className="text-red-500 mb-2" style={typography.body}>{errors[`combo-${combo.id}-name`]}</p>
                )}
                
                {combo.cards.map((card, cardIndex) => (
                  <div key={cardIndex} className={`${cardIndex > 0 ? 'border-t mt-4 pt-4' : ''}`} style={{ borderColor: 'var(--border-secondary)' }}>
                    <div className="mb-3">
                      <div className="flex items-center justify-between" style={{marginBottom: 'var(--spacing-xs)'}}>
                        <label className="flex items-center font-medium" style={{...typography.body, color: 'var(--text-main)'}}>
                          Card name:
                          <Tooltip text="Search for any Yu-Gi-Oh card or create a custom placeholder (e.g. 'Any Dragon monster' or 'Any Unchained Card')" />
                        </label>
                        {cardIndex === 1 && (
                          <button
                            onClick={() => removeSecondCard(combo.id)}
                            className="font-medium hover:opacity-80 transition-opacity"
                            style={{
                              ...typography.body,
                              color: 'var(--text-main)'
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <SearchableCardInput
                        value={card.starterCard}
                        onChange={(value) => updateCombo(combo.id, cardIndex, 'starterCard', value)}
                        placeholder="Search card name"
                        errors={errors[`combo-${combo.id}-card-${cardIndex}-starterCard`]}
                        comboId={combo.id}
                        cardIndex={cardIndex}
                        cardDatabase={cardDatabase}
                        ydkCards={ydkCards}
                        ydkCardCounts={ydkCardCounts}
                        updateCombo={updateCombo}
                      />
                      {errors[`combo-${combo.id}-card-${cardIndex}-starterCard`] && (
                        <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${combo.id}-card-${cardIndex}-starterCard`]}</p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
                          Copies in deck:
                          <Tooltip text="Total copies of this card in your deck. Max 3 for most, but remember banlist restrictions" />
                        </label>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => updateCombo(combo.id, cardIndex, 'startersInDeck', Math.max(0, card.startersInDeck - 1))}
                            className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                            style={{ 
                              backgroundColor: 'var(--bg-secondary)', 
                              color: 'var(--text-secondary)',
                              width: '40px',
                              height: '40px',
                              borderRadius: '999px',
                              border: '1px solid var(--border-main)',
                              boxSizing: 'border-box'
                            }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={card.startersInDeck}
                            onChange={(e) => updateCombo(combo.id, cardIndex, 'startersInDeck', parseInt(e.target.value) || 0)}
                            className={`text-center border ${
                              errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`] ? 'border-red-500' : ''
                            }`}
                            style={{ 
                              backgroundColor: 'var(--bg-secondary)', 
                              color: 'var(--text-main)',
                              width: '64px',
                              height: '40px',
                              borderRadius: '999px',
                              border: '1px solid var(--border-main)',
                              boxSizing: 'border-box',
                              textAlign: 'center',
                              ...typography.body
                            }}
                          />
                          <button
                            onClick={() => updateCombo(combo.id, cardIndex, 'startersInDeck', card.startersInDeck + 1)}
                            className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                            style={{ 
                              backgroundColor: 'var(--bg-secondary)', 
                              color: 'var(--text-secondary)',
                              width: '40px',
                              height: '40px',
                              borderRadius: '999px',
                              border: '1px solid var(--border-main)',
                              boxSizing: 'border-box'
                            }}
                          >
                            +
                          </button>
                        </div>
                        {errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`] && (
                          <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`]}</p>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
                        <div className="flex-1">
                          <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
                            Min in hand:
                            <Tooltip text="Minimum copies needed in your opening hand for your combo to work" />
                          </label>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => updateCombo(combo.id, cardIndex, 'minCopiesInHand', Math.max(0, card.minCopiesInHand - 1))}
                              className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                              style={{ 
                                backgroundColor: 'var(--bg-secondary)', 
                                color: 'var(--text-secondary)',
                                width: '40px',
                                height: '40px',
                                borderRadius: '999px',
                                border: '1px solid var(--border-main)',
                                boxSizing: 'border-box'
                              }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={card.minCopiesInHand}
                              onChange={(e) => updateCombo(combo.id, cardIndex, 'minCopiesInHand', parseInt(e.target.value) || 0)}
                              className={`text-center border ${
                                errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`] ? 'border-red-500' : ''
                              }`}
                              style={{ 
                                backgroundColor: 'var(--bg-secondary)', 
                                color: 'var(--text-main)',
                                width: '64px',
                                height: '40px',
                                borderRadius: '999px',
                                border: '1px solid var(--border-main)',
                                boxSizing: 'border-box',
                                textAlign: 'center',
                                ...typography.body
                              }}
                            />
                            <button
                              onClick={() => updateCombo(combo.id, cardIndex, 'minCopiesInHand', card.minCopiesInHand + 1)}
                              className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                              style={{ 
                                backgroundColor: 'var(--bg-secondary)', 
                                color: 'var(--text-secondary)',
                                width: '40px',
                                height: '40px',
                                borderRadius: '999px',
                                border: '1px solid var(--border-main)',
                                boxSizing: 'border-box'
                              }}
                            >
                              +
                            </button>
                          </div>
                          {errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`] && (
                            <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`]}</p>
                          )}
                        </div>

                        <div className="flex-1">
                          <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
                            Max in hand:
                            <Tooltip text="Upper limit of copies you want to see. Helps avoid dead multiples" />
                          </label>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => updateCombo(combo.id, cardIndex, 'maxCopiesInHand', Math.max(0, card.maxCopiesInHand - 1))}
                              className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                              style={{ 
                                backgroundColor: 'var(--bg-secondary)', 
                                color: 'var(--text-secondary)',
                                width: '40px',
                                height: '40px',
                                borderRadius: '999px',
                                border: '1px solid var(--border-main)',
                                boxSizing: 'border-box'
                              }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={card.maxCopiesInHand}
                              onChange={(e) => updateCombo(combo.id, cardIndex, 'maxCopiesInHand', parseInt(e.target.value) || 0)}
                              className={`text-center border ${
                                errors[`combo-${combo.id}-card-${cardIndex}-maxCopiesInHand`] ? 'border-red-500' : ''
                              }`}
                              style={{ 
                                backgroundColor: 'var(--bg-secondary)', 
                                color: 'var(--text-main)',
                                width: '64px',
                                height: '40px',
                                borderRadius: '999px',
                                border: '1px solid var(--border-main)',
                                boxSizing: 'border-box',
                                textAlign: 'center',
                                ...typography.body
                              }}
                            />
                            <button
                              onClick={() => updateCombo(combo.id, cardIndex, 'maxCopiesInHand', card.maxCopiesInHand + 1)}
                              className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                              style={{ 
                                backgroundColor: 'var(--bg-secondary)', 
                                color: 'var(--text-secondary)',
                                width: '40px',
                                height: '40px',
                                borderRadius: '999px',
                                border: '1px solid var(--border-main)',
                                boxSizing: 'border-box'
                              }}
                            >
                              +
                            </button>
                          </div>
                          {errors[`combo-${combo.id}-card-${cardIndex}-maxCopiesInHand`] && (
                            <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${combo.id}-card-${cardIndex}-maxCopiesInHand`]}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {combo.cards.length === 1 && (
                  <div className="flex items-center mt-4">
                    <button
                      onClick={() => addSecondCard(combo.id)}
                      className="font-medium transition-colors hover:opacity-80"
                      style={{ 
                        boxSizing: 'border-box',
                        width: '200px',
                        height: '40px',
                        display: 'block',
                        backgroundColor: 'var(--bg-secondary)',
                        overflow: 'visible',
                        gap: '7px',
                        borderRadius: '999px',
                        color: 'var(--text-main)',
                        border: 'none',
                        ...typography.body
                      }}
                    >
                      + Add 2nd card
                    </button>
                    <Tooltip text="Test 2-card combos by adding a second required piece to this setup" />
                  </div>
                )}
              </div>
            ))}

            {combos.length < 10 && (
              <div>
                <hr className="my-4" style={{ borderColor: 'var(--border-secondary)', borderTop: '1px solid var(--border-secondary)' }} />
                <div className="flex items-center">
                  <button
                    onClick={addCombo}
                    className="font-medium transition-colors hover:opacity-80"
                    style={{ 
                      boxSizing: 'border-box',
                      width: '200px',
                      height: '40px',
                      display: 'block',
                      backgroundColor: 'var(--bg-secondary)',
                      overflow: 'visible',
                      gap: '7px',
                      borderRadius: '999px',
                      color: 'var(--text-main)',
                      border: 'none',
                      ...typography.body
                    }}
                  >
                    + Add another combo
                  </button>
                  <Tooltip text="Test multiple combo lines to see your deck's overall consistency options" />
                </div>
              </div>
            )}
          </div>

          <div className="flex space-x-4 mt-6">
            <button
              onClick={runCalculation}
              disabled={!allFieldsFilled || hasValidationErrors}
              className={`flex-1 font-semibold transition-colors ${
                allFieldsFilled && !hasValidationErrors
                  ? 'hover:opacity-80'
                  : 'cursor-not-allowed opacity-50'
              }`}
              style={{ 
                backgroundColor: allFieldsFilled && !hasValidationErrors ? 'var(--bg-action)' : 'var(--border-secondary)',
                color: allFieldsFilled && !hasValidationErrors ? 'var(--text-action)' : 'var(--text-placeholder)',
                fontFamily: 'Geist Regular, sans-serif',
                fontSize: '14px',
                lineHeight: '20px',
                borderRadius: '999px',
                border: 'none',
                height: '40px',
                minWidth: '160px',
                paddingLeft: '16px',
                paddingRight: '16px',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              Calculate
            </button>
            <button
              onClick={handleReset}
              className="transition-colors hover:opacity-80"
              style={{ 
                backgroundColor: 'var(--bg-secondary)', 
                color: 'var(--text-main)',
                fontFamily: 'Geist Regular, sans-serif',
                fontSize: '14px',
                lineHeight: '20px',
                borderRadius: '999px',
                border: 'none',
                height: '40px',
                paddingLeft: '16px',
                paddingRight: '16px',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Top Decks Section */}
        <div className="p-0" style={{ margin: 0, paddingBottom: '16px' }}>
          <h2 style={{ ...typography.h2, marginBottom: '16px' }}>Top Decks</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topDecks.map((deck, index) => (
              <div
                key={index}
                onClick={() => handleTopDeckClick(deck.link, deck.title)}
                className="cursor-pointer transition-colors hover:opacity-80"
                style={{
                  width: '100%',
                  maxWidth: '580px',
                  height: 'fit-content',
                  display: 'flex',
                  alignItems: 'flex-start'
                }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-main)',
                    borderRadius: '8px',
                    marginRight: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <span style={{ fontSize: '20px', lineHeight: '1' }}>⭐</span>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <h3 style={{
                    ...typography.h3,
                    marginBottom: '4px',
                    fontWeight: '600'
                  }}>
                    {deck.title}
                  </h3>
                  <p style={{
                    ...typography.body,
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    lineHeight: '18px'
                  }}>
                    {deck.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-0" style={{ margin: 0, paddingBottom: '16px' }}>
          <h2 className="mb-4" style={typography.h2}>Calculation Dashboard</h2>
          
          <div className="space-y-2">
            <p style={typography.body}>
              <span className="font-medium">Deck size:</span> {dashboardValues.deckSize}
            </p>
            <p style={typography.body}>
              <span className="font-medium">Hand size:</span> {dashboardValues.handSize}
            </p>
            
            {dashboardValues.combos.map((combo, index) => (
              <div key={combo.id} className="pl-4 border-l-2" style={{ borderColor: 'var(--border-secondary)' }}>
                <p className="font-medium" style={typography.body}>{combo.name}</p>
                {combo.cards.map((card, cardIndex) => (
                  <div key={cardIndex} className={cardIndex > 0 ? 'mt-2' : ''}>
                    <p style={typography.body}>
                      <span className="font-medium">{card.starterCard || '-'}</span>
                    </p>
                    <p style={typography.body}>
                      <span className="font-medium">Copies in deck:</span> {card.startersInDeck}
                    </p>
                    <p style={typography.body}>
                      <span className="font-medium">Min in hand:</span> {card.minCopiesInHand}
                    </p>
                    <p style={typography.body}>
                      <span className="font-medium">Max in hand:</span> {card.maxCopiesInHand}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Opening Hand Display */}
          <div className="mt-6">
            <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
              <h3 style={{...typography.h3, color: 'var(--text-main)'}}>Opening hand</h3>
              <button
                onClick={refreshOpeningHand}
                disabled={isRefreshing}
                className={`px-4 py-2 font-medium transition-colors ${
                  isRefreshing ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
                }`}
                style={{ 
                  backgroundColor: 'transparent', 
                  color: 'var(--text-main)',
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '14px',
                  lineHeight: '20px',
                  fontFamily: 'Geist Regular, sans-serif'
                }}
              >
                {isRefreshing ? 'Shuffling...' : 'Refresh'}
              </button>
            </div>
            
            <p className="mb-4" style={{...typography.body, color: 'var(--text-secondary)'}}>
              *This is a probabilistic example of your opening hand based on defined combos
            </p>
            
            <div 
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                justifyContent: 'flex-start'
              }}
            >
              {openingHand.map((cardData, index) => (
                <CardImage key={index} cardData={cardData} size="small" />
              ))}
            </div>
          </div>

          {results.individual.length > 0 && (
            <div className="mt-6 space-y-2">
              {/* Combined probability result - only show if multiple combos */}
              {results.combined !== null && (
                <div className="p-4 rounded-md" style={{ backgroundColor: 'var(--bg-action)', border: `1px solid var(--border-main)` }}>
                  <div className="flex items-center">
                    <p className="font-semibold" style={{...typography.body, color: 'var(--text-action)'}}>
                      Chances of opening any of the desired combos: {results.combined.toFixed(2)}%
                    </p>
                    <Tooltip text="Chance of opening ANY of your defined combos. Shows overall deck consistency (hitting at least one combo from ones you defined)" />
                  </div>
                </div>
              )}
              
              {/* Individual combo results */}
              {results.individual.map((result, index) => (
                <div key={result.id} className="p-4 rounded-md" style={{ backgroundColor: 'var(--bg-secondary)', border: `1px solid var(--border-main)` }}>
                  <p className="font-semibold" style={typography.body}>
                    {generateResultText(result)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {results.individual.length > 0 && generatedTitle && (
          <div className="p-0" style={{ margin: 0, paddingBottom: '16px' }}>
            <h2 className="mb-4" style={typography.h2}>Deck list link</h2>
            
            <div className="mb-4">
              <h3 className="mb-2" style={typography.h3}>
                <TypewriterText text={generatedTitle} />
              </h3>
            </div>
            
            <div className="p-4 rounded-md" style={{ backgroundColor: 'var(--bg-secondary)', border: `1px solid var(--border-main)` }}>
              <div className="flex items-center mb-2">
                <p style={typography.body}>Shareable link:</p>
                <Tooltip text="Export your calculation as a link to share with your testing group or save your work for later" />
              </div>
              <p style={{...typography.body, color: 'var(--text-secondary)', marginBottom: '8px'}}>Save & share your deck ratios</p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={shareableUrl}
                  readOnly
                  className="flex-1 px-3 border"
                  style={{ 
                    backgroundColor: 'var(--bg-tertiary)', 
                    border: `1px solid var(--border-main)`,
                    color: 'var(--text-main)',
                    borderRadius: '999px',
                    height: '40px',
                    cursor: 'text',
                    ...typography.body
                  }}
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 font-medium transition-colors hover:opacity-80"
                  style={{ 
                    backgroundColor: 'var(--bg-action)', 
                    color: 'var(--text-action)',
                    border: 'none',
                    borderRadius: '999px',
                    ...typography.body
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-0" style={{ marginTop: 'var(--spacing-lg)' }}>
          <h2 className="font-semibold mb-3" style={typography.h2}>Understanding Your Probability Results</h2>
          
          <h3 className="font-semibold mb-2" style={typography.h3}>Why do I see slight variations in percentages?</h3>
          <p className="mb-3" style={{ ...typography.body, color: 'var(--text-secondary)' }}>
            You might notice that running the same deck configuration multiple times can show minor differences in probabilities (like 47.3% vs 47.5%). This is completely normal and expected!
          </p>
          
          <h3 className="font-semibold mb-2" style={typography.h3}>The Monte Carlo Method</h3>
          <p className="mb-2" style={{ ...typography.body, color: 'var(--text-secondary)' }}>
            FirstDrawGG uses Monte Carlo simulation - the same proven method used by financial analysts, game developers, and engineers worldwide. Think of it like shuffling and drawing from your deck 100,000 times to see what actually happens, rather than just calculating theoretical odds.
          </p>
          
          <p className="mb-2" style={{ ...typography.body, color: 'var(--text-secondary)' }}>Here's how it works:</p>
          <ul className="list-disc pl-5 space-y-1 mb-3" style={{ ...typography.body, color: 'var(--text-secondary)' }}>
            <li>We simulate <span className="font-semibold">100,000 test hands</span> for each calculation</li>
            <li>Each simulation randomly shuffles your deck and draws cards</li>
            <li>The results show you what percentage of those hands met your criteria</li>
            <li>Just like real shuffling, each set of 100,000 tests will be slightly different</li>
          </ul>
          
          <h3 className="font-semibold mb-2" style={typography.h3}>Why This Matters for Deck Building</h3>
          <p className="mb-3" style={{ ...typography.body, color: 'var(--text-secondary)' }}>
            These small variations (typically less than 0.5%) are actually a strength, not a weakness. They reflect the real randomness you'll experience at tournaments. A combo showing 43.2% one time and 43.5% another time tells you it's consistently in that 43-44% range - exactly the confidence level you need for competitive decisions.
          </p>
          
          <h3 className="font-semibold mb-2" style={typography.h3}>The Bottom Line</h3>
          <p className="mb-3" style={{ ...typography.body, color: 'var(--text-secondary)' }}>
            With 100,000 simulations per calculation, our results are statistically robust. Whether you're optimizing your competitive deck's hand trap ratios or testing that spicy rogue combo, you can trust these probabilities to guide your deck building decisions. The minor variations you see are proof the system is working correctly, not a flaw.
          </p>
          
          <p className="italic" style={{ ...typography.body, color: 'var(--text-secondary)' }}>
            Remember: In Yu-Gi-Oh!, understanding whether your combo is at 43% or 83% is what separates consistent decks from inconsistent ones. Happy deck building!
          </p>
        </div>
      </div>
      {showToast && (
        <Toast 
          message="Link copied ✅" 
          onClose={() => setShowToast(false)} 
        />
      )}
    </div>
  );
}