import React, { useState, useEffect, useRef } from 'react';
import HandTrapService from '../../services/HandTrapService';
import Icon from '../../components/Icon';
import { Button } from '../../components/ui';

const SearchableCardInput = ({ 
  value, 
  onChange, 
  placeholder, 
  errors, 
  comboId, 
  cardIndex, 
  cardDatabase, 
  ydkCards, 
  ydkCardCounts, 
  updateCombo,
  cardId = null // Add cardId to get full card data for hand-trap checking
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCards, setFilteredCards] = useState([]);
  const [isEditing, setIsEditing] = useState(!value);
  const [showTooltip, setShowTooltip] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  
  // Helper function to get full card data for hand-trap checking
  const getCardData = (cardName, cardId) => {
    if (!cardName) return null;
    
    // First try to find in card database by ID
    if (cardId && cardDatabase) {
      const cardById = cardDatabase.find(card => card.id === cardId);
      if (cardById) return cardById;
    }
    
    // Then try by name in card database
    if (cardDatabase) {
      const cardByName = cardDatabase.find(card => 
        card.name && card.name.toLowerCase() === cardName.toLowerCase()
      );
      if (cardByName) return cardByName;
    }
    
    // Finally try YDK cards (though they might not have full data)
    if (ydkCards) {
      const ydkCard = ydkCards.find(card => 
        card.name && card.name.toLowerCase() === cardName.toLowerCase()
      );
      if (ydkCard) return ydkCard;
    }
    
    return null;
  };
  
  // Check if current card is a hand-trap
  const currentCardData = getCardData(value, cardId);
  const isHandTrap = currentCardData ? HandTrapService.isHandTrap(currentCardData) : false;
  
  const typography = {
    body: {
      fontSize: 'var(--font-body-size)',
      lineHeight: 'var(--font-body-line-height)',
      color: 'var(--text-main)',
      fontFamily: 'Geist Regular, sans-serif'
    }
  };
  
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
          className={`enhanced-input w-full ${errors ? 'border-red-500' : ''}`}
        />
      ) : (
        <div 
          className={`w-full px-3 border ${errors ? 'border-red-500' : ''} flex justify-between items-center`}
          style={{ 
            backgroundColor: 'var(--bg-secondary)', 
            border: `1px solid var(--border-main)`,
            color: 'var(--text-main)',
            borderRadius: '8px',
            height: '28px',
            cursor: 'text',
            ...typography.body
          }}
          onClick={(e) => {     
            e.stopPropagation(); 
            handleEdit();        
          }}      
        >
          <div className="flex items-center space-x-2">
            <span>{value}</span>
            {isHandTrap && (
              <div 
                className="relative"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <Icon 
                  name="bomb" 
                  style={{ 
                    fontSize: '14px', 
                    color: 'var(--icon-main)',
                    cursor: 'help'
                  }} 
                  ariaLabel="Hand-trap indicator"
                />
                {showTooltip && (
                  <div 
                    className="absolute z-20 px-2 py-1 text-xs rounded shadow-lg whitespace-nowrap"
                    style={{ 
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-main)',
                      color: 'var(--text-main)',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginTop: '4px'
                    }}
                  >
                    Hand-trap: This card can be activated from your hand during your opponent's turn
                  </div>
                )}
              </div>
            )}
          </div>
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
                        onClick={() => handleCardSelect(card)}
                      >
                        <div className="flex items-center space-x-2">
                          <span>{card.name}</span>
                          {getCardData(card.name, card.id) && HandTrapService.isHandTrap(getCardData(card.name, card.id)) && (
                            <Icon 
                              name="bomb" 
                              style={{ 
                                fontSize: '12px', 
                                color: 'var(--icon-main)'
                              }} 
                              ariaLabel="Hand-trap"
                            />
                          )}
                        </div>
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
                            onClick={() => handleCardSelect(card)}
                          >
                            <div className="flex items-center space-x-2">
                              <span>{card.name}</span>
                              {getCardData(card.name, card.id) && HandTrapService.isHandTrap(getCardData(card.name, card.id)) && (
                                <Icon 
                                  name="bomb" 
                                  style={{ 
                                    fontSize: '12px', 
                                    color: 'var(--icon-main)'
                                  }} 
                                  ariaLabel="Hand-trap"
                                />
                              )}
                            </div>
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
                        onClick={() => handleCardSelect(card)}
                      >
                        <div className="flex items-center space-x-2">
                          <span>{card.name}</span>
                          {getCardData(card.name, card.id) && HandTrapService.isHandTrap(getCardData(card.name, card.id)) && (
                            <Icon 
                              name="bomb" 
                              style={{ 
                                fontSize: '12px', 
                                color: 'var(--icon-main)'
                              }} 
                              ariaLabel="Hand-trap"
                            />
                          )}
                        </div>
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
              <Button
                onClick={handleCustomName}
                variant="secondary"
                size="medium"
                style={{marginTop: '8px'}}
              >
                Use custom name
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableCardInput;