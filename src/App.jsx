import React, { useState, useEffect, useRef } from 'react';

// Card database service
const CardDatabaseService = {
  CACHE_KEY: 'yugioh_cards_cache',
  CACHE_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
  
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
  
  calculateMultipleCombos: (combos, deckSize, handSize) => {
    return combos.map(combo => ({
      id: combo.id,
      probability: ProbabilityService.monteCarloSimulation(combo, deckSize, handSize),
      cards: combo.cards
    }));
  }
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
  
  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Handle escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);
  
  // Search logic with debounce
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
    if (!value || isEditing) {
      setIsOpen(true);
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
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  
  const typography = {
    body: {
      fontSize: '14px',
      letterSpacing: '0.1px',
      lineHeight: '1em',
      color: '#ffffff',
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
          className={`w-full px-3 py-2 border ${errors ? 'border-red-500' : 'border-gray-600'}`}
          style={{ 
            backgroundColor: '#333', 
            color: '#ffffff',
            borderRadius: '999px',
            ...typography.body
          }}
        />
      ) : (
        <div 
          className={`w-full px-3 py-2 border ${errors ? 'border-red-500' : 'border-gray-600'} flex justify-between items-center`}
          style={{ 
            backgroundColor: '#333', 
            color: '#ffffff',
            borderRadius: '999px',
            ...typography.body
          }}
        >
          <span>{value}</span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleEdit}
              className="text-gray-400 hover:text-white"
              style={{ fontSize: '12px' }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-white"
              style={{ fontSize: '16px' }}
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      {isOpen && isEditing && (
        <div 
          className="absolute z-10 w-full mt-1 border border-gray-600 rounded-md shadow-lg"
          style={{ backgroundColor: '#282828' }}
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
                    className="px-3 py-2 hover:bg-gray-700 cursor-pointer"
                    style={typography.body}
                    onClick={() => handleCardSelect(card)}
                  >
                    {card.name}
                  </div>
                ))}
              </div>
              {filteredCards.length === 50 && (
                <div className="px-3 py-2 border-t border-gray-600 text-gray-400" style={typography.body}>
                  Type for more results
                </div>
              )}
            </>
          ) : (
            <div className="p-3" style={typography.body}>
              <div>No matching results. Use custom name?</div>
              <button
                onClick={handleCustomName}
                className="mt-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
                style={typography.body}
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
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState({});
  const [dashboardValues, setDashboardValues] = useState({
    deckSize: 40,
    handSize: 5,
    combos: []
  });
  const [editingComboId, setEditingComboId] = useState(null);
  const [tempComboName, setTempComboName] = useState('');
  const [cardDatabase, setCardDatabase] = useState([]);
  
  // Load card database on mount
  useEffect(() => {
    const loadCardDatabase = async () => {
      console.log('Starting card database load...');
      
      // Try cache first
      const cached = CardDatabaseService.loadFromCache();
      if (cached) {
        console.log('Loaded from cache:', cached.length, 'cards');
        setCardDatabase(cached);
        window.cardDatabase = cached;
        return;
      }
      
      console.log('Cache not found or expired, fetching from API...');
      
      // Fetch from API
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
      fontSize: '24px',
      letterSpacing: '-0.04em',
      lineHeight: '1em',
      color: '#ffffff',
      fontFamily: 'Geist Regular, sans-serif',
      fontWeight: 'normal'
    },
    h2: {
      fontSize: '24px',
      letterSpacing: '-0.04em',
      lineHeight: '1em',
      color: '#ffffff',
      fontFamily: 'Geist Regular, sans-serif',
      fontWeight: 'normal'
    },
    h3: {
      fontSize: '18px',
      letterSpacing: '-0.02em',
      lineHeight: '1em',
      color: '#ffffff',
      fontFamily: 'Geist Regular, sans-serif',
      fontWeight: 'normal'
    },
    h4: {
      fontSize: '14px',
      letterSpacing: '-0.02em',
      lineHeight: '1.4em',
      color: '#ffffff',
      fontFamily: 'Geist Regular, sans-serif',
      fontWeight: 'normal'
    },
    body: {
      fontSize: '14px',
      letterSpacing: '0.1px',
      lineHeight: '1em',
      color: '#ffffff',
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
  };

  const handleReset = () => {
    setDeckSize(40);
    setHandSize(5);
    setCombos([createCombo(1, 0)]);
    setResults([]);
    setErrors({});
    setDashboardValues({
      deckSize: 40,
      handSize: 5,
      combos: []
    });
    setEditingComboId(null);
    setTempComboName('');
    ProbabilityService.clearCache();
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
        // Handle card selection from dropdown
        updatedCombo.cards[cardIndex] = { 
          ...combo.cards[cardIndex], 
          starterCard: value.starterCard,
          cardId: value.cardId,
          isCustom: value.isCustom
        };
      } else {
        // Handle other field updates
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

  useEffect(() => {
    ProbabilityService.clearCache();
  }, [deckSize, handSize]);

  useEffect(() => {
    if (results.length > 0) validate();
  }, [deckSize, handSize, combos]);

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#000000', fontFamily: 'Geist Regular, sans-serif' }}>
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
            box-shadow: 0 0 0 2px #282828;
          }
        `}
      </style>
      <div className="max-w-2xl mx-auto">
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
        
        <div className="rounded-lg shadow-md p-6 mb-6" style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
          <h2 className="mb-4" style={typography.h2}>Define a Combo</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block font-medium mb-1" style={typography.body}>
                Deck size:
              </label>
              <input
                type="number"
                value={deckSize}
                onChange={(e) => setDeckSize(parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 border ${
                  errors.deckSize ? 'border-red-500' : 'border-gray-600'
                }`}
                style={{ 
                  backgroundColor: '#333', 
                  color: '#ffffff',
                  borderRadius: '999px',
                  ...typography.body
                }}
              />
              {errors.deckSize && (
                <p className="text-red-500 mt-1" style={typography.body}>{errors.deckSize}</p>
              )}
            </div>

            <div>
              <label className="block font-medium mb-1" style={typography.body}>
                Hand size:
              </label>
              <input
                type="number"
                value={handSize}
                onChange={(e) => setHandSize(parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 border ${
                  errors.handSize ? 'border-red-500' : 'border-gray-600'
                }`}
                style={{ 
                  backgroundColor: '#333', 
                  color: '#ffffff',
                  borderRadius: '999px',
                  ...typography.body
                }}
              />
              {errors.handSize && (
                <p className="text-red-500 mt-1" style={typography.body}>{errors.handSize}</p>
              )}
            </div>

            {combos.map((combo, index) => (
              <div key={combo.id} className="border-t pt-4" style={{ borderColor: '#444' }}>
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
                        backgroundColor: '#333', 
                        color: '#ffffff',
                        borderColor: '#666',
                        borderRadius: '999px',
                        ...typography.body
                      }}
                      autoFocus
                      maxLength={50}
                    />
                  ) : (
                    <h3 
                      className="cursor-pointer hover:bg-gray-800 py-1 rounded transition-colors"
                      style={typography.h3}
                      onClick={() => startEditingComboName(combo)}
                    >
                      {combo.name}
                    </h3>
                  )}
                  {index > 0 && (
                    <button
                      onClick={() => removeCombo(combo.id)}
                      className="text-red-400 hover:text-red-300 font-medium"
                      style={typography.body}
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                {errors[`combo-${combo.id}-name`] && (
                  <p className="text-red-500 mb-2" style={typography.body}>{errors[`combo-${combo.id}-name`]}</p>
                )}
                
                {combo.cards.map((card, cardIndex) => (
                  <div key={cardIndex} className={`${cardIndex > 0 ? 'border-t mt-4 pt-4' : ''}`} style={{ borderColor: '#666' }}>
                    <div className="flex justify-between items-center mb-2">
                      <h4 style={typography.h4}>
                        {cardIndex === 0 ? 'Card 1' : 'Card 2'}
                      </h4>
                      {cardIndex === 1 && (
                        <button
                          onClick={() => removeSecondCard(combo.id)}
                          className="text-red-400 hover:text-red-300 font-medium"
                          style={typography.body}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <label className="block font-medium mb-1" style={typography.body}>
                        Card name:
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
                        <label className="block font-medium mb-1" style={typography.body}>
                          Copies in deck:
                        </label>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => updateCombo(combo.id, cardIndex, 'startersInDeck', Math.max(0, card.startersInDeck - 1))}
                            className="flex items-center justify-center font-semibold hover:bg-gray-600 transition-colors"
                            style={{ 
                              backgroundColor: '#282828', 
                              color: '#ffffff',
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
                            errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`] ? 'border-red-500' : 'border-gray-600'
                          }`}
                          style={{ 
                            backgroundColor: '#282828', 
                            color: '#ffffff',
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
                            className="flex items-center justify-center font-semibold hover:bg-gray-600 transition-colors"
                            style={{ 
                              backgroundColor: '#282828', 
                              color: '#ffffff',
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
                        {errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`] && (
                          <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`]}</p>
                        )}
                      </div>

                      <div className="flex">
                        <div className="flex-1">
                          <label className="block font-medium mb-1" style={typography.body}>
                            Min in hand:
                          </label>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => updateCombo(combo.id, cardIndex, 'minCopiesInHand', Math.max(0, card.minCopiesInHand - 1))}
                              className="flex items-center justify-center font-semibold hover:bg-gray-600 transition-colors"
                              style={{ 
                                backgroundColor: '#282828', 
                                color: '#ffffff',
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
                              errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`] ? 'border-red-500' : 'border-gray-600'
                            }`}
                            style={{ 
                              backgroundColor: '#282828', 
                              color: '#ffffff',
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
                              className="flex items-center justify-center font-semibold hover:bg-gray-600 transition-colors"
                              style={{ 
                                backgroundColor: '#282828', 
                                color: '#ffffff',
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

                        <div className="flex-1" style={{ marginLeft: '16px' }}>
                          <label className="block font-medium mb-1" style={typography.body}>
                            Max in hand:
                          </label>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => updateCombo(combo.id, cardIndex, 'maxCopiesInHand', Math.max(0, card.maxCopiesInHand - 1))}
                              className="flex items-center justify-center font-semibold hover:bg-gray-600 transition-colors"
                              style={{ 
                                backgroundColor: '#282828', 
                                color: '#ffffff',
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
                              errors[`combo-${combo.id}-card-${cardIndex}-maxCopiesInHand`] ? 'border-red-500' : 'border-gray-600'
                            }`}
                            style={{ 
                              backgroundColor: '#282828', 
                              color: '#ffffff',
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
                              className="flex items-center justify-center font-semibold hover:bg-gray-600 transition-colors"
                              style={{ 
                                backgroundColor: '#282828', 
                                color: '#ffffff',
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
                  <button
                    onClick={() => addSecondCard(combo.id)}
                    className="font-medium transition-colors hover:bg-gray-700 mt-4"
                    style={{ 
                      boxSizing: 'border-box',
                      width: '200px',
                      height: '40px',
                      display: 'block',
                      backgroundColor: '#282828',
                      overflow: 'visible',
                      gap: '7px',
                      borderRadius: '999px',
                      color: '#ffffff',
                      border: 'none',
                      ...typography.body
                    }}
                  >
                    + Add 2nd card
                  </button>
                )}
              </div>
            ))}

            {combos.length < 10 && (
              <div>
                <hr className="my-4" style={{ borderColor: '#444', borderTop: '1px solid #444' }} />
                <button
                  onClick={addCombo}
                  className="font-medium transition-colors hover:bg-gray-700"
                  style={{ 
                    boxSizing: 'border-box',
                    width: '200px',
                    height: '40px',
                    display: 'block',
                    backgroundColor: '#282828',
                    overflow: 'visible',
                    gap: '7px',
                    borderRadius: '999px',
                    color: '#ffffff',
                    border: 'none',
                    ...typography.body
                  }}
                >
                  + Add another combo
                </button>
              </div>
            )}
          </div>

          <div className="flex space-x-4 mt-6">
            <button
              onClick={runCalculation}
              disabled={!allFieldsFilled}
              className={`flex-1 font-semibold transition-colors ${
                allFieldsFilled
                  ? 'hover:bg-gray-100'
                  : 'cursor-not-allowed opacity-50'
              }`}
              style={{ 
                backgroundColor: allFieldsFilled ? '#ffffff' : '#666666',
                color: allFieldsFilled ? '#000000' : '#999999',
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
              className="font-semibold transition-colors hover:bg-gray-700"
              style={{ 
                backgroundColor: '#282828', 
                color: '#ffffff',
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

        <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
          <h2 className="mb-4" style={typography.h2}>Calculation Dashboard</h2>
          
          <div className="space-y-2">
            <p style={typography.body}>
              <span className="font-medium">Deck size:</span> {dashboardValues.deckSize}
            </p>
            <p style={typography.body}>
              <span className="font-medium">Hand size:</span> {dashboardValues.handSize}
            </p>
            
            {dashboardValues.combos.map((combo, index) => (
              <div key={combo.id} className="pl-4 border-l-2" style={{ borderColor: '#444' }}>
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

          {results.length > 0 && (
            <div className="mt-6 space-y-2">
              {results.map((result, index) => (
                <div key={result.id} className="p-4 rounded-md" style={{ backgroundColor: '#2a4a6b' }}>
                  <p className="font-semibold" style={typography.body}>
                    {generateResultText(result)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 rounded-md border" style={{ backgroundColor: '#282828', borderColor: '#444' }}>
            <h3 className="font-semibold mb-3" style={typography.body}>Understanding Your Probability Results</h3>
            
            <h4 className="font-semibold mb-2" style={typography.body}>Why do I see slight variations in percentages?</h4>
            <p className="mb-3" style={typography.body}>
              You might notice that running the same deck configuration multiple times can show minor differences in probabilities (like 47.3% vs 47.5%). This is completely normal and expected!
            </p>
            
            <h4 className="font-semibold mb-2" style={typography.body}>The Monte Carlo Method</h4>
            <p className="mb-2" style={typography.body}>
              FirstDrawGG uses Monte Carlo simulation - the same proven method used by financial analysts, game developers, and engineers worldwide. Think of it like shuffling and drawing from your deck 100,000 times to see what actually happens, rather than just calculating theoretical odds.
            </p>
            
            <p className="mb-2" style={typography.body}>Here's how it works:</p>
            <ul className="list-disc pl-5 space-y-1 mb-3" style={typography.body}>
              <li>We simulate <span className="font-semibold">100,000 test hands</span> for each calculation</li>
              <li>Each simulation randomly shuffles your deck and draws cards</li>
              <li>The results show you what percentage of those hands met your criteria</li>
              <li>Just like real shuffling, each set of 100,000 tests will be slightly different</li>
            </ul>
            
            <h4 className="font-semibold mb-2" style={typography.body}>Why This Matters for Deck Building</h4>
            <p className="mb-3" style={typography.body}>
              These small variations (typically less than 0.5%) are actually a strength, not a weakness. They reflect the real randomness you'll experience at tournaments. A combo showing 43.2% one time and 43.5% another time tells you it's consistently in that 43-44% range - exactly the confidence level you need for competitive decisions.
            </p>
            
            <h4 className="font-semibold mb-2" style={typography.body}>The Bottom Line</h4>
            <p className="mb-3" style={typography.body}>
              With 100,000 simulations per calculation, our results are statistically robust. Whether you're optimizing your competitive deck's hand trap ratios or testing that spicy rogue combo, you can trust these probabilities to guide your deck building decisions. The minor variations you see are proof the system is working correctly, not a flaw.
            </p>
            
            <p className="italic" style={{ ...typography.body, color: '#cccccc' }}>
              Remember: In Yu-Gi-Oh, even a 1-2% improvement in consistency can be the difference between topping and bricking!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}