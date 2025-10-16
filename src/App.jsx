import React, { useState, useEffect, useRef } from 'react';

// Custom Hooks
import useCombos from './hooks/useCombos';
import useDeckConfig from './hooks/useDeckConfig';
import useCalculations from './hooks/useCalculations';
import useCardSearch from './hooks/useCardSearch';
import useShareableUrl from './hooks/useShareableUrl';
import useYdkImport from './hooks/useYdkImport';
import useToast from './hooks/useToast';
import useOpeningHand from './hooks/useOpeningHand';
import useErrors from './hooks/useErrors';

// Service imports
import ProbabilityService from './services/ProbabilityService';
import URLService from './services/URLService';
import CardDatabaseService from './services/CardDatabaseService';
import TitleGeneratorService from './services/TitleGeneratorService';
import HandTrapService from './services/HandTrapService';
import YdkParser from './services/YdkParser';

// Component imports
import ComboBuilder from './features/calculator/ComboBuilder';
import ResultsDisplay from './features/calculator/ResultsDisplay';
import DeckConfigInputs from './features/calculator/DeckConfigInputs';
import ComboForm from './features/combo/ComboForm';
import DeckImageSection from './features/deck-builder/DeckImageSection';
import Icon from './components/Icon';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import { Button, Tooltip } from './components/ui';

// Constants imports
import { DEFAULT_DECK_SIZE, DEFAULT_HAND_SIZE, TYPOGRAPHY } from './constants/config';

// Utility imports
import { createCombo } from './utils/comboFactory';

// Additional service imports
import OpeningHandService from './services/OpeningHandService';

// Additional component imports
import CardImage from './components/CardImage';
import SearchableCardInput from './features/shared/SearchableCardInput';
import { Toast } from './components/ui';
import DeckStatistics from './features/deck-builder/DeckStatistics';

export default function TCGCalculator() {
  // Custom Hooks
  const { deckSize, handSize, setDeckSize, setHandSize } = useDeckConfig();
  const { combos, setCombos } = useCombos(createCombo(1, 0));
  const { results, setResults } = useCalculations();
  const { cardDatabase, setCardDatabase } = useCardSearch();
  const [toastMessage, setToastMessage] = useState('');
  const { openingHand, setOpeningHand, isRefreshing, setIsRefreshing } = useOpeningHand();
  const { errors, setErrors } = useErrors();

  // YDK Import hook
  const {
    uploadedYdkFile,
    setUploadedYdkFile,
    ydkCards,
    setYdkCards,
    ydkCardCounts,
    setYdkCardCounts,
    testHandFromDecklist,
    setTestHandFromDecklist,
    initialDeckZones,
    setInitialDeckZones,
    deckZones,
    setDeckZones,
    updateDeckZones,
    clearYdkImport
  } = useYdkImport();

  // Shareable URL hook
  const { shareableUrl, setShareableUrl, showCopiedMessage, setShowCopiedMessage } = useShareableUrl();

  // State that doesn't have hooks (keep as-is)
  const [dashboardValues, setDashboardValues] = useState({
    deckSize: DEFAULT_DECK_SIZE,
    handSize: DEFAULT_HAND_SIZE,
    combos: []
  });
  const [editingComboId, setEditingComboId] = useState(null);
  const [tempComboName, setTempComboName] = useState('');
  const [isRestoringFromURL, setIsRestoringFromURL] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [staticCardDatabase, setStaticCardDatabase] = useState({});

  const refreshDebounceRef = useRef(null);
  const calculationDashboardRef = useRef(null);

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
      fontFamily: 'Geist, sans-serif'
    },
    h2: {
      fontSize: 'var(--font-h2-size)',
      lineHeight: 'var(--font-h2-line-height)',
      color: 'var(--text-main)',
      fontFamily: 'Geist, sans-serif'
    },
    h3: {
      fontSize: 'var(--font-h3-size)',
      lineHeight: 'var(--font-h3-line-height)',
      color: 'var(--text-main)',
      fontFamily: 'Geist, sans-serif'
    },
    h4: {
      fontSize: 'var(--font-h3-size)',
      lineHeight: 'var(--font-h3-line-height)',
      color: 'var(--text-main)',
      fontFamily: 'Geist, sans-serif'
    },
    body: {
      fontSize: 'var(--font-body-size)',
      lineHeight: 'var(--font-body-line-height)',
      color: 'var(--text-secondary)',
      fontFamily: 'Geist, sans-serif'
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

      console.log('  📋 Current card state before update:', {
        starterCard: currentCard.starterCard,
        startersInDeck: currentCard.startersInDeck,
        minCopiesInHand: currentCard.minCopiesInHand,
        maxCopiesInHand: currentCard.maxCopiesInHand
      });

      if (field === 'starterCard' && typeof value === 'object') {
        console.log('  🔧 Updating starterCard with object value');
        updatedCombo.cards[cardIndex] = {
          ...combo.cards[cardIndex],
          starterCard: value.starterCard,
          cardId: value.cardId,
          isCustom: value.isCustom
        };

        // NEW: When adding a card from YDK, set copies in deck and max in hand
        if (value.startersInDeck !== undefined) {
          console.log(`  📦 Setting startersInDeck from ${currentCard.startersInDeck} to ${value.startersInDeck}`);
          updatedCombo.cards[cardIndex].startersInDeck = value.startersInDeck;

          // When selecting from YDK, always adjust Max in hand to match deck count
          // This ensures YDK cards reflect actual deck composition
          console.log(`  ✨ Auto-adjusting maxCopiesInHand from ${currentCard.maxCopiesInHand} to ${value.startersInDeck}`);
          updatedCombo.cards[cardIndex].maxCopiesInHand = value.startersInDeck;

          // Clear any errors for maxCopiesInHand since we auto-adjusted it
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[`combo-${id}-card-${cardIndex}-maxCopiesInHand`];
            return newErrors;
          });
        }
        if (value.maxCopiesInHand !== undefined) {
          console.log(`  🎯 Explicitly setting maxCopiesInHand to ${value.maxCopiesInHand}`);
          updatedCombo.cards[cardIndex].maxCopiesInHand = value.maxCopiesInHand;
        }

        console.log('  ✅ Card state after starterCard update:', {
          starterCard: updatedCombo.cards[cardIndex].starterCard,
          startersInDeck: updatedCombo.cards[cardIndex].startersInDeck,
          minCopiesInHand: updatedCombo.cards[cardIndex].minCopiesInHand,
          maxCopiesInHand: updatedCombo.cards[cardIndex].maxCopiesInHand
        });
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
    if (results?.individual?.length > 0) validate();
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
    <div className="min-h-screen p-4" style={{ backgroundColor: 'var(--bg-main)', fontFamily: 'Geist, sans-serif' }}>
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
        <Header typography={typography} />

        <div className="p-0" style={{ margin: 0, paddingBottom: '16px' }}>
          <h2 className="mb-4" style={{...typography.h2, color: 'var(--text-main)'}}>Define a Combo</h2>
          
          <DeckConfigInputs
            uploadedYdkFile={uploadedYdkFile}
            setUploadedYdkFile={setUploadedYdkFile}
            ydkCards={ydkCards}
            setYdkCards={setYdkCards}
            ydkCardCounts={ydkCardCounts}
            setYdkCardCounts={setYdkCardCounts}
            deckSize={deckSize}
            setDeckSize={setDeckSize}
            cardDatabase={cardDatabase}
            staticCardDatabase={staticCardDatabase}
            clearPreviousCalculationData={clearPreviousCalculationData}
            combos={combos}
            setCombos={setCombos}
            showToast={showToast}
            setInitialDeckZones={setInitialDeckZones}
            deckZones={deckZones}
            setDeckZones={setDeckZones}
            handSize={handSize}
            setHandSize={setHandSize}
            errors={errors}
            minHandSize={getHighestMinInHandSum()}
            DeckImageSection={DeckImageSection}
            initialDeckZones={initialDeckZones}
            typography={typography}
          />

          {combos.map((combo, index) => (
            <ComboForm
              key={combo.id}
              combo={combo}
              index={index}
              editingComboId={editingComboId}
              tempComboName={tempComboName}
              handleComboNameChange={handleComboNameChange}
              saveComboName={saveComboName}
              handleComboNameKeyDown={handleComboNameKeyDown}
              startEditingComboName={startEditingComboName}
              removeCombo={removeCombo}
              updateCombo={updateCombo}
              validateAndUpdateCombo={validateAndUpdateCombo}
              removeCard={removeCard}
              addCard={addCard}
              canAddCard={canAddCard}
              errors={errors}
              typography={typography}
              SearchableCardInput={SearchableCardInput}
              cardDatabase={cardDatabase}
              ydkCards={ydkCards}
              ydkCardCounts={ydkCardCounts}
            />
          ))}

          {combos.length < 10 && (
            <div>
              <hr className="my-4" style={{ borderColor: 'var(--border-secondary)', borderTop: '1px solid var(--border-secondary)' }} />
              <div className="flex items-center">
                <Button
                  onClick={addCombo}
                  className="enhanced-button enhanced-button-add"
                >
                  <Icon name="rows-plus-bottom" ariaLabel="Add combo" size={14} className="button-icon" style={{ color: '#141414' }} />
                  <span className="button-text">Add combo</span>
                </Button>
                <Tooltip text="Test multiple combo lines to see your deck's overall consistency options" />
              </div>
            </div>
          )}

          <div className="flex space-x-4 mt-6">
            <Button
              onClick={runCalculation}
              disabled={!allFieldsFilled || hasValidationErrors}
              className="enhanced-button"
            >
              <Icon name="calculator" ariaLabel="Calculate" size={14} className="button-icon" style={{ color: '#141414' }} />
              <span className="button-text">Calculate</span>
            </Button>
            <Button
              onClick={handleReset}
              className="enhanced-button enhanced-button-reset"
            >
              <Icon name="arrow-counter-clockwise" ariaLabel="Reset" size={14} className="button-icon" style={{ color: '#141414' }} />
              <span className="button-text">Reset</span>
            </Button>
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
          <h2 className="mb-3" style={typography.h2}>Understanding Your Probability Results</h2>
          
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

        <Footer typography={typography} />

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