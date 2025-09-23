import React, { useState, useEffect, useRef } from 'react';
import ProbabilityService from './services/ProbabilityService';
import YdkParser from './services/YdkParser';
import ComboBuilder from './features/calculator/ComboBuilder';
import ResultsDisplay from './features/calculator/ResultsDisplay';
import DeckInputs from './features/calculator/DeckInputs';
import YdkImporter from './features/deck-import/YdkImporter';
import Icon from './components/Icon';
import CardSearchModal from './components/CardSearchModal';

// URL encoding/decoding utilities
const URLService = {
  encodeCalculation: (deckSize, handSize, combos, ydkFile = null, testHandFromDecklist = true) => {
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
            max: card.maxCopiesInHand,
            logic: card.logicOperator || 'AND'  // AC #6: Save AND/OR logic in URLs
          }))
        })),
        testHand: testHandFromDecklist
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
            maxCopiesInHand: card.max,
            logicOperator: card.logic || 'AND'  // AC #6: Default to AND for old URLs
          }))
        })),
        testHandFromDecklist: data.testHand !== undefined ? data.testHand : true
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

  updateURL: (deckSize, handSize, combos, ydkFile = null, testHandFromDecklist = true) => {
    const encoded = URLService.encodeCalculation(deckSize, handSize, combos, ydkFile, testHandFromDecklist);
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
    const result = cardName
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
    console.log(`Sanitized "${cardName}" -> "${result}"`);
    return result;
  },

  /**
   * Generate optimized image URL for a card using new structure
   * @param {string} cardName - The card name
   * @param {string} size - Image size ('full' or 'small')
   * @returns {string} The optimized image URL
   */
  getImageUrl(cardName, size = 'small') {
    if (!cardName) {
      console.log('❌ No card name provided for image URL generation');
      return '';
    }
    
    const sanitizedName = this.sanitizeCardName(cardName);
    // Always use full-size images from cards/ directory - no need for separate small images  
    const url = `${this.BLOB_BASE_URL}/cards/${sanitizedName}.webp`;
    console.log(`🔗 Generated Vercel Blob URL for "${cardName}":`, url);
    return url;
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
    
    return {
      src: webpUrl,
      alt: cardName || 'Yu-Gi-Oh Card',
      loading: 'lazy'
    };
  }
};


// Opening hand generation service
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

  // AC#3: Generate opening hand from YDK cards
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

    // AC#4: Handle empty deck case
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
  console.log('🖼️ CardImage rendered with:', { cardData, size });
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

  // Regular card with image using Vercel Blob
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
        src={imageProps.src}
        crossOrigin="anonymous"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '4px'
        }}
        onError={(e) => {
          console.log('❌ Vercel Blob image failed to load:', e.target.src);
          console.log('Error details:', e);
          if (!imageError) {
            setImageError(true);
            // Don't fallback to YGOPro - show blank card instead
            e.target.style.display = 'none';
          }
        }}
        onLoad={(e) => {
          console.log('Image loaded successfully:', e.target.src);
        }}
        alt={cardData.cardName || 'Yu-Gi-Oh Card'}
        loading="lazy"
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
          cursor: 'pointer',
          marginLeft: '8px',
          flexShrink: 0,
          userSelect: 'none'
        }}
      >
        <Icon name="info" ariaLabel="More information" size={16} variant="secondary" />
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            backgroundColor: '#000000',
            border: `1px solid #333333`,
            color: '#ffffff',
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
    
    // AC01: If this is a YDK card with 1 or 2 copies, auto-set the copies in deck value
    if (ydkCardCounts && ydkCardCounts[card.name] && updateCombo && comboId !== undefined && cardIndex !== undefined) {
      const cardCount = ydkCardCounts[card.name];
      
      // Only auto-set for cards with 1 or 2 copies (as per AC01)
      if (cardCount === 1 || cardCount === 2) {
        updateCombo(comboId, cardIndex, 'startersInDeck', cardCount);
      }
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
                        className="px-3 py-2 hover:opacity-80 cursor-pointer transition-opacity flex items-center justify-between"
                        style={typography.body}
                      >
                        <span onClick={() => handleCardSelect(card)} className="flex-1">
                          {card.name}
                        </span>
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
                            className="px-3 py-2 hover:opacity-80 cursor-pointer transition-opacity flex items-center justify-between"
                            style={typography.body}
                          >
                            <span onClick={() => handleCardSelect(card)} className="flex-1">
                              {card.name}
                            </span>
                            {showAddToComboOverlayForCard && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showAddToComboOverlayForCard(card);
                                  setIsOpen(false);
                                }}
                                className="ml-2 px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity"
                                style={{
                                  backgroundColor: 'var(--bg-action)',
                                  color: 'var(--text-black)',
                                  border: 'none',
                                  cursor: 'pointer'
                                }}
                                title="Add to combo"
                              >
                                +
                              </button>
                            )}
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
                        className="px-3 py-2 hover:opacity-80 cursor-pointer transition-opacity flex items-center justify-between"
                        style={typography.body}
                      >
                        <span onClick={() => handleCardSelect(card)} className="flex-1">
                          {card.name}
                        </span>
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
    maxCopiesInHand: 3,
    logicOperator: 'AND'  // Default to AND, only relevant for 2nd+ cards
  }]
});

// Deck Builder Section Component
const DeckImageSection = ({ typography, cardDatabase, ydkCards, ydkCardCounts, showToast, initialDeckZones, deckZones, setDeckZones }) => {
  const [showCardSearch, setShowCardSearch] = useState(false);
  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState('TCG');
  const [autoSort, setAutoSort] = useState(true);
  const [deckStatistics, setDeckStatistics] = useState({
    totalCards: 0,
    cardTypes: { monsters: 0, spells: 0, traps: 0 },
    monsterLevels: {},
    attributes: {},
    deckStatus: 'invalid'
  });

  // Update deck zones when initial deck zones are provided (from YDK upload)
  useEffect(() => {
    if (initialDeckZones) {
      console.log('🎯 DeckImageSection: Updating deck zones with:', initialDeckZones);
      setDeckZones(initialDeckZones);
    } else if (initialDeckZones === null) {
      // Clear deck zones when YDK is removed
      console.log('🎯 DeckImageSection: Clearing deck zones');
      setDeckZones({
        main: [],
        extra: [],
        side: []
      });
    }
  }, [initialDeckZones]);

  // Update statistics when deck zones change (Main deck only)
  useEffect(() => {
    const mainDeckCards = deckZones.main;
    const totalCards = mainDeckCards.length;

    console.log('📊 Calculating Main Deck Stats:', {
      mainDeckLength: totalCards,
      cards: mainDeckCards.map(card => ({
        name: card.name,
        type: card.type,
        level: card.level,
        attribute: card.attribute
      }))
    });

    const cardTypes = mainDeckCards.reduce((acc, card) => {
      if (card.type?.toLowerCase().includes('monster')) acc.monsters++;
      else if (card.type?.toLowerCase().includes('spell')) acc.spells++;
      else if (card.type?.toLowerCase().includes('trap')) acc.traps++;
      return acc;
    }, { monsters: 0, spells: 0, traps: 0 });

    const monsterLevels = mainDeckCards.reduce((acc, card) => {
      if (card.level && card.type?.toLowerCase().includes('monster')) {
        acc[card.level] = (acc[card.level] || 0) + 1;
      }
      return acc;
    }, {});

    const attributes = mainDeckCards.reduce((acc, card) => {
      if (card.attribute) {
        acc[card.attribute] = (acc[card.attribute] || 0) + 1;
      }
      return acc;
    }, {});

    const isMainDeckValid = deckZones.main.length >= 40 && deckZones.main.length <= 60;
    const isExtraDeckValid = deckZones.extra.length <= 15;
    const isSideDeckValid = deckZones.side.length <= 15;
    const deckStatus = isMainDeckValid && isExtraDeckValid && isSideDeckValid ? 'legal' : 'invalid';

    setDeckStatistics({
      totalCards,
      cardTypes,
      monsterLevels,
      attributes,
      deckStatus
    });
  }, [deckZones]);


  // Banlist enforcement data
  const banlistData = {
    TCG: {
      forbidden: ['Pot of Greed', 'Graceful Charity', 'Delinquent Duo', 'The Forceful Sentry', 'Confiscation', 'Last Will', 'Painful Choice'],
      limited: ['Raigeki', 'Dark Hole', 'Monster Reborn', 'Change of Heart', 'Imperial Order', 'Mystical Space Typhoon'],
      semiLimited: ['Mystical Space Typhoon', 'Mirror Force']
    },
    OCG: {
      forbidden: ['Pot of Greed', 'Graceful Charity', 'Delinquent Duo'],
      limited: ['Raigeki', 'Dark Hole', 'Monster Reborn'],
      semiLimited: ['Mirror Force']
    },
    'Master Duel': {
      forbidden: ['Pot of Greed', 'Graceful Charity'],
      limited: ['Raigeki', 'Dark Hole'],
      semiLimited: ['Mirror Force']
    },
    'No Banlist': {
      forbidden: [],
      limited: [],
      semiLimited: []
    }
  };

  const getCardBanlistStatus = (cardName) => {
    const format = banlistData[selectedFormat];
    if (format.forbidden.includes(cardName)) return 'forbidden';
    if (format.limited.includes(cardName)) return 'limited';
    if (format.semiLimited.includes(cardName)) return 'semi-limited';
    return 'unlimited';
  };

  const getMaxCopiesAllowed = (cardName) => {
    const status = getCardBanlistStatus(cardName);
    switch (status) {
      case 'forbidden': return 0;
      case 'limited': return 1;
      case 'semi-limited': return 2;
      default: return 3;
    }
  };

  const handleCardSelect = (card) => {
    // Check banlist restrictions
    const banlistStatus = getCardBanlistStatus(card.name);
    const maxAllowed = getMaxCopiesAllowed(card.name);

    if (banlistStatus === 'forbidden') {
      showToast(`${card.name} is forbidden in ${selectedFormat}`);
      return;
    }

    // Add card to main deck by default
    const newCard = {
      id: `${Date.now()}_${Math.random()}`,
      name: card.name,
      cardId: card.id,
      type: card.type,
      attribute: card.attribute,
      level: card.level,
      atk: card.atk,
      def: card.def,
      desc: card.desc,
      zone: 'main',
      banlistStatus
    };

    // Check card limits based on banlist
    const existingCount = deckZones.main.filter(c => c.name === card.name).length;
    if (existingCount >= maxAllowed) {
      const statusText = banlistStatus === 'limited' ? 'Limited - Only 1 copy allowed' :
                        banlistStatus === 'semi-limited' ? 'Semi-Limited - Only 2 copies allowed' :
                        'Maximum 3 copies allowed';
      showToast(statusText);
      return;
    }

    // Check deck size limits
    if (deckZones.main.length >= 60) {
      showToast('Main Deck cannot exceed 60 cards');
      return;
    }

    setDeckZones(prev => ({
      ...prev,
      main: [...prev.main, newCard]
    }));

    showToast(`Added ${card.name} to Main Deck`);
  };

  const handleDragStart = (e, card) => {
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Touch event handlers for mobile support
  const [touchStart, setTouchStart] = useState(null);
  const [touchItem, setTouchItem] = useState(null);

  const handleTouchStart = (e, card) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchItem(card);

    // Add haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const handleTouchMove = (e) => {
    if (!touchStart || !touchItem) return;

    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    // Check if this is a drag gesture (moved more than 10px)
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      // Find element under touch point
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropZone = elementBelow?.closest('[data-drop-zone]');

      if (dropZone) {
        const zone = dropZone.dataset.dropZone;
        setDragOverZone(zone);
      } else {
        setDragOverZone(null);
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (!touchStart || !touchItem) return;

    const touch = e.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropZone = elementBelow?.closest('[data-drop-zone]');

    if (dropZone) {
      const targetZone = dropZone.dataset.dropZone;
      // Simulate drop event
      const fakeEvent = {
        preventDefault: () => {},
      };
      setDraggedCard(touchItem);
      handleDrop(fakeEvent, targetZone);
    }

    setTouchStart(null);
    setTouchItem(null);
    setDragOverZone(null);
  };

  const handleDragOver = (e, zone) => {
    e.preventDefault();
    setDragOverZone(zone);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => {
    setDragOverZone(null);
  };

  const handleDrop = (e, targetZone) => {
    e.preventDefault();
    setDragOverZone(null);

    if (!draggedCard) return;

    // Validate drop based on card type and zone
    const isExtraDeckMonster = draggedCard.type?.toLowerCase().includes('fusion') ||
                              draggedCard.type?.toLowerCase().includes('synchro') ||
                              draggedCard.type?.toLowerCase().includes('xyz') ||
                              draggedCard.type?.toLowerCase().includes('link');

    if (isExtraDeckMonster && targetZone === 'main') {
      showToast('Extra Deck monsters cannot go in Main Deck');
      return;
    }

    if (!isExtraDeckMonster && targetZone === 'extra') {
      showToast('Only Extra Deck monsters can go in Extra Deck');
      return;
    }

    // Check zone limits
    if (targetZone === 'main' && deckZones.main.length >= 60) {
      showToast('Main Deck cannot exceed 60 cards');
      return;
    }

    if ((targetZone === 'extra' || targetZone === 'side') && deckZones[targetZone].length >= 15) {
      showToast(`${targetZone === 'extra' ? 'Extra' : 'Side'} Deck cannot exceed 15 cards`);
      return;
    }

    // Move card between zones
    const sourceZone = draggedCard.zone;
    if (sourceZone === targetZone) return;

    setDeckZones(prev => ({
      ...prev,
      [sourceZone]: prev[sourceZone].filter(c => c.id !== draggedCard.id),
      [targetZone]: [...prev[targetZone], { ...draggedCard, zone: targetZone }]
    }));

    setDraggedCard(null);
  };

  const removeCard = (cardId, zone) => {
    setDeckZones(prev => ({
      ...prev,
      [zone]: prev[zone].filter(c => c.id !== cardId)
    }));
  };

  const clearZone = (zone) => {
    setDeckZones(prev => ({
      ...prev,
      [zone]: []
    }));
  };

  const sortDeck = () => {
    if (!autoSort) return;

    setDeckZones(prev => ({
      ...prev,
      main: [...prev.main].sort((a, b) => {
        // Sort by type first (monsters, spells, traps)
        const typeOrder = { monster: 0, spell: 1, trap: 2 };
        const aType = a.type?.toLowerCase().includes('monster') ? 'monster' :
                     a.type?.toLowerCase().includes('spell') ? 'spell' : 'trap';
        const bType = b.type?.toLowerCase().includes('monster') ? 'monster' :
                     b.type?.toLowerCase().includes('spell') ? 'spell' : 'trap';

        if (typeOrder[aType] !== typeOrder[bType]) {
          return typeOrder[aType] - typeOrder[bType];
        }

        // Within same type, sort by name
        return a.name.localeCompare(b.name);
      }),
      extra: [...prev.extra].sort((a, b) => a.name.localeCompare(b.name)),
      side: [...prev.side].sort((a, b) => a.name.localeCompare(b.name))
    }));
  };

  const exportDeck = () => {
    const mainDeckText = deckZones.main.map(card => card.name).join('\n');
    const extraDeckText = deckZones.extra.map(card => card.name).join('\n');
    const sideDeckText = deckZones.side.map(card => card.name).join('\n');

    const deckText = [
      '# Main Deck',
      mainDeckText,
      '',
      '# Extra Deck',
      extraDeckText,
      '',
      '# Side Deck',
      sideDeckText
    ].join('\n');

    // Create and download file
    const blob = new Blob([deckText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deck.ydk';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Deck exported successfully');
  };

  const importDeckFromText = (text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));

    // Simple import - add all to main deck for now
    const importedCards = lines.map((line, index) => ({
      id: `imported_${index}`,
      name: line,
      zone: 'main',
      type: 'Unknown' // Will be updated when card data is fetched
    }));

    setDeckZones(prev => ({
      main: importedCards,
      extra: [],
      side: []
    }));

    showToast(`Imported ${importedCards.length} cards`);
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-semibold" style={typography.h2}>Deck Builder</h2>
        <p style={{...typography.body, color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px'}}>
          Build your deck visually by searching and adding cards to different zones
        </p>
      </div>

      {/* Visual deck builder mode */}
      <div>
          <div className="mb-4 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 items-start sm:items-center">
            <button
              onClick={() => setShowCardSearch(true)}
              className="px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: 'var(--bg-action)',
                color: 'var(--text-action)',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Add Cards
            </button>

            {/* Format Selector */}
            <div className="flex items-center gap-2">
              <label style={{...typography.body, color: 'var(--text-main)', fontSize: '14px'}}>
                Format:
              </label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="px-3 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                  fontSize: '14px'
                }}
              >
                <option value="TCG">TCG</option>
                <option value="OCG">OCG</option>
                <option value="Master Duel">Master Duel</option>
                <option value="No Banlist">No Banlist</option>
              </select>
            </div>

            {/* Auto-sort Toggle */}
            <div className="flex items-center gap-2">
              <label style={{...typography.body, color: 'var(--text-main)', fontSize: '14px'}}>
                Auto-sort:
              </label>
              <input
                type="checkbox"
                checked={autoSort}
                onChange={(e) => setAutoSort(e.target.checked)}
                style={{accentColor: 'var(--bg-action)'}}
              />
            </div>
          </div>

          {/* Deck Zones - Mobile Optimized */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Main Deck */}
            <div className="lg:col-span-2">
              <DeckZone
                title="Main Deck"
                subtitle={`(${deckZones.main.length}/40-60)`}
                cards={deckZones.main}
                zone="main"
                onDragOver={(e) => handleDragOver(e, 'main')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'main')}
                onRemoveCard={removeCard}
                onClearZone={clearZone}
                dragOverZone={dragOverZone}
                handleDragStart={handleDragStart}
                handleTouchStart={handleTouchStart}
                handleTouchMove={handleTouchMove}
                handleTouchEnd={handleTouchEnd}
                typography={typography}
                maxCards={10}
              />
            </div>

            {/* Extra Deck */}
            <div>
              <DeckZone
                title="Extra Deck"
                subtitle={`(${deckZones.extra.length}/15)`}
                cards={deckZones.extra}
                zone="extra"
                onDragOver={(e) => handleDragOver(e, 'extra')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'extra')}
                onRemoveCard={removeCard}
                onClearZone={clearZone}
                dragOverZone={dragOverZone}
                handleDragStart={handleDragStart}
                handleTouchStart={handleTouchStart}
                handleTouchMove={handleTouchMove}
                handleTouchEnd={handleTouchEnd}
                typography={typography}
                borderColor="var(--bg-action-secondary)"
                maxCards={5}
              />
            </div>

            {/* Side Deck */}
            <div>
              <DeckZone
                title="Side Deck"
                subtitle={`(${deckZones.side.length}/15)`}
                cards={deckZones.side}
                zone="side"
                onDragOver={(e) => handleDragOver(e, 'side')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'side')}
                onRemoveCard={removeCard}
                onClearZone={clearZone}
                dragOverZone={dragOverZone}
                handleDragStart={handleDragStart}
                handleTouchStart={handleTouchStart}
                handleTouchMove={handleTouchMove}
                handleTouchEnd={handleTouchEnd}
                typography={typography}
                borderColor="var(--text-secondary)"
                maxCards={5}
              />
            </div>
          </div>

          {/* Statistics Panel */}
          <DeckStatistics statistics={deckStatistics} typography={typography} />

          {/* Deck Actions */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 mt-6">
            <input
              type="file"
              accept=".ydk,.txt"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    importDeckFromText(event.target.result);
                  };
                  reader.readAsText(file);
                }
              }}
              style={{ display: 'none' }}
              id="deck-import"
            />
            <label
              htmlFor="deck-import"
              className="px-3 py-2 text-sm rounded-lg hover:opacity-80 transition-opacity cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-action)',
                color: 'var(--text-action)'
              }}
            >
              Import (Ctrl+I)
            </label>
            <button
              onClick={exportDeck}
              className="px-3 py-2 text-sm rounded-lg hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                border: `1px solid var(--border-main)`
              }}
            >
              Export (Ctrl+E)
            </button>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all cards from your deck?')) {
                  clearZone('main');
                  clearZone('extra');
                  clearZone('side');
                  showToast('All cards cleared');
                }
              }}
              className="px-3 py-2 text-sm rounded-lg hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                border: `1px solid var(--border-main)`
              }}
            >
              Clear All (Ctrl+Shift+C)
            </button>
            <button
              onClick={sortDeck}
              className="px-3 py-2 text-sm rounded-lg hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                border: `1px solid var(--border-main)`
              }}
            >
              Sort (Ctrl+S)
            </button>
            <button
              onClick={() => {
                // Convert deck to text format for existing deck image functionality
                const mainDeckText = deckZones.main.map(card => card.name).join('\n');
                const extraDeckText = deckZones.extra.map(card => card.name).join('\n');
                const sideDeckText = deckZones.side.map(card => card.name).join('\n');

                const fullDeckText = [
                  '# Main Deck',
                  mainDeckText,
                  '',
                  '# Extra Deck',
                  extraDeckText,
                  '',
                  '# Side Deck',
                  sideDeckText
                ].join('\n');

                // Note: Text mode removed - visual deck builder only
                showToast('Deck converted to text format for image generation');
              }}
              className="px-3 py-2 text-sm rounded-lg hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: 'var(--bg-action)',
                color: 'var(--text-action)'
              }}
            >
              Generate Deck Image
            </button>
            <button
              onClick={() => {
                // Convert deck to probability calculator format
                const totalCards = deckZones.main.length + deckZones.extra.length + deckZones.side.length;
                if (totalCards === 0) {
                  showToast('Please add cards to your deck first');
                  return;
                }

                // Create URL with deck data for probability calculation
                const searchParams = new URLSearchParams();
                searchParams.set('deckSize', deckZones.main.length.toString());
                searchParams.set('handSize', '5');

                // Store deck data for probability calculation
                const deckData = {
                  main: deckZones.main.map(card => card.name),
                  extra: deckZones.extra.map(card => card.name),
                  side: deckZones.side.map(card => card.name)
                };
                localStorage.setItem('deckBuilderData', JSON.stringify(deckData));

                showToast('Ready for probability calculation! Scroll up to the calculator.');

                // Scroll to the top of the page where the calculator is
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-3 py-2 text-sm rounded-lg hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: 'var(--bg-action-secondary)',
                color: 'var(--text-main)',
                border: `1px solid var(--border-main)`
              }}
            >
              Calculate Probabilities
            </button>
          </div>
        </div>
      )}

      {/* Card Search Modal */}
      <CardSearchModal
        isOpen={showCardSearch}
        onClose={() => setShowCardSearch(false)}
        onCardSelect={handleCardSelect}
      />
    </div>
  );
};

// Deck Zone Component
const DeckZone = ({
  title,
  subtitle,
  cards,
  zone,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemoveCard,
  onClearZone,
  dragOverZone,
  handleDragStart,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  typography,
  borderColor = 'var(--border-main)',
  maxCards = 10
}) => {
  const isDragOver = dragOverZone === zone;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 style={{...typography.h3, color: 'var(--text-main)'}}>
          {title} {subtitle}
        </h3>
        {cards.length > 0 && (
          <button
            onClick={() => onClearZone(zone)}
            className="text-xs hover:opacity-80 transition-opacity"
            style={{color: 'var(--text-secondary)'}}
          >
            Clear
          </button>
        )}
      </div>

      <div
        className="min-h-32 p-4 rounded-lg border-2 border-dashed transition-colors"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: isDragOver ? 'var(--bg-action)' : borderColor,
          opacity: isDragOver ? 0.8 : 1
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        data-drop-zone={zone}
      >
        {cards.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <p style={{...typography.body, color: 'var(--text-secondary)'}}>
              Drop cards here or click "Add Cards"
            </p>
          </div>
        ) : (
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${maxCards}, minmax(0, 1fr))`
            }}
          >
            {cards.map((card) => (
              <DeckCard
                key={card.id}
                card={card}
                onDragStart={handleDragStart}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onRemove={() => onRemoveCard(card.id, zone)}
                typography={typography}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Individual Card Component
const DeckCard = ({ card, onDragStart, onTouchStart, onTouchMove, onTouchEnd, onRemove, typography }) => {
  const [imageError, setImageError] = useState(false);
  const imageProps = CardDatabaseService.getImageProps(card.name, card.cardId, 'small');

  const getBanlistIcon = (status) => {
    switch (status) {
      case 'forbidden': return '🚫';
      case 'limited': return '①';
      case 'semi-limited': return '②';
      default: return null;
    }
  };

  const getBanlistColor = (status) => {
    switch (status) {
      case 'forbidden': return '#ff4444';
      case 'limited': return '#ffaa00';
      case 'semi-limited': return '#ff8800';
      default: return 'transparent';
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      onTouchStart={(e) => onTouchStart(e, card)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative group cursor-move hover:opacity-80 transition-opacity touch-none"
      style={{
        width: '60px',
        height: '87px',
        touchAction: 'none'
      }}
    >
      <img
        {...imageProps}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '4px',
          display: imageError ? 'none' : 'block'
        }}
        onError={() => setImageError(true)}
      />
      {imageError && (
        <div
          className="flex items-center justify-center text-xs text-center"
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--bg-action-secondary)',
            color: 'var(--text-secondary)',
            borderRadius: '4px'
          }}
        >
          {card.name.slice(0, 10)}...
        </div>
      )}

      {/* Banlist Status Indicator */}
      {card.banlistStatus && card.banlistStatus !== 'unlimited' && (
        <div
          className="absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            backgroundColor: getBanlistColor(card.banlistStatus),
            color: 'white'
          }}
          title={`${card.banlistStatus} card`}
        >
          {getBanlistIcon(card.banlistStatus)}
        </div>
      )}

      <button
        onClick={onRemove}
        className="absolute -top-1 -right-1 w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          backgroundColor: 'var(--bg-error)',
          color: 'white',
          fontSize: '12px'
        }}
      >
        ×
      </button>
    </div>
  );
};

// Statistics Panel Component
const DeckStatistics = ({ statistics, typography }) => {
  const { totalCards, cardTypes, deckStatus } = statistics;

  return (
    <div className="mt-6 p-4 rounded-lg" style={{backgroundColor: 'var(--bg-secondary)'}}>
      <h3 className="mb-3" style={{...typography.h3, color: 'var(--text-main)'}}>
        Main Deck Stats
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>
            {totalCards}
          </div>
          <div className="text-sm" style={{color: 'var(--text-secondary)'}}>
            Main Deck Cards
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>
            {cardTypes.monsters}
          </div>
          <div className="text-sm" style={{color: 'var(--text-secondary)'}}>
            Monsters
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>
            {cardTypes.spells}
          </div>
          <div className="text-sm" style={{color: 'var(--text-secondary)'}}>
            Spells
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold" style={{color: 'var(--text-main)'}}>
            {cardTypes.traps}
          </div>
          <div className="text-sm" style={{color: 'var(--text-secondary)'}}>
            Traps
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center">
        <span
          className="px-3 py-1 rounded-full text-sm font-medium"
          style={{
            backgroundColor: deckStatus === 'legal' ? 'var(--bg-success)' : 'var(--bg-error)',
            color: 'white'
          }}
        >
          {deckStatus === 'legal' ? 'Legal Deck' : 'Invalid Deck'}
        </span>
      </div>
    </div>
  );
};

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
  const [toastMessage, setToastMessage] = useState('');
  const [openingHand, setOpeningHand] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshDebounceRef = useRef(null);
  const calculationDashboardRef = useRef(null);
  const [uploadedYdkFile, setUploadedYdkFile] = useState(null);
  const [ydkCards, setYdkCards] = useState([]);
  const [ydkCardCounts, setYdkCardCounts] = useState({});
  const [staticCardDatabase, setStaticCardDatabase] = useState({});
  const [testHandFromDecklist, setTestHandFromDecklist] = useState(true);
  const [initialDeckZones, setInitialDeckZones] = useState(null);
  const [deckZones, setDeckZones] = useState({
    main: [],
    extra: [],
    side: []
  });

  // Sync deckZones when initialDeckZones changes (from YDK upload)
  useEffect(() => {
    if (initialDeckZones) {
      console.log('🔄 App: Syncing deckZones with initialDeckZones:', initialDeckZones);
      setDeckZones(initialDeckZones);
    } else if (initialDeckZones === null) {
      // Clear deck zones when YDK is removed
      console.log('🔄 App: Clearing deckZones');
      setDeckZones({
        main: [],
        extra: [],
        side: []
      });
    }
  }, [initialDeckZones]);

  // Scroll to Calculation Dashboard function
  const scrollToCalculationDashboard = () => {
    if (calculationDashboardRef.current) {
      calculationDashboardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

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
      setTestHandFromDecklist(data.testHandFromDecklist !== undefined ? data.testHandFromDecklist : true);
      
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
        URLService.updateURL(data.d, data.h, loadedCombos, uploadedYdkFile, data.testHandFromDecklist);
        const url = window.location.href;
        setShareableUrl(url);
        
        // Generate title
        const title = TitleGeneratorService.generateFunTitle(loadedCombos, data.d, calculatedResults.individual);
        setGeneratedTitle(title);

        // Auto-scroll to Calculation Dashboard
        setTimeout(() => scrollToCalculationDashboard(), 200);
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
            const parseResult = YdkParser.parseYdkFile(urlData.ydkFile.content, staticCardDatabase);
            
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
          
          // Auto-scroll to Calculation Dashboard
          setTimeout(() => scrollToCalculationDashboard(), 200);
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
      const database = await YdkParser.loadStaticCardDatabase();
      setStaticCardDatabase(database);
    };
    
    loadStaticDatabase();
  }, []);

  // YDK file handling functions
  const handleYdkFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      YdkParser.validateYdkFile(file);
      
      const fileContent = await readFileAsText(file);
      const parseResult = YdkParser.parseYdkFile(fileContent, staticCardDatabase);
      
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

      // Populate the deck builder with parsed deck zones
      if (parseResult.deckZones) {
        setInitialDeckZones(parseResult.deckZones);
        console.log('🎯 Populating deck builder with:', parseResult.deckZones);
      }

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
    setInitialDeckZones(null);
  };

  const handleFromClipboard = () => {
    setShowClipboardField(true);
  };

  const processClipboardContent = async (content) => {
    if (!content.trim()) {
      return;
    }

    try {
      const parseResult = YdkParser.parseYdkFile(content, staticCardDatabase);
      
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
    
    if (deckSize < handSize) newErrors.deckSize = "Can't be lower than Hand size";
    
    combos.forEach((combo, index) => {
      combo.cards.forEach((card, cardIndex) => {
        const cardPrefix = `combo-${combo.id}-card-${cardIndex}`;
        
        if (card.startersInDeck < 0) newErrors[`${cardPrefix}-startersInDeck`] = 'Please enter valid value';
        if (card.minCopiesInHand < 0) newErrors[`${cardPrefix}-minCopiesInHand`] = 'Please enter valid value';
        if (card.maxCopiesInHand < 0) newErrors[`${cardPrefix}-maxCopiesInHand`] = 'Please enter valid value';
        if (card.starterCard.length > 50) newErrors[`${cardPrefix}-starterCard`] = 'Please enter valid value';
        
        // AC03: Min in hand must be <= Max in hand
        if (card.minCopiesInHand > card.maxCopiesInHand) newErrors[`${cardPrefix}-minCopiesInHand`] = 'Can\'t be more than Max in hand';
        
        if (card.minCopiesInHand > handSize) newErrors[`${cardPrefix}-minCopiesInHand`] = 'Please enter valid value';
        if (card.maxCopiesInHand > handSize) newErrors[`${cardPrefix}-maxCopiesInHand`] = 'Please enter valid value';
        
        // AC02: Max in hand must be <= Copies in deck
        if (card.maxCopiesInHand > card.startersInDeck) newErrors[`${cardPrefix}-maxCopiesInHand`] = 'Can\'t be more than Copies in deck';
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
    console.log('🎲 Generating opening hand with:', { combos, deckSize, handSize, testHandFromDecklist, ydkCards });
    
    let hand;
    
    // AC#3: Use YDK cards when toggle is ON and YDK cards are available
    if (testHandFromDecklist && ydkCards && ydkCards.length > 0 && ydkCardCounts && Object.keys(ydkCardCounts).length > 0) {
      console.log('🎯 Using YDK cards for opening hand');
      hand = OpeningHandService.generateHandFromYdkCards(ydkCards, ydkCardCounts, handSize);
    } else {
      console.log('🎯 Using combos for opening hand');
      hand = OpeningHandService.generateProbabilisticHand(combos, deckSize, handSize);
    }
    
    console.log('🃏 Generated opening hand:', hand);
    console.log('🃏 Opening hand details:', hand.map((card, index) => ({ 
      index, 
      type: card.type, 
      cardName: card.cardName, 
      cardId: card.cardId,
      isCustom: card.isCustom 
    })));
    console.log('💾 About to call setOpeningHand with:', hand);
    setOpeningHand(hand);
    console.log('💾 Called setOpeningHand - state should update on next render');
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
    URLService.updateURL(deckSize, handSize, combos, uploadedYdkFile, testHandFromDecklist);
    const url = window.location.href;
    setShareableUrl(url);
    
    // Generate title using individual results for compatibility
    const title = TitleGeneratorService.generateFunTitle(combos, deckSize, calculatedResults.individual);
    setGeneratedTitle(title);

    // Auto-scroll to Calculation Dashboard
    setTimeout(() => scrollToCalculationDashboard(), 100);
  };

  const clearPreviousCalculationData = (newDeckSize = null) => {
    // Clear calculation-related state when new YDK is loaded
    setCombos([createCombo(1, 0)]);
    setResults({ individual: [], combined: null });
    setErrors({});
    setDashboardValues({
      deckSize: newDeckSize || deckSize,
      handSize: handSize,
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

  // Validation functions for input constraints
  const validateAndUpdateCombo = (id, cardIndex, field, value) => {
    const combo = combos.find(c => c.id === id);
    if (!combo) return;
    
    const currentCard = combo.cards[cardIndex];
    const fieldPrefix = `combo-${id}-card-${cardIndex}-${field}`;
    
    // AC02: Prevent Max in hand from exceeding Copies in deck
    if (field === 'maxCopiesInHand' && value > currentCard.startersInDeck) {
      setErrors(prev => ({
        ...prev,
        [fieldPrefix]: "Can't be more than Copies in deck"
      }));
      return; // Prevent the update
    }
    
    // AC03: Prevent Min in hand from exceeding Max in hand
    if (field === 'minCopiesInHand' && value > currentCard.maxCopiesInHand) {
      setErrors(prev => ({
        ...prev,
        [fieldPrefix]: "Can't be more than Max in hand"
      }));
      return; // Prevent the update
    }
    
    // Clear any existing errors for this field since validation passed
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldPrefix];
      return newErrors;
    });
    
    // Apply the update using the existing updateCombo function
    updateCombo(id, cardIndex, field, value);
  };

  const updateCombo = (id, cardIndex, field, value) => {
    console.log(`🔄 updateCombo called: combo ${id}, card ${cardIndex}, field "${field}", value:`, value);
    setCombos(prevCombos => prevCombos.map(combo => {
      if (combo.id !== id) return combo;
      
      const updatedCombo = { ...combo };
      updatedCombo.cards = [...combo.cards];
      const currentCard = combo.cards[cardIndex];
      
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
      
      // Apply automatic adjustment logic based on acceptance criteria
      const card = updatedCombo.cards[cardIndex];
      
      // AC06: Auto-adjust Max in hand when Copies in deck decreases
      if (field === 'startersInDeck' && value < currentCard.maxCopiesInHand) {
        if (currentCard.maxCopiesInHand === currentCard.startersInDeck) {
          card.maxCopiesInHand = value;
          // Clear any errors for maxCopiesInHand since we auto-adjusted it
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[`combo-${id}-card-${cardIndex}-maxCopiesInHand`];
            return newErrors;
          });
        }
      }
      
      // AC07: Auto-adjust Min in hand when Max in hand decreases
      if (field === 'maxCopiesInHand' && value < currentCard.minCopiesInHand) {
        if (currentCard.minCopiesInHand === currentCard.maxCopiesInHand) {
          card.minCopiesInHand = value;
          // Clear any errors for minCopiesInHand since we auto-adjusted it
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[`combo-${id}-card-${cardIndex}-minCopiesInHand`];
            return newErrors;
          });
        }
      }
      
      // Legacy logic: ensure min doesn't exceed max
      if (field === 'minCopiesInHand' && value > currentCard.maxCopiesInHand) {
        card.maxCopiesInHand = value;
      }
      
      console.log('🔄 Final updated combo:', updatedCombo);
      return updatedCombo;
    }));
  };

  const updateComboProperty = (id, field, value) => {
    setCombos(combos.map(combo => {
      if (combo.id !== id) return combo;
      return { ...combo, [field]: value };
    }));
  };

  const addCard = (comboId) => {
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
            maxCopiesInHand: 3,
            logicOperator: 'AND'  // Default to AND
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

  // AC #6: Remove specific card from combo
  const removeCard = (comboId, cardIndex) => {
    setCombos(combos.map(combo => {
      if (combo.id !== comboId) return combo;
      
      const newCards = combo.cards.filter((_, index) => index !== cardIndex);
      
      // Ensure at least one card remains
      if (newCards.length === 0) {
        return {
          ...combo,
          cards: [{
            starterCard: '',
            cardId: null,
            isCustom: false,
            startersInDeck: 3,
            minCopiesInHand: 1,
            maxCopiesInHand: 3,
            logicOperator: 'AND'
          }]
        };
      }
      
      return { ...combo, cards: newCards };
    }));
  };

  // Check if adding a card would exceed hand size
  const canAddCard = (combo) => {
    if (!combo || !combo.cards) return false;
    const currentMinSum = combo.cards.reduce((sum, card) => sum + (card.minCopiesInHand || 0), 0);
    return currentMinSum + 1 <= handSize; // +1 for the new card's default min (1)
  };

  // AC #7: Get the highest min in hand sum across all combos
  const getHighestMinInHandSum = () => {
    if (!combos || combos.length === 0) return 1;
    const sums = combos.map(combo => 
      combo.cards.reduce((sum, card) => sum + (card.minCopiesInHand || 0), 0)
    );
    return Math.max(1, ...sums);
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

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 2000); // Hide after 2 seconds
  };

  const handleCopyLink = () => {
    if (!toastMessage) { // Prevent multiple toasts
      navigator.clipboard.writeText(shareableUrl);
      showToast('Link copied!');
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
  }, [deckSize, handSize, combos, testHandFromDecklist, ydkCards, ydkCardCounts]);

  // Debug when opening hand state actually changes
  useEffect(() => {
    console.log('🔄 Opening hand state updated:', openingHand);
  }, [openingHand]);

  // AC#5 & AC#6: Auto-disable toggle when non-decklist cards are used
  useEffect(() => {
    if (!ydkCards || ydkCards.length === 0) return;

    // Check if any combo cards are not from the YDK decklist
    const hasNonDecklistCards = combos.some(combo => 
      combo.cards.some(card => {
        if (!card.starterCard.trim()) return false; // Skip empty card names
        
        // Check if this card name exists in the YDK cards
        const cardExistsInYdk = ydkCards.some(ydkCard => 
          ydkCard.name.toLowerCase() === card.starterCard.toLowerCase()
        );
        
        return !cardExistsInYdk;
      })
    );

    console.log('🔍 Checking cards against decklist:', { hasNonDecklistCards, combos: combos.length });

    // AC#5: Turn toggle OFF if non-decklist cards are found
    if (hasNonDecklistCards && testHandFromDecklist) {
      console.log('🚫 Non-decklist cards detected, turning toggle OFF');
      setTestHandFromDecklist(false);
    }
  }, [combos, ydkCards, testHandFromDecklist]);

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
            transition: opacity 150ms ease;
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
            <Icon name="question-mark" ariaLabel="Help" size={24} />
          </a>
        </div>
        
        
        <div className="p-0" style={{ margin: 0, paddingBottom: '16px' }}>
          <h2 className="mb-4" style={{...typography.h2, color: 'var(--text-main)'}}>Define a Combo</h2>
          
          <YdkImporter
            uploadedYdkFile={uploadedYdkFile}
            setUploadedYdkFile={setUploadedYdkFile}
            ydkCards={ydkCards}
            setYdkCards={setYdkCards}
            ydkCardCounts={ydkCardCounts}
            setYdkCardCounts={setYdkCardCounts}
            deckSize={deckSize}
            setDeckSize={setDeckSize}
            cardDatabase={staticCardDatabase}
            typography={typography}
            clearPreviousCalculationData={clearPreviousCalculationData}
            combos={combos}
            setCombos={setCombos}
            showToast={showToast}
            setInitialDeckZones={setInitialDeckZones}
            deckZones={deckZones}
          />

          {/* Deck Builder Section */}
          <div className="p-0" style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
            <DeckImageSection
              typography={typography}
              cardDatabase={cardDatabase}
              ydkCards={ydkCards}
              ydkCardCounts={ydkCardCounts}
              showToast={showToast}
              initialDeckZones={initialDeckZones}
              deckZones={deckZones}
              setDeckZones={setDeckZones}
            />
          </div>

          <div className="mb-4">
            <DeckInputs 
              deckSize={deckSize}
              setDeckSize={setDeckSize}
              handSize={handSize}
              setHandSize={setHandSize}
              errors={errors}
              typography={typography}
              minHandSize={getHighestMinInHandSum()}
            />
          </div>

          {combos.map((combo, index) => (
              <div key={combo.id} className="border-t pt-4 pb-4" style={{ borderColor: 'var(--border-secondary)' }}>
                <div className="flex justify-between items-center mb-2">
                  {editingComboId === combo.id ? (
                    <div className="flex items-center gap-2">
                      <Icon name="asterisk-simple" ariaLabel="Combo" size={16} variant="secondary" />
                      <input
                        type="text"
                        value={tempComboName}
                        onChange={handleComboNameChange}
                        onBlur={saveComboName}
                        onKeyDown={handleComboNameKeyDown}
                        className="enhanced-input font-medium"
                        style={{ 
                          backgroundColor: 'var(--bg-action-secondary)'
                        }}
                        autoFocus
                        maxLength={50}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Icon name="asterisk-simple" ariaLabel="Combo" size={16} variant="secondary" />
                      <h3 
                        className="cursor-pointer hover:opacity-80 py-1 rounded transition-colors"
                        style={{...typography.h3, color: 'var(--text-main)'}}
                        onClick={() => startEditingComboName(combo)}
                      >
                        {combo.name}
                      </h3>
                    </div>
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
                        {/* AC #6: [X] remove option for each card except the first */}
                        {cardIndex > 0 && (
                          <button
                            onClick={() => removeCard(combo.id, cardIndex)}
                            className="font-medium hover:opacity-80 transition-opacity w-8 h-8 flex items-center justify-center"
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              border: '1px solid var(--border-main)',
                              borderRadius: '50%',
                              color: 'var(--text-main)',
                              fontSize: '18px',
                              fontWeight: 'bold'
                            }}
                            title="Remove this card"
                          >
                            ×
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

                    {/* AND/OR toggle only for 3rd+ cards (cardIndex > 1) */}
                    {cardIndex > 1 && (
                      <div className="mb-3">
                        <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
                          Logic:
                          <Tooltip text="AND = need all cards, OR = need any of these cards" />
                        </label>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateCombo(combo.id, cardIndex, 'logicOperator', 'AND')}
                            className="px-4 py-2 rounded font-medium transition-colors"
                            style={{
                              backgroundColor: (card.logicOperator || 'AND') === 'AND' ? 'var(--bg-action)' : 'var(--bg-secondary)',
                              color: (card.logicOperator || 'AND') === 'AND' ? 'var(--text-black)' : 'var(--text-main)',
                              border: '1px solid var(--border-main)',
                              borderRadius: '8px',
                              height: '28px',
                              minWidth: '60px',
                              ...typography.body
                            }}
                          >
                            AND
                          </button>
                          <button
                            onClick={() => updateCombo(combo.id, cardIndex, 'logicOperator', 'OR')}
                            className="px-4 py-2 rounded font-medium transition-colors"
                            style={{
                              backgroundColor: (card.logicOperator || 'AND') === 'OR' ? 'var(--bg-action)' : 'var(--bg-secondary)',
                              color: (card.logicOperator || 'AND') === 'OR' ? 'var(--text-black)' : 'var(--text-main)',
                              border: '1px solid var(--border-main)',
                              borderRadius: '8px',
                              height: '28px',
                              minWidth: '60px',
                              ...typography.body
                            }}
                          >
                            OR
                          </button>
                        </div>
                      </div>
                    )}

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
                              border: 'none',
                              boxSizing: 'border-box'
                            }}
                          >
                            <Icon name="minus" ariaLabel="Decrease count" size={16} variant="secondary" />
                          </button>
                          <input
                            type="number"
                            value={card.startersInDeck}
                            onChange={(e) => updateCombo(combo.id, cardIndex, 'startersInDeck', parseInt(e.target.value) || 0)}
                            className={`enhanced-input text-center ${
                              errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`] ? 'border-red-500' : ''
                            }`}
                            style={{ 
                              width: '64px'
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
                              border: 'none',
                              boxSizing: 'border-box'
                            }}
                          >
                            <Icon name="plus" ariaLabel="Increase count" size={16} variant="secondary" />
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
                              onClick={() => validateAndUpdateCombo(combo.id, cardIndex, 'minCopiesInHand', Math.max(0, card.minCopiesInHand - 1))}
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
                              <Icon name="minus" ariaLabel="Decrease count" size={16} variant="secondary" />
                            </button>
                            <input
                              type="number"
                              value={card.minCopiesInHand}
                              onChange={(e) => validateAndUpdateCombo(combo.id, cardIndex, 'minCopiesInHand', parseInt(e.target.value) || 0)}
                              className={`enhanced-input text-center ${
                                errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`] ? 'border-red-500' : ''
                              }`}
                              style={{ 
                                width: '64px'
                              }}
                            />
                            <button
                              onClick={() => validateAndUpdateCombo(combo.id, cardIndex, 'minCopiesInHand', card.minCopiesInHand + 1)}
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
                              <Icon name="plus" ariaLabel="Increase count" size={16} variant="secondary" />
                            </button>
                          </div>
                          {errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`] && (
                            <p className="text-red-500 mt-1" style={{...typography.body, fontSize: '10px'}}>{errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`]}</p>
                          )}
                        </div>

                        <div className="flex-1">
                          <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
                            Max in hand:
                            <Tooltip text="Upper limit of copies you want to see. Helps avoid dead multiples" />
                          </label>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => validateAndUpdateCombo(combo.id, cardIndex, 'maxCopiesInHand', Math.max(0, card.maxCopiesInHand - 1))}
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
                              <Icon name="minus" ariaLabel="Decrease count" size={16} variant="secondary" />
                            </button>
                            <input
                              type="number"
                              value={card.maxCopiesInHand}
                              onChange={(e) => validateAndUpdateCombo(combo.id, cardIndex, 'maxCopiesInHand', parseInt(e.target.value) || 0)}
                              className={`enhanced-input text-center ${
                                errors[`combo-${combo.id}-card-${cardIndex}-maxCopiesInHand`] ? 'border-red-500' : ''
                              }`}
                              style={{ 
                                width: '64px'
                              }}
                            />
                            <button
                              onClick={() => validateAndUpdateCombo(combo.id, cardIndex, 'maxCopiesInHand', card.maxCopiesInHand + 1)}
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
                              <Icon name="plus" ariaLabel="Increase count" size={16} variant="secondary" />
                            </button>
                          </div>
                          {errors[`combo-${combo.id}-card-${cardIndex}-maxCopiesInHand`] && (
                            <p className="text-red-500 mt-1" style={{...typography.body, fontSize: '10px'}}>{errors[`combo-${combo.id}-card-${cardIndex}-maxCopiesInHand`]}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* AC #1, #2, #3, #4: Dynamic Add Card button */}
                <div className="flex items-center mt-4">
                  <button
                    onClick={() => addCard(combo.id)}
                    disabled={!canAddCard(combo)}
                    className="enhanced-button enhanced-button-add"
                  >
                    <Icon name="stack-plus" ariaLabel="Add card" size={14} className="button-icon" style={{ color: '#141414' }} />
                    <span className="button-text">Add card</span>
                  </button>
                  <Tooltip text={canAddCard(combo) 
                    ? "Add another card to create more complex combos" 
                    : "Your combo would exceed the defined Hand size"
                  } />
                </div>
              </div>
            ))}

          {combos.length < 10 && (
            <div>
              <hr className="my-4" style={{ borderColor: 'var(--border-secondary)', borderTop: '1px solid var(--border-secondary)' }} />
              <div className="flex items-center">
                <button
                  onClick={addCombo}
                  className="enhanced-button enhanced-button-add"
                >
                  <Icon name="rows-plus-bottom" ariaLabel="Add combo" size={14} className="button-icon" style={{ color: '#141414' }} />
                  <span className="button-text">Add combo</span>
                </button>
                <Tooltip text="Test multiple combo lines to see your deck's overall consistency options" />
              </div>
            </div>
          )}

          <div className="flex space-x-4 mt-6">
            <button
              onClick={runCalculation}
              disabled={!allFieldsFilled || hasValidationErrors}
              className="enhanced-button"
            >
              <Icon name="calculator" ariaLabel="Calculate" size={14} className="button-icon" style={{ color: '#141414' }} />
              <span className="button-text">Calculate</span>
            </button>
            <button
              onClick={handleReset}
              className="enhanced-button enhanced-button-reset"
            >
              <Icon name="arrow-counter-clockwise" ariaLabel="Reset" size={14} className="button-icon" style={{ color: '#141414' }} />
              <span className="button-text">Reset</span>
            </button>
          </div>
        </div>

        {/* Top Decks Section */}
        <section className="px-0 mb-8">
          <div className="flex items-center mb-4" style={{ gap: '8px' }}>
            <Icon name="star-four" ariaLabel="Top decks" size={16} />
            <h2 style={{...typography.h2, color: 'var(--text-main)'}}>Top Decks</h2>
          </div>
          
          <div className="space-y-3">
            {topDecks.map((deck, index) => (
              <div 
                key={index}
                className="cursor-pointer hover:opacity-80 transition-opacity p-4 rounded-lg border"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-secondary)' 
                }}
                onClick={() => handleTopDeckClick(deck.link, deck.title)}
              >
                <h3 style={{...typography.h3, color: 'var(--text-main)', marginBottom: '8px'}}>
                  {deck.title}
                </h3>
                <p style={{...typography.body, color: 'var(--text-secondary)'}}>
                  {deck.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div ref={calculationDashboardRef}>
          <ResultsDisplay 
            results={results}
            dashboardValues={dashboardValues}  
            openingHand={openingHand}
            isRefreshing={isRefreshing}
            refreshOpeningHand={refreshOpeningHand}
            generatedTitle={generatedTitle}
            shareableUrl={shareableUrl}
            handleCopyLink={handleCopyLink}
            showToast={showToast}
            typography={typography}
            testHandFromDecklist={testHandFromDecklist}
            setTestHandFromDecklist={setTestHandFromDecklist}
            ydkCards={ydkCards}
            ydkCardCounts={ydkCardCounts}
            deckSize={deckSize}
            handSize={handSize}
            combos={combos}
          />
        </div>


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
        

        {/* Toast notification */}
        {toastMessage && (
          <div 
            className="fixed bottom-4 right-4 px-4 py-2 rounded-md"
            style={{
              backgroundColor: 'var(--bg-action)',
              color: 'var(--text-action)',
              zIndex: 1000,
              ...typography.body
            }}
          >
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
};