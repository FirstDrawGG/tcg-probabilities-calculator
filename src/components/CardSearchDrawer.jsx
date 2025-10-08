import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import { Button } from './ui';

const CardSearchDrawer = ({ isOpen, onClose, onCardSelect, addCardToDeckZone, deckZones, typography }) => {
  // State for search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [error, setError] = useState('');
  const [slowConnectionWarning, setSlowConnectionWarning] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [fuzzyMatchMessage, setFuzzyMatchMessage] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const closeTimeoutRef = useRef(null);

  // Performance optimizations - search cache
  const searchCacheRef = useRef(new Map());
  const maxCacheSize = 50;

  // Refs
  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Auto-focus search on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Cache management utilities
  const getCacheKey = (query) => {
    return query.toLowerCase();
  };

  const getCachedResults = (cacheKey) => {
    return searchCacheRef.current.get(cacheKey);
  };

  const setCachedResults = (cacheKey, results) => {
    const cache = searchCacheRef.current;

    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });
  };

  const isCacheValid = (cachedData) => {
    const cacheTimeout = 5 * 60 * 1000;
    return Date.now() - cachedData.timestamp < cacheTimeout;
  };

  // Calculate relevance score for search results with fuzzy matching
  const calculateRelevanceScore = (card, query) => {
    const cardName = card.name.toLowerCase();
    const cardDesc = (card.desc || '').toLowerCase();
    const cardType = card.type.toLowerCase();

    let score = 0;

    if (cardName === query) {
      score += 1000;
    } else if (cardName.startsWith(query)) {
      score += 800;
    } else if (cardName.includes(query)) {
      score += 600;
    } else {
      const fuzzyScore = calculateFuzzyScore(cardName, query);
      if (fuzzyScore > 0.7) {
        score += 400 + (fuzzyScore * 100);
      }
    }

    if (cardDesc.includes(query)) {
      score += 200;
    }

    if (cardType.includes(query)) {
      score += 100;
    }

    if (cardName.length < 20) {
      score += 50;
    }

    const normalizedQuery = normalizeSearchTerm(query);
    const normalizedName = normalizeSearchTerm(cardName);

    if (normalizedName.includes(normalizedQuery)) {
      score += 300;
    }

    return score;
  };

  const calculateFuzzyScore = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const levenshteinDistance = (str1, str2) => {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  };

  const normalizeSearchTerm = (term) => {
    return term
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const performSearch = async (query, signal) => {
    try {
      const cacheKey = getCacheKey(query);
      const cachedData = getCachedResults(cacheKey);

      if (cachedData && isCacheValid(cachedData)) {
        setSearchResults(cachedData.results);
        setIsSearching(false);
        return;
      }

      const apiUrl = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}&num=50&offset=0`;

      const response = await fetch(apiUrl, {
        signal
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      let results = data.data || [];

      const query_lower = query.toLowerCase();
      const resultsWithScores = results.map(card => ({
        ...card,
        relevanceScore: calculateRelevanceScore(card, query_lower)
      }));

      resultsWithScores.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        return a.name.localeCompare(b.name);
      });

      results = resultsWithScores;

      const hasExactMatches = results.some(card =>
        card.name.toLowerCase().includes(query_lower)
      );

      if (!hasExactMatches && results.length > 0) {
        const bestMatch = results[0];
        if (bestMatch.relevanceScore >= 400 && bestMatch.relevanceScore < 600) {
          const correctedTerm = bestMatch.name;
          setFuzzyMatchMessage(`Showing results for '${correctedTerm}'`);
        }
      } else {
        setFuzzyMatchMessage('');
      }

      results = results.slice(0, 20);
      setCachedResults(cacheKey, results);

      setSearchResults(results);
      setIsSearching(false);

    } catch (err) {
      console.error('Search error:', err);
      if (err.name !== 'AbortError') {
        setError('Unable to search cards. Please try again.');
      }
      setIsSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError('');
    setSlowConnectionWarning(false);

    const controller = new AbortController();
    setAbortController(controller);

    const slowConnectionTimer = setTimeout(() => {
      setSlowConnectionWarning(true);
    }, 2000);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await performSearch(searchQuery, controller.signal);
        clearTimeout(slowConnectionTimer);
        setSlowConnectionWarning(false);
      } catch (err) {
        clearTimeout(slowConnectionTimer);
        setSlowConnectionWarning(false);
        if (err.name !== 'AbortError') {
          setError('Unable to search cards. Please try again.');
        }
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const handleSearchInput = (e) => {
    const value = e.target.value;
    if (value.length <= 50) {
      setSearchQuery(value);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const cancelSearch = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsSearching(false);
    setSlowConnectionWarning(false);
    setError('');
  };

  const openCardModal = (card, index) => {
    setSelectedCard(card);
    setCurrentCardIndex(index);
    setShowCardModal(true);
  };

  const closeCardModal = () => {
    setShowCardModal(false);
    setSelectedCard(null);
  };

  const navigateCard = (direction) => {
    const newIndex = direction === 'next'
      ? Math.min(currentCardIndex + 1, searchResults.length - 1)
      : Math.max(currentCardIndex - 1, 0);

    if (newIndex !== currentCardIndex) {
      const card = searchResults[newIndex];
      setSelectedCard(card);
      setCurrentCardIndex(newIndex);
    }
  };

  // Keyboard navigation for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showCardModal) return;

      switch (e.key) {
        case 'Escape':
          closeCardModal();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          navigateCard('prev');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateCard('next');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCardModal, currentCardIndex, searchResults]);

  if (!isOpen) return null;

  return (
    <div>
      {/* Drawer Container */}
      <div
        className="w-full rounded-lg p-4"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-main)',
        }}
      >
        {/* Search Interface */}
        <div className="mb-4">
          <div className="relative mb-4">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchInput}
              placeholder="Search cards by name"
              className="w-full px-3 border"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: `1px solid var(--border-main)`,
                color: 'var(--text-main)',
                borderRadius: '999px',
                height: '40px',
                cursor: 'text',
                outline: 'none',
                fontSize: 'var(--font-body-size)',
                lineHeight: 'var(--font-body-line-height)',
                fontFamily: 'Geist Regular, sans-serif'
              }}
              onFocus={(e) => {
                e.target.style.border = '1px solid var(--border-action)';
                e.target.style.color = 'var(--text-main)';
              }}
              onBlur={(e) => {
                e.target.style.border = `1px solid var(--border-main)`;
                e.target.style.color = 'var(--text-main)';
              }}
              maxLength={50}
              aria-label="Search Yu-Gi-Oh cards"
              role="searchbox"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:opacity-80"
                aria-label="Clear search"
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            )}
          </div>

          {/* Search hint */}
          {searchQuery.length === 1 && (
            <p
              className="text-sm mb-4"
              style={{...typography.caption, color: 'var(--text-secondary)'}}
              role="status"
              aria-live="polite"
            >
              Type at least 2 characters to search
            </p>
          )}

        </div>

        {/* Loading State */}
        {isSearching && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{borderColor: 'var(--text-main)'}}></div>
              <span style={{...typography.body, color: 'var(--text-main)'}}>
                Searching cards...
              </span>
            </div>

            {slowConnectionWarning && (
              <div className="text-center space-y-3">
                <p style={{...typography.body, color: 'var(--text-secondary)'}}>
                  Taking longer than usual...
                </p>
                <Button
                  onClick={cancelSearch}
                  variant="secondary"
                  size="medium"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg" style={{
            backgroundColor: 'var(--bg-error)',
            color: 'var(--text-error)',
            border: '1px solid var(--border-error)'
          }}>
            <p style={typography.body}>{error}</p>
            <Button
              onClick={() => performSearch(searchQuery)}
              variant="primary"
              size="small"
              style={{marginTop: '8px'}}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Default State */}
        {!searchQuery && searchResults.length === 0 && !isSearching && (
          <div className="text-center py-6">
            <h3 className="mb-2" style={{...typography.h3, color: 'var(--text-main)'}}>
              Search for cards to add to your deck
            </h3>
            <p style={{...typography.body, color: 'var(--text-secondary)'}}>
              Search cards
            </p>
          </div>
        )}

        {/* No Results */}
        {searchQuery && searchResults.length === 0 && !isSearching && !error && (
          <div className="text-center py-12">
            <h3 className="mb-4" style={{...typography.h3, color: 'var(--text-main)'}}>
              No cards found matching your search
            </h3>
            <div className="space-y-2" style={{color: 'var(--text-secondary)'}}>
              <p style={typography.body}>Check your spelling</p>
              <p style={typography.body}>Search for partial card names</p>
            </div>
          </div>
        )}

        {/* AC #4-5: Horizontal Scrollable Search Results */}
        {searchResults.length > 0 && (
          <>
            <div className="mb-4 space-y-2">
              <p style={{...typography.body, color: 'var(--text-secondary)'}}>
                Showing {searchResults.length} results
              </p>
              {fuzzyMatchMessage && (
                <div className="flex items-center gap-2 p-2 rounded" style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-main)'
                }}>
                  <Icon name="info" size={16} />
                  <p style={{...typography.caption, color: 'var(--text-main)'}}>
                    {fuzzyMatchMessage}
                  </p>
                </div>
              )}
            </div>

            {/* Horizontal scrollable container */}
            <div
              className="flex gap-3 overflow-x-auto pb-4"
              style={{
                scrollBehavior: 'smooth',
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--border-main) var(--bg-secondary)'
              }}
            >
              {searchResults.map((card, index) => (
                <div
                  key={card.id}
                  onMouseEnter={(e) => {
                    if (!isDragging) {
                      // Clear any pending close timeout
                      if (closeTimeoutRef.current) {
                        clearTimeout(closeTimeoutRef.current);
                        closeTimeoutRef.current = null;
                      }

                      const rect = e.currentTarget.getBoundingClientRect();
                      const tooltipWidth = 440;
                      const tooltipHeight = 200; // Estimated minimum height
                      const viewportWidth = window.innerWidth;
                      const viewportHeight = window.innerHeight;
                      const margin = 10; // Safety margin from viewport edges

                      // Calculate initial position (centered above card)
                      let x = rect.left + rect.width / 2;
                      let y = rect.top - margin;

                      // Adjust horizontal position if tooltip would overflow
                      const tooltipLeft = x - tooltipWidth / 2;
                      const tooltipRight = x + tooltipWidth / 2;

                      if (tooltipLeft < margin) {
                        // Too far left, align to left edge with margin
                        x = margin + tooltipWidth / 2;
                      } else if (tooltipRight > viewportWidth - margin) {
                        // Too far right, align to right edge with margin
                        x = viewportWidth - margin - tooltipWidth / 2;
                      }

                      // Adjust vertical position if tooltip would overflow
                      const tooltipTop = y - tooltipHeight;

                      if (tooltipTop < margin) {
                        // Not enough space above, show below the card instead
                        y = rect.bottom + margin + tooltipHeight;
                      }

                      // Final check - if still too close to bottom, adjust upward
                      if (y > viewportHeight - margin) {
                        y = viewportHeight - margin;
                      }

                      setTooltipPosition({ x, y });
                      openCardModal(card, index);
                    }
                  }}
                  onMouseLeave={() => {
                    // Immediate close when leaving card area
                    closeTimeoutRef.current = setTimeout(() => {
                      closeCardModal();
                    }, 50); // Very short delay only to allow moving to tooltip
                  }}
                  onClick={(e) => {
                    // On click, add to deck if deck zone function is available
                    if (addCardToDeckZone && !isDragging) {
                      const cardType = card.type.toLowerCase();
                      let targetZone = 'main';

                      if (cardType.includes('fusion') || cardType.includes('synchro') ||
                          cardType.includes('xyz') || cardType.includes('link') ||
                          cardType.includes('pendulum')) {
                        targetZone = 'extra';
                      }

                      addCardToDeckZone(card, targetZone);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (addCardToDeckZone) {
                        const cardType = card.type.toLowerCase();
                        let targetZone = 'main';

                        if (cardType.includes('fusion') || cardType.includes('synchro') ||
                            cardType.includes('xyz') || cardType.includes('link') ||
                            cardType.includes('pendulum')) {
                          targetZone = 'extra';
                        }

                        addCardToDeckZone(card, targetZone);
                      }
                    }
                  }}
                  // AC #10: Drag and drop functionality
                  draggable={!!addCardToDeckZone}
                  onDragStart={(e) => {
                    if (addCardToDeckZone) {
                      setIsDragging(true);
                      e.dataTransfer.setData('application/json', JSON.stringify(card));
                      e.dataTransfer.effectAllowed = 'copy';
                    }
                  }}
                  onDragEnd={(e) => {
                    // Reset dragging state after a short delay to allow the click to be prevented
                    setTimeout(() => setIsDragging(false), 100);
                  }}
                  className="flex-shrink-0 cursor-pointer rounded-lg overflow-hidden hover:transform hover:scale-105 transition-transform"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-main)',
                    width: '60px',
                    cursor: addCardToDeckZone ? 'grab' : 'pointer'
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${card.name}, ${card.type}${card.atk !== undefined ? `, ATK ${card.atk}` : ''}${card.def !== undefined ? `, DEF ${card.def}` : ''}. ${addCardToDeckZone ? 'Drag to deck zone or click to view details' : 'Click to view details'}`}
                >
                  {/* AC #5: Small image size */}
                  <div className="aspect-[2/3] overflow-hidden relative">
                    <img
                      src={card.card_images?.[0]?.image_url_small || card.card_images?.[0]?.image_url || '/placeholder-card.jpg'}
                      alt={card.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      style={{
                        transition: 'opacity 0.3s ease'
                      }}
                      onLoad={(e) => {
                        e.target.style.opacity = '1';
                      }}
                      onError={(e) => {
                        e.target.src = '/placeholder-card.jpg';
                        e.target.style.backgroundColor = 'var(--bg-action-secondary)';
                      }}
                    />
                    {!card.card_images?.[0]?.image_url && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{
                        backgroundColor: 'var(--bg-action-secondary)',
                        color: 'var(--text-secondary)'
                      }}>
                        <div className="text-center">
                          <Icon name="image" size={24} />
                          <p className="text-xs mt-1">{card.name}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Card Detail Tooltip */}
      {showCardModal && selectedCard && (
        <div
          className="fixed z-60 pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)',
            width: '440px'
          }}
        >
          <div
            className="rounded-lg pointer-events-auto"
            style={{
              backgroundColor: 'var(--bg-main)',
              border: '1px solid #ffffff',
              boxShadow: '0 4px 12px rgba(255, 255, 255, 0.2), 0 8px 24px rgba(0, 0, 0, 0.4)',
              padding: '4px'
            }}
            onMouseEnter={() => {
              // Clear any pending close timeout when entering tooltip
              if (closeTimeoutRef.current) {
                clearTimeout(closeTimeoutRef.current);
                closeTimeoutRef.current = null;
              }
            }}
            onMouseLeave={() => {
              // Close immediately when leaving tooltip
              closeCardModal();
            }}
          >
            {/* Tooltip Header */}
            <div className="p-2 border-b" style={{borderColor: 'var(--border-main)'}}>
              <h3 style={{fontSize: 'var(--font-body-size)', lineHeight: 'var(--font-body-line-height)', color: 'var(--text-main)', fontWeight: '600', margin: 0}}>
                {selectedCard.name}
              </h3>
            </div>

            {/* Tooltip Content */}
            <div className="p-2">
              <div className="flex gap-2">
                <div className="flex-shrink-0">
                  <img
                    src={selectedCard.card_images?.[0]?.image_url_small || selectedCard.card_images?.[0]?.image_url || '/placeholder-card.jpg'}
                    alt={selectedCard.name}
                    className="rounded"
                    style={{width: '60px', height: 'auto'}}
                  />
                </div>

                <div className="flex-1 space-y-1">
                  {/* Card stats in compact layout */}
                  <div className="space-y-1">
                    <div>
                      <span style={{fontSize: 'var(--font-body-size)', color: 'var(--text-main)', fontWeight: '600'}}>Type: </span>
                      <span style={{fontSize: 'var(--font-body-size)', color: 'var(--text-secondary)'}}>
                        {(() => {
                          const cardType = selectedCard.type.toLowerCase();
                          if (cardType.includes('monster')) {
                            const monsterTypes = ['fiend', 'fairy', 'beast', 'spellcaster', 'warrior', 'dragon',
                                                 'machine', 'zombie', 'aqua', 'plant', 'insect', 'thunder',
                                                 'rock', 'pyro', 'winged beast', 'dinosaur', 'reptile',
                                                 'fish', 'sea serpent', 'beast-warrior', 'psychic',
                                                 'divine-beast', 'creator god', 'wyrm', 'cyberse'];

                            for (const type of monsterTypes) {
                              if (cardType.includes(type)) {
                                return type.charAt(0).toUpperCase() + type.slice(1);
                              }
                            }
                            return 'Monster';
                          }
                          else if (cardType.includes('spell')) return 'Spell';
                          else if (cardType.includes('trap')) return 'Trap';
                          return selectedCard.type;
                        })()}
                      </span>
                    </div>

                    {selectedCard.attribute && (
                      <div>
                        <span style={{fontSize: 'var(--font-body-size)', color: 'var(--text-main)', fontWeight: '600'}}>Attribute: </span>
                        <span style={{fontSize: 'var(--font-body-size)', color: 'var(--text-secondary)'}}>
                          {selectedCard.attribute}
                        </span>
                      </div>
                    )}

                    {selectedCard.level && (
                      <div>
                        <span style={{fontSize: 'var(--font-body-size)', color: 'var(--text-main)', fontWeight: '600'}}>Level: </span>
                        <span style={{fontSize: 'var(--font-body-size)', color: 'var(--text-secondary)'}}>
                          {selectedCard.level}
                        </span>
                      </div>
                    )}

                    {(selectedCard.atk !== undefined || selectedCard.def !== undefined) && (
                      <div>
                        <span style={{fontSize: 'var(--font-body-size)', color: 'var(--text-main)', fontWeight: '600'}}>ATK/DEF: </span>
                        <span style={{fontSize: 'var(--font-body-size)', color: 'var(--text-secondary)'}}>
                          {selectedCard.atk !== undefined ? selectedCard.atk : '?'} / {selectedCard.def !== undefined ? selectedCard.def : '?'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedCard.desc && (
                <div className="mt-2 pt-2 border-t" style={{borderColor: 'var(--border-main)'}}>
                  <p style={{fontSize: 'var(--font-body-size)', lineHeight: 'var(--font-body-line-height)', color: 'var(--text-secondary)', wordWrap: 'break-word'}}>
                    {selectedCard.desc}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardSearchDrawer;