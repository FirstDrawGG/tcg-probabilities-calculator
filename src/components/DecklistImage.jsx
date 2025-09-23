import React, { useState, useEffect, useRef } from 'react';
import CardImage from './CardImage';

const DecklistImage = ({
  ydkCards,
  ydkCardCounts,
  uploadedYdkFile,
  cardDatabase,
  typography,
  combos = [],
  setCombos,
  showToast,
  deckZones
}) => {
  // State for interactive combo assignment
  const [selectedCard, setSelectedCard] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayPosition, setOverlayPosition] = useState({ x: 0, y: 0 });
  const [comboLogicSelections, setComboLogicSelections] = useState({});
  const overlayRef = useRef(null);

  // AC #8: Close overlay and save changes
  const closeOverlay = () => {
    setOverlayVisible(false);
    setSelectedCard(null);
    setComboLogicSelections({});
    if (showToast) {
      showToast('Changes applied');
    }
  };

  // AC #8: Handle escape key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && overlayVisible) {
        closeOverlay();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [overlayVisible]);

  // AC #8: Handle click outside overlay
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (overlayRef.current && !overlayRef.current.contains(event.target) && overlayVisible) {
        closeOverlay();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [overlayVisible]);

  // Don't show anything if no deck data is available
  const hasLiveDeckData = deckZones && (deckZones.main.length > 0 || deckZones.extra.length > 0 || deckZones.side.length > 0);
  const hasYdkData = uploadedYdkFile && ydkCards && ydkCards.length > 0;

  if (!hasLiveDeckData && !hasYdkData) {
    return null;
  }

  // Prioritize live deck data from Deck Builder, fallback to YDK parsing
  let deckSections = { main: [], extra: [], side: [] };

  if (hasLiveDeckData) {
    // Use live deck data from Deck Builder (synced state)
    console.log('🔄 DecklistImage: Using live deck data from Deck Builder');
    deckSections = {
      main: deckZones.main.map(card => ({
        name: card.name,
        id: card.cardId || card.id,
        isCustom: card.isCustom || false,
        section: 'main'
      })),
      extra: deckZones.extra.map(card => ({
        name: card.name,
        id: card.cardId || card.id,
        isCustom: card.isCustom || false,
        section: 'extra'
      })),
      side: deckZones.side.map(card => ({
        name: card.name,
        id: card.cardId || card.id,
        isCustom: card.isCustom || false,
        section: 'side'
      }))
    };
  } else {
    // Fallback: Parse YDK file content (for initial load)
    console.log('🔄 DecklistImage: Falling back to YDK file parsing');
    deckSections = { main: [], extra: [], side: [] };

  if (uploadedYdkFile && uploadedYdkFile.content) {
    const lines = uploadedYdkFile.content.split('\n').map(line => line.trim()).filter(line => line);
    let currentSection = 'main';

    // Parse all sections from YDK content
    for (const line of lines) {
      if (line === '#main') {
        currentSection = 'main';
        continue;
      }
      if (line === '#extra') {
        currentSection = 'extra';
        continue;
      }
      if (line === '!side') {
        currentSection = 'side';
        continue;
      }

      if (/^\d+$/.test(line)) {
        const cardId = line;
        // First try to find in cardDatabase using the cardId as key
        const cardData = cardDatabase && cardDatabase[cardId];
        if (cardData) {
          deckSections[currentSection].push({
            name: cardData.name,
            id: cardId,
            isCustom: false,
            section: currentSection
          });
        } else {
          // Fallback: try to find in ydkCards array (for compatibility)
          const card = ydkCards && ydkCards.find(c => c.id?.toString() === cardId);
          if (card) {
            deckSections[currentSection].push({
              name: card.name,
              id: card.id,
              isCustom: card.isCustom || false,
              section: currentSection
            });
          } else {
            // If card not found in either source, create a placeholder
            deckSections[currentSection].push({
              name: `Unknown Card (${cardId})`,
              id: cardId,
              isCustom: true,
              section: currentSection
            });
          }
        }
      }
    }

    // Fallback: if we couldn't parse from content, use ydkCardCounts for main deck only
    if (deckSections.main.length === 0 && ydkCards && ydkCards.length > 0) {
      ydkCards.forEach(card => {
        const count = ydkCardCounts[card.name] || 1;
        for (let i = 0; i < count; i++) {
          deckSections.main.push({
            name: card.name,
            id: card.id,
            isCustom: card.isCustom || false,
            section: 'main'
          });
        }
      });
    }
  }
  }

  // Helper functions for combo management
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
      logicOperator: 'AND'
    }]
  });

  // AC #1: Handle card click
  const handleCardClick = (card, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setSelectedCard(card);
    setOverlayPosition({
      x: rect.right + 10,
      y: rect.top
    });
    
    // Initialize logic selections for all combos
    const initialLogicSelections = {};
    combos.forEach(combo => {
      if (combo && combo.cards) {
        const assignedCard = combo.cards.find(c => 
          c && c.starterCard && c.starterCard.toLowerCase() === card.name.toLowerCase()
        );
        initialLogicSelections[combo.id] = assignedCard?.logicOperator || 'AND';
      } else {
        initialLogicSelections[combo.id] = 'AND';
      }
    });
    setComboLogicSelections(initialLogicSelections);
    
    setOverlayVisible(true);
  };

  // Get combos assigned to a specific card
  const getCardCombos = (cardName) => {
    if (!combos || !Array.isArray(combos) || !cardName) {
      return [];
    }
    return combos
      .map((combo, index) => ({ ...combo, index }))
      .filter(combo => 
        combo && combo.cards && Array.isArray(combo.cards) &&
        combo.cards.some(card => 
          card && card.starterCard && card.starterCard.toLowerCase() === cardName.toLowerCase()
        )
      );
  };

  // AC #6: Add new combo
  const addNewCombo = () => {
    if (combos.length >= 9) return; // AC #7: Max 9 combos
    
    const newId = Math.max(...combos.map(c => c.id), 0) + 1;
    const newCombo = createCombo(newId, combos.length);
    setCombos([...combos, newCombo]);
    return newCombo;
  };

  // Update combo assignment for selected card
  const updateCardComboAssignment = (comboId, minInHand, maxInHand, isAssigned, logicOperator = 'AND') => {
    if (!selectedCard) return;
    
    setCombos(prevCombos => {
      return prevCombos.map(combo => {
        if (combo.id !== comboId) return combo;
        
        const cardCount = ydkCardCounts[selectedCard.name] || 1;
        const validMin = Math.max(0, Math.min(minInHand, cardCount));
        const validMax = Math.max(validMin, Math.min(maxInHand, cardCount));
        
        let updatedCards = [...combo.cards];
        const existingCardIndex = updatedCards.findIndex(card => 
          card.starterCard.toLowerCase() === selectedCard.name.toLowerCase()
        );
        
        if (isAssigned) {
          const cardData = {
            starterCard: selectedCard.name,
            cardId: selectedCard.id,
            isCustom: selectedCard.isCustom || false,
            startersInDeck: cardCount,
            minCopiesInHand: validMin,
            maxCopiesInHand: validMax,
            logicOperator: combo.cards.length > 0 ? logicOperator : 'AND' // First card doesn't need logic
          };
          
          if (existingCardIndex >= 0) {
            updatedCards[existingCardIndex] = cardData;
          } else {
            // Replace empty card or add new one
            const emptyIndex = updatedCards.findIndex(card => !card.starterCard.trim());
            if (emptyIndex >= 0) {
              updatedCards[emptyIndex] = cardData;
            } else {
              updatedCards.push(cardData);
            }
          }
        } else {
          if (existingCardIndex >= 0) {
            updatedCards.splice(existingCardIndex, 1);
            // Add empty card if this was the last one
            if (updatedCards.length === 0) {
              updatedCards.push({
                starterCard: '',
                cardId: null,
                isCustom: false,
                startersInDeck: 3,
                minCopiesInHand: 1,
                maxCopiesInHand: 3,
                logicOperator: 'AND'
              });
            }
          }
        }
        
        return { ...combo, cards: updatedCards };
      });
    });
  };

  // Helper function to group cards into rows
  const groupCardsIntoRows = (cards, cardsPerRow = 10) => {
    const rows = [];
    for (let i = 0; i < cards.length; i += cardsPerRow) {
      rows.push(cards.slice(i, i + cardsPerRow));
    }
    return rows;
  };

  // Group each section into rows
  const mainDeckRows = groupCardsIntoRows(deckSections.main);
  const extraDeckRows = groupCardsIntoRows(deckSections.extra);
  const sideDeckRows = groupCardsIntoRows(deckSections.side);

  // Helper function to render a deck section
  const renderDeckSection = (sectionName, rows, sectionCards) => {
    if (rows.length === 0) return null;

    return (
      <div key={sectionName} className="mb-6">
        {/* Section header */}
        <div className="mb-3">
          <h5 style={{...typography.h3, color: 'var(--text-main)', margin: 0, fontSize: '14px', fontWeight: '600'}}>
            {sectionName} ({sectionCards.length} cards)
          </h5>
        </div>

        {/* Section cards */}
        <div className="space-y-4 w-full">
          {rows.map((row, rowIndex) => (
            <div
              key={`${sectionName}-row-${rowIndex}`}
              className="flex items-center justify-start w-full"
              style={{
                position: 'relative',
                height: '87px',
                overflow: 'visible',
                minWidth: '100%'
              }}
            >
              {row.map((card, cardIndex) => {
                const totalCards = row.length;
                const cardWidth = 60;
                const containerWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 100, 800) : 700;
                const availableWidth = containerWidth - cardWidth;
                const overlapOffset = totalCards > 1 ? Math.max(8, availableWidth / (totalCards - 1)) : 0;
                const leftPosition = cardIndex * Math.min(overlapOffset, cardWidth * 0.8);

                const cardCombos = getCardCombos(card.name);
                const isSelected = selectedCard && selectedCard.name === card.name;

                return (
                  <div
                    key={`${sectionName}-${card.id}-${cardIndex}-${rowIndex}`}
                    style={{
                      position: 'absolute',
                      left: `${leftPosition}px`,
                      zIndex: cardIndex + 1,
                      transition: 'transform 0.2s ease',
                    }}
                    className={`hover:scale-105 hover:z-50 cursor-pointer ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={(e) => handleCardClick(card, e)}
                  >
                    <div style={{ position: 'relative' }}>
                      <CardImage
                        cardName={card.name}
                        cardId={card.id}
                        cardData={{
                          name: card.name,
                          id: card.id,
                          isCustom: card.isCustom,
                          cardName: card.name,
                          cardId: card.id
                        }}
                        size="small"
                      />

                      {/* Combo icons - only show for main deck cards */}
                      {sectionName === 'Main Deck' && cardCombos.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '4px',
                          left: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}>
                          {cardCombos.slice(0, 3).map((combo, iconIndex) => (
                            <div
                              key={combo.id}
                              title={`${combo.name}: Min ${combo.cards.find(c => c.starterCard.toLowerCase() === card.name.toLowerCase())?.minCopiesInHand || 1}, Max ${combo.cards.find(c => c.starterCard.toLowerCase() === card.name.toLowerCase())?.maxCopiesInHand || 1}`}
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: '#007AFF',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'Geist Regular, sans-serif',
                                border: '1px solid white',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                              }}
                            >
                              {combo.index + 1}
                            </div>
                          ))}

                          {cardCombos.length > 3 && (
                            <div
                              title={`Additional combos: ${cardCombos.slice(3).map(c => `${c.index + 1}. ${c.name}`).join(', ')}`}
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: '#666',
                                color: 'white',
                                fontSize: '8px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'Geist Regular, sans-serif',
                                border: '1px solid white',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                              }}
                            >
                              +{cardCombos.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-4">
      {/* Main section header */}
      <div className="mb-3">
        <h4 style={{...typography.h3, color: 'var(--text-main)', margin: 0, fontSize: '16px'}}>
          Decklist image
        </h4>
      </div>

      {/* Render all deck sections */}
      <div className="space-y-6">
        {renderDeckSection('Main Deck', mainDeckRows, deckSections.main)}
        {renderDeckSection('Extra Deck', extraDeckRows, deckSections.extra)}
        {renderDeckSection('Side Deck', sideDeckRows, deckSections.side)}
      </div>

      {/* Total cards summary */}
      <div className="mt-4">
        <p style={{...typography.body, color: 'var(--text-secondary)', fontSize: '12px'}}>
          {deckSections.main.length + deckSections.extra.length + deckSections.side.length} cards total
          ({deckSections.main.length} main, {deckSections.extra.length} extra, {deckSections.side.length} side)
        </p>
      </div>

      {/* AC #2, #3, #4: Add to combo overlay */}
      {overlayVisible && selectedCard && (
        <div
          ref={overlayRef}
          style={{
            position: 'fixed',
            left: `${overlayPosition.x}px`,
            top: `${overlayPosition.y}px`,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-main)',
            borderRadius: '8px',
            padding: '16px',
            minWidth: '300px',
            maxWidth: '400px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}
        >
          <div style={{ marginBottom: '12px' }}>
            <h4 style={{ ...typography.h3, margin: 0, marginBottom: '4px' }}>
              Add to combo
            </h4>
            <p style={{ ...typography.body, color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
              {selectedCard.name} ({ydkCardCounts[selectedCard.name] || 1} copies in deck)
            </p>
          </div>

          {/* List of existing combos */}
          <div style={{ marginBottom: '16px' }}>
            {combos && combos.map(combo => {
              if (!combo || !combo.cards || !selectedCard) {
                return null;
              }
              const assignedCard = combo.cards.find(card => 
                card && card.starterCard && card.starterCard.toLowerCase() === selectedCard.name.toLowerCase()
              );
              const isAssigned = !!assignedCard;
              const cardCount = ydkCardCounts && ydkCardCounts[selectedCard.name] ? ydkCardCounts[selectedCard.name] : 1;
              const minValue = isAssigned && assignedCard ? assignedCard.minCopiesInHand : 1;
              const maxValue = isAssigned && assignedCard ? assignedCard.maxCopiesInHand : Math.min(3, cardCount);

              return (
                <div
                  key={combo.id}
                  className="transition-colors"
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    border: `1px solid ${isAssigned ? 'var(--bg-action)' : 'var(--border-secondary)'}`,
                    backgroundColor: isAssigned ? 'rgba(0, 122, 255, 0.1)' : 'transparent',
                    marginBottom: '8px',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isAssigned) {
                      e.target.style.backgroundColor = 'var(--border-secondary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isAssigned) {
                      e.target.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={(e) => updateCardComboAssignment(combo.id, minValue, maxValue, e.target.checked, comboLogicSelections[combo.id] || 'AND')}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={{ ...typography.body, fontWeight: isAssigned ? 'bold' : 'normal' }}>
                      {combo.name}
                    </span>
                  </div>

                  {isAssigned && (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ ...typography.body, fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Min in hand
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={cardCount}
                          value={minValue}
                          onChange={(e) => {
                            const newMin = parseInt(e.target.value) || 0;
                            const newMax = Math.max(newMin, maxValue);
                            updateCardComboAssignment(combo.id, newMin, newMax, true, comboLogicSelections[combo.id] || 'AND');
                          }}
                          style={{
                            width: '60px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-main)',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-main)',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ ...typography.body, fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Max in hand
                        </label>
                        <input
                          type="number"
                          min={minValue}
                          max={cardCount}
                          value={maxValue}
                          onChange={(e) => {
                            const newMax = parseInt(e.target.value) || minValue;
                            updateCardComboAssignment(combo.id, minValue, newMax, true, comboLogicSelections[combo.id] || 'AND');
                          }}
                          style={{
                            width: '60px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-main)',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-main)',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Logic selector - only show if combo has other cards */}
                  {isAssigned && combo.cards && combo.cards.filter(card => card && card.starterCard && card.starterCard.trim()).length > 1 && (
                    <div style={{ marginTop: '12px' }}>
                      <label style={{ ...typography.body, fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Logic:
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setComboLogicSelections(prev => ({...prev, [combo.id]: 'AND'}));
                            updateCardComboAssignment(combo.id, minValue, maxValue, true, 'AND');
                          }}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-main)',
                            backgroundColor: (comboLogicSelections[combo.id] || 'AND') === 'AND' ? 'var(--bg-action)' : 'var(--bg-input)',
                            color: (comboLogicSelections[combo.id] || 'AND') === 'AND' ? 'var(--text-black)' : 'var(--text-main)',
                            fontSize: '12px',
                            fontFamily: 'Geist Regular, sans-serif',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          AND
                        </button>
                        <button
                          onClick={() => {
                            setComboLogicSelections(prev => ({...prev, [combo.id]: 'OR'}));
                            updateCardComboAssignment(combo.id, minValue, maxValue, true, 'OR');
                          }}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-main)',
                            backgroundColor: (comboLogicSelections[combo.id] || 'AND') === 'OR' ? 'var(--bg-action)' : 'var(--bg-input)',
                            color: (comboLogicSelections[combo.id] || 'AND') === 'OR' ? 'var(--text-black)' : 'var(--text-main)',
                            fontSize: '12px',
                            fontFamily: 'Geist Regular, sans-serif',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          OR
                        </button>
                      </div>
                      <div style={{ ...typography.body, fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {(comboLogicSelections[combo.id] || 'AND') === 'AND' ? 'Need all cards in combo' : 'Need any of these cards'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* AC #6, #7: Add new combo button */}
          <div style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: '12px' }}>
            {combos.length < 9 ? (
              <button
                onClick={() => {
                  const newCombo = addNewCombo();
                  if (newCombo) {
                    // Auto-assign the selected card to the new combo
                    const cardCount = ydkCardCounts[selectedCard.name] || 1;
                    updateCardComboAssignment(newCombo.id, 1, Math.min(3, cardCount), true);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  backgroundColor: 'var(--bg-action)',
                  color: 'var(--text-action)',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'Geist Regular, sans-serif',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
                onMouseOver={(e) => e.target.style.opacity = '0.8'}
                onMouseOut={(e) => e.target.style.opacity = '1'}
              >
                Add new combo
              </button>
            ) : (
              <p style={{
                ...typography.body,
                color: 'var(--text-secondary)',
                fontSize: '14px',
                textAlign: 'center',
                margin: 0,
                fontStyle: 'italic'
              }}>
                Maximum of 9 combos reached
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DecklistImage;