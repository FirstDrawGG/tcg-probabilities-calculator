import React, { useState, useEffect, useRef } from 'react';

// URL encoding/decoding utilities
const URLService = {
  encodeCalculation: (deckSize, handSize, combos) => {
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
      
      return {
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
    } catch (error) {
      console.error('Failed to decode calculation:', error);
      return null;
    }
  },

  updateURL: (deckSize, handSize, combos) => {
    const encoded = URLService.encodeCalculation(deckSize, handSize, combos);
    if (encoded) {
      window.history.replaceState(null, '', `#calc=${encoded}`);
    }
  }
};

// Card database service
const CardDatabaseService = {
  CACHE_KEY: 'yugioh_cards_cache',
  CACHE_DURATION: 7 * 24 * 60 * 60 * 1000,
  
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
          border: '1px solid var(--border-secondary)',
          color: 'var(--icon-secondary)',
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
const SearchableCardInput = ({ value, onChange, placeholder, errors, comboId, cardIndex, cardDatabase }) => {
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
    if (searchTerm.length < 3) {
      setFilteredCards([]);
      return;
    }
    
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      console.log('Searching for:', searchTerm);
      console.log('Card database length:', cardDatabase ? cardDatabase.length : 0);
      
      const searchLower = searchTerm.toLowerCase();
      const matches = (cardDatabase || [])
        .filter(card => card.name && card.name.toLowerCase().includes(searchLower))
        .slice(0, 50)
        .map(card => ({
          name: card.name,
          id: card.id,
          isCustom: false
        }));
      
      console.log('Found matches:', matches.length);
      console.log('First few matches:', matches.slice(0, 3));
      
      setFilteredCards(matches);
    }, 300);
    
    return () => clearTimeout(debounceTimerRef.current);
  }, [searchTerm, cardDatabase]);
  
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
    onChange({
      starterCard: card.name,
      cardId: card.id,
      isCustom: card.isCustom
    });
    setSearchTerm('');
    setIsOpen(false);
    setIsEditing(false);
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
            ...typography.body
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
              className="hover:opacity-80"
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
              className="hover:opacity-80"
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
            <div className="p-3" style={typography.body}>
              Type at least 3 characters to search or use your custom name
            </div>
          ) : filteredCards.length > 0 ? (
            <>
              <div className="max-h-60 overflow-y-auto">
                {filteredCards.map((card, index) => (
                  <div
                    key={`${card.id}-${index}`}
                    className="px-3 py-2 hover:opacity-80 cursor-pointer"
                    style={typography.body}
                    onClick={() => handleCardSelect(card)}
                  >
                    {card.name}
                  </div>
                ))}
              </div>
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
                className="mt-2 px-4 py-2 hover:opacity-80 rounded"
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
  }, []);
  
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
    URLService.updateURL(deckSize, handSize, combos);
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
    setCombos(combos.map(combo => {
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
        `}
      </style>
      {isRestoringFromURL && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{backgroundColor: 'rgba(0, 0, 0, 0.5)'}}>
          <div className="p-6 rounded-lg" style={{backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)'}}>
            <p style={typography.body}>Loading shared calculation...</p>
          </div>
        </div>
      )}
      <div className="w-full mx-auto" style={{ maxWidth: '580px' }}>
        <div className="text-center mb-8">
          <img 
            src="https://raw.githubusercontent.com/FirstDrawGG/tcg-probabilities-calculator/main/Logo.png" 
            alt="FirstDrawGG Logo"
            className="mx-auto"
            style={{
              width: '120px',
              height: '120px',
              objectFit: 'contain'
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              const fallback = e.target.nextElementSibling;
              if (fallback) fallback.style.display = 'block';
            }}
          />
          <h1 className="text-center" style={{ ...typography.h1, display: 'none' }}>
            FirstDrawGG
          </h1>
        </div>
        
        {/* CTA Section */}
        <section className="px-6 mb-8">
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
        
        <div className="p-6" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h2 className="mb-4" style={typography.h2}>Define a Combo</h2>
          
          <div className="space-y-4">
            <div>
              <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)'}}>
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
              <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)'}}>
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
                      style={typography.h3}
                      onClick={() => startEditingComboName(combo)}
                    >
                      {combo.name}
                    </h3>
                  )}
                  {index > 0 && (
                    <button
                      onClick={() => removeCombo(combo.id)}
                      className="font-medium hover:opacity-80"
                      style={{
                        ...typography.body,
                        color: 'var(--text-secondary)'
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
                    <div className="flex justify-between items-center mb-2">
                      <h4 style={typography.h4}>
                        {cardIndex === 0 ? 'Card 1' : 'Card 2'}
                      </h4>
                      {cardIndex === 1 && (
                        <button
                          onClick={() => removeSecondCard(combo.id)}
                          className="font-medium hover:opacity-80"
                          style={{
                            ...typography.body,
                            color: 'var(--text-secondary)'
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <label className="flex items-center font-medium" style={{...typography.body, marginBottom: 'var(--spacing-xs)', color: 'var(--text-main)'}}>
                        Card name:
                        <Tooltip text="Search for any Yu-Gi-Oh card or create a custom placeholder (e.g. 'Any Dragon monster' or 'Any Unchained Card')" />
                      </label>
                      <SearchableCardInput
                        value={card.starterCard}
                        onChange={(value) => updateCombo(combo.id, cardIndex, 'starterCard', value)}
                        placeholder="Search card name"
                        errors={errors[`combo-${combo.id}-card-${cardIndex}-starterCard`]}
                        comboId={combo.id}
                        cardIndex={cardIndex}
                        cardDatabase={cardDatabase}
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
                              color: 'var(--text-main)',
                              width: '40px',
                              height: '40px',
                              borderRadius: '999px',
                              border: '1px solid var(--border-main)',
                              boxSizing: 'border-box'
                            }}
                          >
                            -
                          </button>
                          <div className={`text-center py-2 border ${
                            errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`] ? 'border-red-500' : ''
                          }`}
                          style={{ 
                            backgroundColor: 'var(--bg-secondary)', 
                            color: 'var(--text-main)',
                            width: '64px',
                            height: '40px',
                            borderRadius: '999px',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            ...typography.body
                          }}>
                            {card.startersInDeck}
                          </div>
                          <button
                            onClick={() => updateCombo(combo.id, cardIndex, 'startersInDeck', card.startersInDeck + 1)}
                            className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                            style={{ 
                              backgroundColor: 'var(--bg-secondary)', 
                              color: 'var(--text-main)',
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
                                color: 'var(--text-main)',
                                width: '40px',
                                height: '40px',
                                borderRadius: '999px',
                                border: 'none',
                                boxSizing: 'border-box'
                              }}
                            >
                              -
                            </button>
                            <div className={`text-center py-2 border ${
                              errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`] ? 'border-red-500' : ''
                            }`}
                            style={{ 
                              backgroundColor: 'var(--bg-secondary)', 
                              color: 'var(--text-main)',
                              width: '64px',
                              height: '40px',
                              borderRadius: '999px',
                              boxSizing: 'border-box',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              ...typography.body
                            }}>
                              {card.minCopiesInHand}
                            </div>
                            <button
                              onClick={() => updateCombo(combo.id, cardIndex, 'minCopiesInHand', card.minCopiesInHand + 1)}
                              className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                              style={{ 
                                backgroundColor: 'var(--bg-secondary)', 
                                color: 'var(--text-main)',
                                width: '40px',
                                height: '40px',
                                borderRadius: '999px',
                                border: 'none',
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
                                color: 'var(--text-main)',
                                width: '40px',
                                height: '40px',
                                borderRadius: '999px',
                                border: 'none',
                                boxSizing: 'border-box'
                              }}
                            >
                              -
                            </button>
                            <div className={`text-center py-2 border ${
                              errors[`combo-${combo.id}-card-${cardIndex}-maxCopiesInHand`] ? 'border-red-500' : ''
                            }`}
                            style={{ 
                              backgroundColor: 'var(--bg-secondary)', 
                              color: 'var(--text-main)',
                              width: '64px',
                              height: '40px',
                              borderRadius: '999px',
                              boxSizing: 'border-box',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              ...typography.body
                            }}>
                              {card.maxCopiesInHand}
                            </div>
                            <button
                              onClick={() => updateCombo(combo.id, cardIndex, 'maxCopiesInHand', card.maxCopiesInHand + 1)}
                              className="flex items-center justify-center font-semibold hover:opacity-80 transition-colors"
                              style={{ 
                                backgroundColor: 'var(--bg-secondary)', 
                                color: 'var(--text-main)',
                                width: '40px',
                                height: '40px',
                                borderRadius: '999px',
                                border: 'none',
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
              disabled={!allFieldsFilled}
              className={`flex-1 font-semibold transition-colors ${
                allFieldsFilled
                  ? 'hover:opacity-80'
                  : 'cursor-not-allowed opacity-50'
              }`}
              style={{ 
                backgroundColor: allFieldsFilled ? 'var(--bg-action)' : 'var(--border-secondary)',
                color: allFieldsFilled ? '#000000' : 'var(--text-placeholder)',
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

        <div className="p-6" style={{ marginBottom: 'var(--spacing-lg)' }}>
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
                      <span className="font-medium">Card {cardIndex + 1}:</span> {card.starterCard || '-'}
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

          {results.individual.length > 0 && (
            <div className="mt-6 space-y-2">
              {/* Combined probability result - only show if multiple combos */}
              {results.combined !== null && (
                <div className="p-4 rounded-md" style={{ backgroundColor: 'var(--bg-tertiary)', border: `1px solid var(--border-main)` }}>
                  <div className="flex items-center">
                    <p className="font-semibold" style={typography.body}>
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
          <div className="p-6" style={{ marginBottom: 'var(--spacing-lg)' }}>
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
                    backgroundColor: 'var(--bg-tertiary)', 
                    color: 'var(--text-main)',
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

        <div className="p-6" style={{ marginTop: 'var(--spacing-lg)' }}>
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