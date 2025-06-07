import React, { useState, useEffect } from 'react';

// Probability calculation service
const ProbabilityService = {
  // Result cache for reusing identical combo results
  resultCache: new Map(),
  
  // Clear the cache
  clearCache: function() {
    this.resultCache.clear();
  },
  
  // Generate cache key from combo parameters
  getCacheKey: function(combo, deckSize, handSize) {
    const cardsKey = combo.cards.map(card => 
      `${card.startersInDeck}-${card.minCopiesInHand}-${card.maxCopiesInHand}`
    ).join('|');
    return `${cardsKey}-${deckSize}-${handSize}`;
  },
  
  // Monte Carlo strategy for probability calculation
  monteCarloSimulation: (combo, deckSize, handSize, simulations = 100000) => {
    // Check cache first
    const cacheKey = ProbabilityService.getCacheKey(combo, deckSize, handSize);
    
    if (ProbabilityService.resultCache.has(cacheKey)) {
      return ProbabilityService.resultCache.get(cacheKey);
    }
    
    // Run simulation if not in cache
    let successes = 0;
    
    for (let i = 0; i < simulations; i++) {
      // Create deck array with all card types
      const deck = [];
      let currentPosition = 0;
      
      // Add each card type to deck
      combo.cards.forEach((card, cardIndex) => {
        for (let j = 0; j < card.startersInDeck; j++) {
          deck.push(cardIndex); // Use card index as identifier
        }
        currentPosition += card.startersInDeck;
      });
      
      // Fill remaining deck with non-combo cards
      for (let j = currentPosition; j < deckSize; j++) {
        deck.push(-1); // -1 represents non-combo cards
      }
      
      // Shuffle deck (Fisher-Yates)
      for (let j = deck.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [deck[j], deck[k]] = [deck[k], deck[j]];
      }
      
      // Draw hand and count each card type
      const cardCounts = new Array(combo.cards.length).fill(0);
      for (let j = 0; j < handSize; j++) {
        if (deck[j] >= 0) { // If it's a combo card
          cardCounts[deck[j]]++;
        }
      }
      
      // Check if ALL cards meet their criteria (AND logic)
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
    
    // Cache the result
    ProbabilityService.resultCache.set(cacheKey, probability);
    
    return probability;
  },
  
  // Calculate probabilities for multiple combos
  calculateMultipleCombos: (combos, deckSize, handSize) => {
    return combos.map(combo => ({
      id: combo.id,
      probability: ProbabilityService.monteCarloSimulation(combo, deckSize, handSize),
      cards: combo.cards
    }));
  }
};

// Combo data structure - now supports multiple cards
const createCombo = (id, index) => ({
  id,
  name: `Combo ${index + 1}`,
  cards: [{
    starterCard: '',
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

  // Typography Design System - FirstDrawGG
  const typography = {
    h1: {
      fontSize: '24px',
      letterSpacing: '-0.04em',
      lineHeight: '1em',
      color: '#ffffff',
      fontFamily: 'Geist Thin, sans-serif',
      fontWeight: 'normal'
    },
    h2: {
      fontSize: '24px',
      letterSpacing: '-0.04em',
      lineHeight: '1em',
      color: '#ffffff',
      fontFamily: 'Geist Thin, sans-serif',
      fontWeight: 'normal'
    },
    h3: {
      fontSize: '18px',
      letterSpacing: '-0.02em',
      lineHeight: '1em',
      color: '#ffffff',
      fontFamily: 'Geist Thin, sans-serif',
      fontWeight: 'normal'
    },
    h4: {
      fontSize: '14px',
      letterSpacing: '-0.02em',
      lineHeight: '1.4em',
      color: '#ffffff',
      fontFamily: 'Geist Thin, sans-serif',
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

  // Validation function
  const validate = () => {
    const newErrors = {};
    
    if (deckSize < 1) newErrors.deckSize = 'Please enter valid value';
    if (handSize < 1) newErrors.handSize = 'Please enter valid value';
    
    // Validation rules
    if (handSize > deckSize) newErrors.handSize = 'Please enter valid value';
    
    // Validate each combo
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
      
      // Check total cards across all cards in combo don't exceed deck size
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

  // Check if all fields are filled for button enable/disable
  const allFieldsFilled = combos.every(combo => 
    combo.cards.every(card => card.starterCard.trim() !== '')
  );

  // Calculate probabilities
  const runCalculation = () => {
    if (!validate()) return;
    
    // Update dashboard values
    setDashboardValues({
      deckSize,
      handSize,
      combos: combos.map(c => ({ ...c }))
    });
    
    // Calculate probabilities for all combos
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
    // Clear the result cache
    ProbabilityService.clearCache();
  };

  // Combo management functions
  const addCombo = () => {
    if (combos.length < 10) {
      const newId = Math.max(...combos.map(c => c.id)) + 1;
      setCombos([...combos, createCombo(newId, combos.length)]);
    }
  };

  const removeCombo = (id) => {
    const newCombos = combos.filter(combo => combo.id !== id);
    // Update combo names to maintain sequential order
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
      updatedCombo.cards[cardIndex] = { ...combo.cards[cardIndex], [field]: value };
      
      // Auto-adjust max if min is set higher
      if (field === 'minCopiesInHand' && value > combo.cards[cardIndex].maxCopiesInHand) {
        updatedCombo.cards[cardIndex].maxCopiesInHand = value;
      }
      
      return updatedCombo;
    }));
  };

  // Update combo-level properties (like name)
  const updateComboProperty = (id, field, value) => {
    setCombos(combos.map(combo => {
      if (combo.id !== id) return combo;
      return { ...combo, [field]: value };
    }));
  };

  // Add second card to combo
  const addSecondCard = (comboId) => {
    setCombos(combos.map(combo => {
      if (combo.id !== comboId) return combo;
      
      return {
        ...combo,
        cards: [
          ...combo.cards,
          {
            starterCard: '',
            startersInDeck: 3,
            minCopiesInHand: 1,
            maxCopiesInHand: 3
          }
        ]
      };
    }));
  };

  // Remove second card from combo
  const removeSecondCard = (comboId) => {
    setCombos(combos.map(combo => {
      if (combo.id !== comboId) return combo;
      
      return {
        ...combo,
        cards: [combo.cards[0]] // Keep only first card
      };
    }));
  };

  // Combo name editing functions
  const startEditingComboName = (combo) => {
    setEditingComboId(combo.id);
    setTempComboName(combo.name);
    // Clear any existing combo name errors
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`combo-${combo.id}-name`];
      return newErrors;
    });
  };

  const handleComboNameChange = (e) => {
    const value = e.target.value;
    
    // Limit to 50 characters
    if (value.length > 50) return;
    
    // Check for invalid characters (allow only alphanumeric and spaces)
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
    
    // If empty, revert to default
    if (finalName === '') {
      finalName = `Combo ${comboIndex + 1}`;
    }
    
    // Check uniqueness (case-sensitive)
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
    
    // Only save if valid (no non-alphanumeric characters)
    const isValid = /^[a-zA-Z0-9 ]*$/.test(finalName);
    if (isValid) {
      updateComboProperty(editingComboId, 'name', finalName);
      setEditingComboId(null);
      setTempComboName('');
      // Clear any errors
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

  // Generate result text based on card min/max equality scenarios
  const generateResultText = (result) => {
    const cards = result.cards;
    const probability = result.probability;
    
    if (!cards || cards.length === 0) {
      return `Calculation error: ${probability.toFixed(2)}%`;
    }
    
    if (cards.length === 1) {
      // Single card scenario
      const card = cards[0];
      if (card.minCopiesInHand === card.maxCopiesInHand) {
        return `Chances of seeing exactly ${card.minCopiesInHand} copies of ${card.starterCard} in your opening hand: ${probability.toFixed(2)}%`;
      } else {
        return `Chances of seeing between ${card.minCopiesInHand} and ${card.maxCopiesInHand} copies of ${card.starterCard} in your opening hand: ${probability.toFixed(2)}%`;
      }
    } else {
      // Two card scenario - handle all 4 combinations
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

  // Clear cache when deck size or hand size changes
  useEffect(() => {
    ProbabilityService.clearCache();
  }, [deckSize, handSize]);

  // Validate on change
  useEffect(() => {
    if (results.length > 0) validate();
  }, [deckSize, handSize, combos]);

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#000000', fontFamily: 'Geist Regular, sans-serif' }}>
      <style>
        {`
          /* Remove chevrons/spinners from number inputs */
          input[type="number"]::-webkit-outer-spin-button,
          input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type="number"] {
            -moz-appearance: textfield;
          }
        `}
      </style>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-center mb-8" style={typography.h1}>
          FirstDrawGG
        </h1>
        
        {/* Input Fields */}
        <div className="rounded-lg shadow-md p-6 mb-6" style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
          <h2 className="mb-4" style={typography.h2}>Define a Combo</h2>
          
          <div className="space-y-4">
            {/* Deck Size */}
            <div>
              <label className="block font-medium mb-1" style={typography.body}>
                Deck size:
              </label>
              <input
                type="number"
                value={deckSize}
                onChange={(e) => setDeckSize(parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.deckSize ? 'border-red-500' : 'border-gray-600'
                }`}
                style={{ 
                  backgroundColor: '#333', 
                  color: '#ffffff',
                  ...typography.body
                }}
              />
              {errors.deckSize && (
                <p className="text-red-500 mt-1" style={typography.body}>{errors.deckSize}</p>
              )}
            </div>

            {/* Hand Size */}
            <div>
              <label className="block font-medium mb-1" style={typography.body}>
                Hand size:
              </label>
              <input
                type="number"
                value={handSize}
                onChange={(e) => setHandSize(parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.handSize ? 'border-red-500' : 'border-gray-600'
                }`}
                style={{ 
                  backgroundColor: '#333', 
                  color: '#ffffff',
                  ...typography.body
                }}
              />
              {errors.handSize && (
                <p className="text-red-500 mt-1" style={typography.body}>{errors.handSize}</p>
              )}
            </div>

            {/* Combo sections */}
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
                      className="font-medium px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ 
                        backgroundColor: '#333', 
                        color: '#ffffff',
                        borderColor: '#666',
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
                
                {/* Cards in this combo */}
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
                    
                    {/* Card Name */}
                    <div className="mb-3">
                      <label className="block font-medium mb-1" style={typography.body}>
                        Card name:
                      </label>
                      <input
                        type="text"
                        value={card.starterCard}
                        onChange={(e) => updateCombo(combo.id, cardIndex, 'starterCard', e.target.value)}
                        maxLength={50}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                          errors[`combo-${combo.id}-card-${cardIndex}-starterCard`] ? 'border-red-500' : 'border-gray-600'
                        }`}
                        style={{ 
                          backgroundColor: '#333', 
                          color: '#ffffff',
                          ...typography.body
                        }}
                      />
                      {errors[`combo-${combo.id}-card-${cardIndex}-starterCard`] && (
                        <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${combo.id}-card-${cardIndex}-starterCard`]}</p>
                      )}
                    </div>

                    <div className="space-y-4">
                      {/* Copies in Deck */}
                      <div>
                        <label className="block font-medium mb-1" style={typography.body}>
                          Copies in deck:
                        </label>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => updateCombo(combo.id, cardIndex, 'startersInDeck', Math.max(0, card.startersInDeck - 1))}
                            className="w-10 h-10 rounded-md flex items-center justify-center font-semibold hover:bg-gray-600 transition-colors"
                            style={{ backgroundColor: '#444', color: '#ffffff' }}
                          >
                            -
                          </button>
                          <div className={`w-16 text-center py-2 border rounded-md ${
                            errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`] ? 'border-red-500' : 'border-gray-600'
                          }`}
                          style={{ 
                            backgroundColor: '#333', 
                            color: '#ffffff',
                            ...typography.body
                          }}>
                            {card.startersInDeck}
                          </div>
                          <button
                            onClick={() => updateCombo(combo.id, cardIndex, 'startersInDeck', card.startersInDeck + 1)}
                            className="w-10 h-10 rounded-md flex items-center justify-center font-semibold hover:bg-gray-600 transition-colors"
                            style={{ backgroundColor: '#444', color: '#ffffff' }}
                          >
                            +
                          </button>
                        </div>
                        {errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`] && (
                          <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${combo.id}-card-${cardIndex}-startersInDeck`]}</p>
                        )}
                      </div>

                      {/* Min and Max Copies Row */}
                      <div className="flex">
                        {/* Min in Hand */}
                        <div className="flex-1">
                          <label className="block font-medium mb-1" style={typography.body}>
                            Min in hand:
                          </label>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => updateCombo(combo.id, cardIndex, 'minCopiesInHand', Math.max(0, card.minCopiesInHand - 1))}
                              className="w-10 h-10 rounded-md flex items-center justify-center font-semibold hover:bg-gray-600 transition-colors"
                              style={{ backgroundColor: '#444', color: '#ffffff' }}
                            >
                              -
                            </button>
                            <div className={`w-16 text-center py-2 border rounded-md ${
                              errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`] ? 'border-red-500' : 'border-gray-600'
                            }`}
                            style={{ 
                              backgroundColor: '#333', 
                              color: '#ffffff',
                              ...typography.body
                            }}>
                              {card.minCopiesInHand}
                            </div>
                            <button
                              onClick={() => updateCombo(combo.id, cardIndex, 'minCopiesInHand', card.minCopiesInHand + 1)}
                              className="w-10 h-10 rounded-md flex items-center justify-center font-semibold hover:bg-gray-600 transition-colors"
                              style={{ backgroundColor: '#444', color: '#ffffff' }}
                            >
                              +
                            </button>
                          </div>
                          {errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`] && (
                            <p className="text-red-500 mt-1" style={typography.body}>{errors[`combo-${combo.id}-card-${cardIndex}-minCopiesInHand`]}</p>
                          )}
                        </div>

                        {/* Max in Hand */}
                        <div className="flex-1" style={{ marginLeft: '16px' }}>
                          <label className="block font-medium mb-1" style={typography.body}>
                            Max in hand:
                          </label>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => updateCombo(combo.id, cardIndex, 'maxCopiesInHand', Math.max(0, card.maxCopiesInHand - 1))}
                              className="w-10 h-10 rounded-md flex items-center justify-center font-semibold hover:bg-gray-600 transition-colors"
                              style={{ backgroundColor: '#444', color: '#ffffff' }}
                            >
                              -
                            </button>
                            <div className={`w-16 text-center py-2 border rounded-md ${
                              errors[`combo-${combo.id}-card-${cardIndex}-maxCopiesInHand`] ? 'border-red-500' : 'border-gray-600'
                            }`}
                            style={{ 
                              backgroundColor: '#333', 
                              color: '#ffffff',
                              ...typography.body
                            }}>
                              {card.maxCopiesInHand}
                            </div>
                            <button
                              onClick={() => updateCombo(combo.id, cardIndex, 'maxCopiesInHand', card.maxCopiesInHand + 1)}
                              className="w-10 h-10 rounded-md flex items-center justify-center font-semibold hover:bg-gray-600 transition-colors"
                              style={{ backgroundColor: '#444', color: '#ffffff' }}
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
                
                {/* Add 2nd Card Button */}
                {combo.cards.length === 1 && (
                  <button
                    onClick={() => addSecondCard(combo.id)}
                    className="font-medium transition-colors hover:bg-gray-700 mt-4"
                    style={{ 
                      boxSizing: 'border-box',
                      width: '160px',
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

            {/* Add Combo Button */}
            {combos.length < 10 && (
              <div>
                {/* Line separator */}
                <hr className="my-4" style={{ borderColor: '#444', borderTop: '1px solid #444' }} />
                <button
                  onClick={addCombo}
                  className="font-medium transition-colors hover:bg-gray-700"
                  style={{ 
                    boxSizing: 'border-box',
                    width: '160px',
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

          {/* Buttons */}
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

        {/* Calculation Dashboard */}
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

          {/* Monte Carlo Disclaimer */}
          <div className="mt-6 p-4 rounded-md border" style={{ backgroundColor: '#2a4a6b', borderColor: '#4a6b8a' }}>
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