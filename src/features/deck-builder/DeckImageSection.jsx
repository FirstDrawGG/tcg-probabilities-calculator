import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui';
import DeckZone from './DeckZone';
import DeckStatistics from './DeckStatistics';

const DeckImageSection = ({ typography, cardDatabase, ydkCards, ydkCardCounts, showToast, initialDeckZones, deckZones, setDeckZones, combos, setCombos }) => {
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

  // AC #2-3: State for the "Add to combo" overlay
  const [selectedCard, setSelectedCard] = useState(null);
  const [showComboOverlay, setShowComboOverlay] = useState(false);

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
    // Support both move (existing cards) and copy (new cards from search)
    e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'copy' ? 'copy' : 'move';
  };

  const handleDragLeave = () => {
    setDragOverZone(null);
  };

  const handleDrop = (e, targetZone) => {
    e.preventDefault();
    setDragOverZone(null);

    // AC #10: Check if this is a new card from search drawer
    let cardToHandle = draggedCard;

    if (!cardToHandle) {
      // Try to get card data from dataTransfer (for search drawer drops)
      try {
        const cardData = e.dataTransfer.getData('application/json');
        if (cardData) {
          cardToHandle = JSON.parse(cardData);
          // This is a new card from search, not an existing deck card
          cardToHandle.isNewCard = true;
        }
      } catch (error) {
        console.error('Error parsing dropped card data:', error);
      }
    }

    if (!cardToHandle) return;

    // Validate drop based on card type and zone
    const isExtraDeckMonster = cardToHandle.type?.toLowerCase().includes('fusion') ||
                              cardToHandle.type?.toLowerCase().includes('synchro') ||
                              cardToHandle.type?.toLowerCase().includes('xyz') ||
                              cardToHandle.type?.toLowerCase().includes('link');

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

    // AC #10: Handle both new cards and moving between zones
    if (cardToHandle.isNewCard) {
      // This is a new card from search drawer
      const newCard = {
        id: `${targetZone}_${cardToHandle.id}_${Date.now()}_${Math.random()}`,
        cardId: cardToHandle.id,
        name: cardToHandle.name,
        type: cardToHandle.type || 'Unknown',
        level: cardToHandle.level || null,
        attribute: cardToHandle.attribute || null,
        zone: targetZone
      };

      setDeckZones(prev => ({
        ...prev,
        [targetZone]: [...prev[targetZone], newCard]
      }));

      showToast(`Added ${cardToHandle.name} to ${targetZone === 'main' ? 'Main' : targetZone === 'extra' ? 'Extra' : 'Side'} Deck`);
    } else {
      // Move card between existing zones
      const sourceZone = cardToHandle.zone;
      if (sourceZone === targetZone) return;

      setDeckZones(prev => ({
        ...prev,
        [sourceZone]: prev[sourceZone].filter(c => c.id !== cardToHandle.id),
        [targetZone]: [...prev[targetZone], { ...cardToHandle, zone: targetZone }]
      }));
    }

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

  // AC #2-3: Handle card click to open combo assignment overlay
  // Only allow adding cards from Main Deck to combos (not Extra or Side deck)
  const handleCardClick = (card, event, zone) => {
    // Only show modal for Main Deck cards
    if (zone === 'main') {
      // Always show modal - validation happens inside
      setSelectedCard(card);
      setShowComboOverlay(true);
    }
  };

  // AC #4: Add card to existing combo
  const addCardToCombo = (comboId, card) => {
    setCombos(prevCombos => {
      return prevCombos.map(combo => {
        if (combo.id === comboId) {
          // Check if card already exists in this combo
          const cardExists = combo.cards.some(c =>
            c.starterCard.toLowerCase() === card.name.toLowerCase()
          );

          if (cardExists) {
            showToast(`${card.name} is already in this combo`);
            return combo;
          }

          // Check if there's an empty slot to fill first
          const emptyCardIndex = combo.cards.findIndex(c =>
            !c.starterCard || c.starterCard.trim() === ''
          );

          // Add card to combo
          // Get actual card count from YDK if available
          const actualCardCount = ydkCardCounts && ydkCardCounts[card.name] ? ydkCardCounts[card.name] : 3;

          const newCard = {
            starterCard: card.name,
            cardId: card.cardId || null,
            isCustom: card.isCustom || false,
            startersInDeck: actualCardCount,
            minCopiesInHand: 1,
            maxCopiesInHand: actualCardCount,
            logicOperator: 'AND'
          };

          // If there's an empty slot, replace it; otherwise append
          if (emptyCardIndex !== -1) {
            return {
              ...combo,
              cards: combo.cards.map((c, index) =>
                index === emptyCardIndex ? newCard : c
              )
            };
          } else {
            return {
              ...combo,
              cards: [...combo.cards, newCard]
            };
          }
        }
        return combo;
      });
    });
  };

  // AC #6: Create new combo with card (or populate first empty card slot)
  const createNewComboWithCard = (card) => {
    setCombos(prevCombos => {
      // First, try to find an existing combo with empty card slots
      for (let i = 0; i < prevCombos.length; i++) {
        const combo = prevCombos[i];
        const emptyCardIndex = combo.cards.findIndex(c =>
          !c.starterCard || c.starterCard.trim() === ''
        );

        if (emptyCardIndex !== -1) {
          // Found an empty slot, populate it
          // Get actual card count from YDK if available
          const actualCardCount = ydkCardCounts && ydkCardCounts[card.name] ? ydkCardCounts[card.name] : 3;

          const updatedCombos = [...prevCombos];
          updatedCombos[i] = {
            ...combo,
            cards: combo.cards.map((c, index) => {
              if (index === emptyCardIndex) {
                return {
                  starterCard: card.name,
                  cardId: card.cardId || null,
                  isCustom: card.isCustom || false,
                  startersInDeck: actualCardCount,
                  minCopiesInHand: 1,
                  maxCopiesInHand: actualCardCount,
                  logicOperator: 'AND'
                };
              }
              return c;
            })
          };
          return updatedCombos;
        }
      }

      // No empty slots found, create a new combo
      // Get actual card count from YDK if available
      const actualCardCount = ydkCardCounts && ydkCardCounts[card.name] ? ydkCardCounts[card.name] : 3;

      const newComboId = Math.max(...prevCombos.map(c => c.id)) + 1;
      const newCombo = {
        id: newComboId,
        name: `Combo ${prevCombos.length + 1}`,
        cards: [{
          starterCard: card.name,
          cardId: card.cardId || null,
          isCustom: card.isCustom || false,
          startersInDeck: actualCardCount,
          minCopiesInHand: 1,
          maxCopiesInHand: actualCardCount,
          logicOperator: 'AND'
        }]
      };

      return [...prevCombos, newCombo];
    });
  };

  // AC #7: Remove card from combo
  const removeCardFromCombo = (comboId, card) => {
    setCombos(prevCombos => {
      return prevCombos.map(combo => {
        if (combo.id === comboId) {
          const updatedCards = combo.cards.filter(c =>
            c.starterCard.toLowerCase() !== card.name.toLowerCase()
          );
          return {
            ...combo,
            cards: updatedCards
          };
        }
        return combo;
      });
    });
  };

  // Update logic operator for a card when adding to combo via modal
  const updateCardLogicInCombo = (comboId, cardName, logicOperator) => {
    setCombos(prevCombos => {
      return prevCombos.map(combo => {
        if (combo.id === comboId) {
          const updatedCards = combo.cards.map(c => {
            if (c.starterCard.toLowerCase() === cardName.toLowerCase()) {
              return { ...c, logicOperator };
            }
            return c;
          });
          return {
            ...combo,
            cards: updatedCards
          };
        }
        return combo;
      });
    });
  };

  return (
    <div>
      {/* Visual deck builder mode */}
      <div>
          {/* Deck Zones - Vertical Layout */}
          <div className="space-y-4">
            {/* Main Deck */}
            <div>
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
                borderColor="var(--border-secondary)"
                maxCards={10}
                onCardClick={handleCardClick}
                combos={combos}
                ydkCardCounts={ydkCardCounts}
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
                borderColor="var(--border-secondary)"
                maxCards={10}
                onCardClick={handleCardClick}
                combos={combos}
                ydkCardCounts={ydkCardCounts}
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
                borderColor="var(--border-secondary)"
                maxCards={10}
                onCardClick={handleCardClick}
                combos={combos}
                ydkCardCounts={ydkCardCounts}
              />
            </div>
          </div>

          {/* Statistics Panel */}
          <DeckStatistics statistics={deckStatistics} typography={typography} />
        </div>

      {/* Card Search functionality moved to YdkImporter */}

      {/* AC #2-3: Add to combo overlay */}
      {showComboOverlay && selectedCard && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowComboOverlay(false);
              setSelectedCard(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-main)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '520px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              border: '1px solid var(--border-main)'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 style={{...typography.h3, color: 'var(--text-main)', margin: 0}}>
                Add "{selectedCard.name}" to Combo
              </h3>
              <Button
                onClick={() => {
                  setShowComboOverlay(false);
                  setSelectedCard(null);
                }}
                variant="secondary"
                size="small"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '24px',
                  padding: '4px',
                  lineHeight: 1,
                  height: 'auto'
                }}
              >
                ×
              </Button>
            </div>

            {/* Combo List */}
            <div style={{ marginBottom: '16px' }}>
              {(() => {
                // Check if there are ANY cards in ANY combo
                const hasAnyCards = combos.some(combo =>
                  combo.cards.some(c => c.starterCard && c.starterCard.trim() !== '')
                );

                return (
                  <>
                    <p style={{...typography.body, color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px'}}>
                      {!hasAnyCards
                        ? 'You must add this card to Combo 1 first:'
                        : 'Select which combo to add this card to:'}
                    </p>

              {combos.map((combo, index) => {
                const cardExists = combo.cards.some(c =>
                  c.starterCard.toLowerCase() === selectedCard.name.toLowerCase()
                );

                // Check if this would be the 3rd+ card (requiring AND/OR logic)
                const wouldBeThirdPlusCard = !cardExists && combo.cards.length >= 2;

                // Get current logic operator for this card if it exists
                const existingCard = combo.cards.find(c =>
                  c.starterCard.toLowerCase() === selectedCard.name.toLowerCase()
                );
                const currentLogic = existingCard?.logicOperator || 'AND';

                return (
                  <div
                    key={combo.id}
                    style={{
                      marginBottom: '12px',
                      padding: '12px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-main)',
                      borderRadius: '8px'
                    }}
                  >
                    {/* Main combo button */}
                    <Button
                      onClick={() => {
                        if (cardExists) {
                          // AC #7: Remove card from combo
                          removeCardFromCombo(combo.id, selectedCard);
                          showToast(`Removed ${selectedCard.name} from Combo ${index + 1}`);
                        } else {
                          // AC #4: Add card to selected combo
                          addCardToCombo(combo.id, selectedCard);
                          showToast(`Added ${selectedCard.name} to Combo ${index + 1}`);
                        }
                      }}
                      disabled={!hasAnyCards && index !== 0}
                      variant={cardExists ? "primary" : "secondary"}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px',
                        borderRadius: '8px',
                        ...typography.body
                      }}
                      className="hover:bg-opacity-80 transition-all"
                    >
                      <div style={{ fontWeight: 'medium', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {cardExists ? '✓' : '+'} Combo {index + 1}
                        {cardExists && (
                          <span style={{ fontSize: '10px', opacity: 0.8 }}>
                            (Click to remove)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: cardExists ? 'var(--text-action)' : 'var(--text-secondary)', marginTop: '4px', opacity: 0.8 }}>
                        {combo.cards && combo.cards.length > 0
                          ? `${combo.cards.length} cards: ${combo.cards.slice(0, 2).map(c => c.starterCard).join(', ')}${combo.cards.length > 2 ? '...' : ''}`
                          : 'No cards added yet'
                        }
                      </div>
                    </Button>

                    {/* AND/OR logic selector for existing cards or when adding 3rd+ card */}
                    {(cardExists || wouldBeThirdPlusCard) && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-main)' }}>
                        <label style={{
                          ...typography.body,
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          marginBottom: '4px',
                          display: 'block'
                        }}>
                          Logic for this card:
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cardExists) {
                                updateCardLogicInCombo(combo.id, selectedCard.name, 'AND');
                              }
                            }}
                            disabled={!cardExists}
                            variant={currentLogic === 'AND' ? 'primary' : 'secondary'}
                            size="small"
                            style={{
                              padding: '4px 12px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              height: 'auto',
                              ...typography.body
                            }}
                          >
                            AND
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cardExists) {
                                updateCardLogicInCombo(combo.id, selectedCard.name, 'OR');
                              }
                            }}
                            disabled={!cardExists}
                            variant={currentLogic === 'OR' ? 'primary' : 'secondary'}
                            size="small"
                            style={{
                              padding: '4px 12px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              height: 'auto',
                              ...typography.body
                            }}
                          >
                            OR
                          </Button>
                        </div>
                        {wouldBeThirdPlusCard && !cardExists && (
                          <p style={{
                            ...typography.body,
                            fontSize: '10px',
                            color: 'var(--text-secondary)',
                            marginTop: '4px',
                            fontStyle: 'italic'
                          }}>
                            This will be the 3rd+ card. Logic can be changed after adding.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
                  </>
                );
              })()}
            </div>

            {/* Create New Combo Button */}
            {(() => {
              // Check if there are ANY cards in ANY combo (for button disabling)
              const hasAnyCards = combos.some(combo =>
                combo.cards.some(c => c.starterCard && c.starterCard.trim() !== '')
              );

              return (
                <>
            <Button
              disabled={!hasAnyCards}
              onClick={() => {
                // AC #6: Create new combo with this card (or populate first empty slot)
                createNewComboWithCard(selectedCard);
                showToast(`Added ${selectedCard.name} to combo`);
                setShowComboOverlay(false);
                setSelectedCard(null);
              }}
              variant="primary"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#000000',
                color: '#ffffff',
                border: '1px solid #333',
                ...typography.body,
                fontWeight: 'medium',
                marginBottom: '12px'
              }}
              className="hover:bg-opacity-80 transition-all"
            >
              + New combo
            </Button>

            {/* Save Button (closes modal) */}
            <Button
              disabled={!hasAnyCards}
              onClick={() => {
                setShowComboOverlay(false);
                setSelectedCard(null);
              }}
              variant="primary"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                ...typography.body,
                fontWeight: 'medium'
              }}
              className="hover:bg-opacity-80 transition-all"
            >
              Save
            </Button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckImageSection;
