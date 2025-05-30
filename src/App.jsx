import React, { useState, useEffect } from 'react';

// Probability calculation service
const ProbabilityService = {
  // Monte Carlo strategy for probability calculation
  monteCarloSimulation: (combo, deckSize, handSize, simulations = 100000) => {
    let successes = 0;
    
    for (let i = 0; i < simulations; i++) {
      // Create deck array
      const deck = [];
      for (let j = 0; j < combo.startersInDeck; j++) deck.push(1);
      for (let j = 0; j < deckSize - combo.startersInDeck; j++) deck.push(0);
      
      // Shuffle deck (Fisher-Yates)
      for (let j = deck.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [deck[j], deck[k]] = [deck[k], deck[j]];
      }
      
      // Draw hand and count starters
      let startersDrawn = 0;
      for (let j = 0; j < handSize; j++) {
        if (deck[j] === 1) startersDrawn++;
      }
      
      if (startersDrawn === combo.startersInHand) successes++;
    }
    
    return (successes / simulations) * 100;
  },
  
  // Calculate probabilities for multiple combos
  calculateMultipleCombos: (combos, deckSize, handSize) => {
    return combos.map(combo => ({
      id: combo.id,
      probability: ProbabilityService.monteCarloSimulation(combo, deckSize, handSize),
      starterCard: combo.starterCard,
      startersInHand: combo.startersInHand
    }));
  }
};

// Combo data structure
const createCombo = (id, index) => ({
  id,
  name: `Combo ${index + 1}`,
  starterCard: '',
  startersInDeck: 3,
  startersInHand: 1
});

export default function App() {
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

  // Validation function
  const validate = () => {
    const newErrors = {};
    
    if (deckSize < 1) newErrors.deckSize = 'Please enter valid value';
    if (handSize < 1) newErrors.handSize = 'Please enter valid value';
    
    // Validation rules
    if (handSize > deckSize) newErrors.handSize = 'Please enter valid value';
    
    // Validate each combo
    combos.forEach((combo, index) => {
      if (combo.startersInDeck < 0) newErrors[`combo-${combo.id}-startersInDeck`] = 'Please enter valid value';
      if (combo.startersInHand < 0) newErrors[`combo-${combo.id}-startersInHand`] = 'Please enter valid value';
      if (combo.starterCard.length > 50) newErrors[`combo-${combo.id}-starterCard`] = 'Please enter valid value';
      
      if (combo.startersInHand > handSize) newErrors[`combo-${combo.id}-startersInHand`] = 'Please enter valid value';
      if (combo.startersInHand > combo.startersInDeck) newErrors[`combo-${combo.id}-startersInHand`] = 'Please enter valid value';
      if (combo.startersInDeck > deckSize) newErrors[`combo-${combo.id}-startersInDeck`] = 'Please enter valid value';
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if all fields are filled for button enable/disable
  const allFieldsFilled = combos.every(combo => combo.starterCard.trim() !== '');

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

  const updateCombo = (id, field, value) => {
    setCombos(combos.map(combo => 
      combo.id === id ? { ...combo, [field]: value } : combo
    ));
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
      updateCombo(editingComboId, 'name', finalName);
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

  // Validate on change
  useEffect(() => {
    if (results.length > 0) validate();
  }, [deckSize, handSize, combos]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
          TCG Probabilities Calculator
        </h1>
        
        {/* Input Fields */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Define a Combo</h2>
          
          <div className="space-y-4">
            {/* Deck Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deck size:
              </label>
              <input
                type="number"
                value={deckSize}
                onChange={(e) => setDeckSize(parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.deckSize ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.deckSize && (
                <p className="text-red-500 text-sm mt-1">{errors.deckSize}</p>
              )}
            </div>

            {/* Hand Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hand size:
              </label>
              <input
                type="number"
                value={handSize}
                onChange={(e) => setHandSize(parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.handSize ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.handSize && (
                <p className="text-red-500 text-sm mt-1">{errors.handSize}</p>
              )}
            </div>

            {/* Combo sections */}
            {combos.map((combo, index) => (
              <div key={combo.id} className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  {editingComboId === combo.id ? (
                    <input
                      type="text"
                      value={tempComboName}
                      onChange={handleComboNameChange}
                      onBlur={saveComboName}
                      onKeyDown={handleComboNameKeyDown}
                      className="font-medium text-gray-700 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                      maxLength={50}
                    />
                  ) : (
                    <h3 
                      className="font-medium text-gray-700 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                      onClick={() => startEditingComboName(combo)}
                    >
                      {combo.name}
                    </h3>
                  )}
                  {index > 0 && (
                    <button
                      onClick={() => removeCombo(combo.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                {errors[`combo-${combo.id}-name`] && (
                  <p className="text-red-500 text-sm mb-2">{errors[`combo-${combo.id}-name`]}</p>
                )}
                
                {/* Starter Card */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Starter card:
                  </label>
                  <input
                    type="text"
                    value={combo.starterCard}
                    onChange={(e) => updateCombo(combo.id, 'starterCard', e.target.value)}
                    maxLength={50}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                      errors[`combo-${combo.id}-starterCard`] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors[`combo-${combo.id}-starterCard`] && (
                    <p className="text-red-500 text-sm mt-1">{errors[`combo-${combo.id}-starterCard`]}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Number of Starters in Deck */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of starters:
                    </label>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => updateCombo(combo.id, 'startersInDeck', Math.max(0, combo.startersInDeck - 1))}
                        className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-md flex items-center justify-center font-semibold"
                      >
                        -
                      </button>
                      <div className={`w-16 text-center py-2 border rounded-md ${
                        errors[`combo-${combo.id}-startersInDeck`] ? 'border-red-500' : 'border-gray-300'
                      }`}>
                        {combo.startersInDeck}
                      </div>
                      <button
                        onClick={() => updateCombo(combo.id, 'startersInDeck', combo.startersInDeck + 1)}
                        className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-md flex items-center justify-center font-semibold"
                      >
                        +
                      </button>
                    </div>
                    {errors[`combo-${combo.id}-startersInDeck`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`combo-${combo.id}-startersInDeck`]}</p>
                    )}
                  </div>

                  {/* Starters in Hand */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Starters in hand:
                    </label>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => updateCombo(combo.id, 'startersInHand', Math.max(0, combo.startersInHand - 1))}
                        className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-md flex items-center justify-center font-semibold"
                      >
                        -
                      </button>
                      <div className={`w-16 text-center py-2 border rounded-md ${
                        errors[`combo-${combo.id}-startersInHand`] ? 'border-red-500' : 'border-gray-300'
                      }`}>
                        {combo.startersInHand}
                      </div>
                      <button
                        onClick={() => updateCombo(combo.id, 'startersInHand', combo.startersInHand + 1)}
                        className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-md flex items-center justify-center font-semibold"
                      >
                        +
                      </button>
                    </div>
                    {errors[`combo-${combo.id}-startersInHand`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`combo-${combo.id}-startersInHand`]}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Add Combo Button */}
            {combos.length < 10 && (
              <button
                onClick={addCombo}
                className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700 border border-gray-300"
              >
                + Add another combo
              </button>
            )}
          </div>

          {/* Buttons */}
          <div className="flex space-x-4 mt-6">
            <button
              onClick={runCalculation}
              disabled={!allFieldsFilled}
              className={`flex-1 py-3 px-4 rounded-md font-semibold ${
                allFieldsFilled
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Calculate 💯
            </button>
            <button
              onClick={handleReset}
              className="py-3 px-4 bg-gray-200 hover:bg-gray-300 rounded-md font-semibold"
            >
              Reset 🔁
            </button>
          </div>
        </div>

        {/* Calculation Dashboard */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Calculation Dashboard</h2>
          
          <div className="space-y-2 text-gray-700">
            <p><span className="font-medium">Deck size:</span> {dashboardValues.deckSize}</p>
            <p><span className="font-medium">Hand size:</span> {dashboardValues.handSize}</p>
            
            {dashboardValues.combos.map((combo, index) => (
              <div key={combo.id} className="pl-4 border-l-2 border-gray-200">
                <p className="font-medium text-gray-800">{combo.name}</p>
                <p><span className="font-medium">Starter card:</span> {combo.starterCard || '-'}</p>
                <p><span className="font-medium">Number of starters:</span> {combo.startersInDeck}</p>
                <p><span className="font-medium">Starters in hand:</span> {combo.startersInHand}</p>
              </div>
            ))}
          </div>

          {results.length > 0 && (
            <div className="mt-6 space-y-2">
              {results.map((result, index) => (
                <div key={result.id} className="p-4 bg-blue-50 rounded-md">
                  <p className="text-lg font-semibold text-blue-900">
                    Chances of seeing exactly {result.startersInHand} copies of {result.starterCard} in your opening hand: {result.probability.toFixed(2)}%
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Monte Carlo Disclaimer */}
          <div className="mt-6 p-4 bg-blue-50 rounded-md border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Understanding Your Probability Results</h3>
            
            <h4 className="font-semibold text-blue-800 mb-2">Why do I see slight variations in percentages?</h4>
            <p className="text-gray-700 mb-3">
              You might notice that running the same deck configuration multiple times can show minor differences in probabilities (like 47.3% vs 47.5%). This is completely normal and expected!
            </p>
            
            <h4 className="font-semibold text-blue-800 mb-2">The Monte Carlo Method</h4>
            <p className="text-gray-700 mb-2">
              TCG Probabilities Calculator uses Monte Carlo simulation - the same proven method used by financial analysts, game developers, and engineers worldwide. Think of it like shuffling and drawing from your deck 100,000 times to see what actually happens, rather than just calculating theoretical odds.
            </p>
            
            <p className="text-gray-700 mb-2">Here's how it works:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-700 mb-3">
              <li>We simulate <span className="font-semibold">100,000 test hands</span> for each calculation</li>
              <li>Each simulation randomly shuffles your deck and draws cards</li>
              <li>The results show you what percentage of those hands met your criteria</li>
              <li>Just like real shuffling, each set of 100,000 tests will be slightly different</li>
            </ul>
            
            <h4 className="font-semibold text-blue-800 mb-2">Why This Matters for Deck Building</h4>
            <p className="text-gray-700 mb-3">
              These small variations (typically less than 0.5%) are actually a strength, not a weakness. They reflect the real randomness you'll experience at tournaments. A combo showing 43.2% one time and 43.5% another time tells you it's consistently in that 43-44% range - exactly the confidence level you need for competitive decisions.
            </p>
            
            <h4 className="font-semibold text-blue-800 mb-2">The Bottom Line</h4>
            <p className="text-gray-700 mb-3">
              With 100,000 simulations per calculation, our results are statistically robust. Whether you're optimizing your competitive deck's hand trap ratios or testing that spicy rogue combo, you can trust these probabilities to guide your deck building decisions. The minor variations you see are proof the system is working correctly, not a flaw.
            </p>
            
            <p className="italic text-gray-600">
              Remember: In Yu-Gi-Oh, even a 1-2% improvement in consistency can be the difference between topping and bricking!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}