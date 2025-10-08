import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import { Button } from './ui';

const CardSearchModal = ({ isOpen, onClose, onCardSelect }) => {
  // State for search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [error, setError] = useState('');
  const [slowConnectionWarning, setSlowConnectionWarning] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [fuzzyMatchMessage, setFuzzyMatchMessage] = useState('');

  // Performance optimizations - search cache
  const searchCacheRef = useRef(new Map());
  const maxCacheSize = 50;

  // Refs
  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Typography from original app
  const typography = {
    h1: { fontSize: 'var(--font-h1-size)', lineHeight: 'var(--font-h1-line-height)', fontFamily: 'Geist, sans-serif' },
    h2: { fontSize: 'var(--font-h2-size)', lineHeight: 'var(--font-h2-line-height)', fontFamily: 'Geist, sans-serif' },
    h3: { fontSize: 'var(--font-h3-size)', lineHeight: 'var(--font-h3-line-height)', fontFamily: 'Geist, sans-serif' },
    body: { fontSize: 'var(--font-body-size)', lineHeight: 'var(--font-body-line-height)', fontFamily: 'Geist, sans-serif' },
    caption: { fontSize: 'var(--font-caption-size)', lineHeight: 'var(--font-caption-line-height)', fontFamily: 'Geist, sans-serif' }
  };

  // Auto-focus search on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

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

  // Handle main modal close
  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setError('');
    setFuzzyMatchMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{backgroundColor: 'rgba(0,0,0,0.8)'}}>
      <div
        className="relative w-full max-h-[90vh] overflow-auto rounded-lg"
        style={{
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--border-main)',
          maxWidth: '520px'
        }}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b" style={{borderColor: 'var(--border-main)'}}>
          <h2 style={{...typography.h2, color: 'var(--text-main)'}}>
            Search Cards
          </h2>
          <Button
            onClick={handleClose}
            variant="secondary"
            size="small"
            style={{padding: '8px'}}
            aria-label="Close search"
          >
            <Icon name="x-square" size={16} style={{color: 'white'}} />
          </Button>
        </div>

        {/* Search Interface */}
        <div className="p-6">
          <div className="mb-6">
            <div className="relative mb-4">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchInput}
                placeholder="Search cards by name"
                className="w-full px-4 py-3 pr-10 border rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                  fontSize: '16px',
                  height: '48px'
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
            <div className="text-center py-12">
              <div className="mb-4" style={{color: 'var(--text-secondary)'}}>
                <Icon name="magnifying-glass" size={48} />
              </div>
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

          {/* Search Results Grid */}
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
              <div className="card-grid">
                {searchResults.map((card, index) => (
                  <div
                    key={card.id}
                    onClick={() => openCardModal(card, index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openCardModal(card, index);
                      }
                    }}
                    className="card-item cursor-pointer rounded-lg overflow-hidden"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-main)'
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${card.name}, ${card.type}${card.atk !== undefined ? `, ATK ${card.atk}` : ''}${card.def !== undefined ? `, DEF ${card.def}` : ''}`}
                  >
                    <div className="aspect-[2/3] overflow-hidden relative">
                      <img
                        src={card.card_images?.[0]?.image_url || '/placeholder-card.jpg'}
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
                    <div className="p-3">
                      <h4
                        className="font-medium mb-1 line-clamp-2"
                        style={{
                          ...typography.body,
                          color: 'var(--text-main)'
                        }}
                      >
                        {card.name}
                      </h4>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 flex items-center justify-center">
                            {card.type.toLowerCase().includes('monster') && (
                              <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#ff6b35'}}></div>
                            )}
                            {card.type.toLowerCase().includes('spell') && (
                              <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#4ecdc4'}}></div>
                            )}
                            {card.type.toLowerCase().includes('trap') && (
                              <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#c44569'}}></div>
                            )}
                          </div>
                          <span className="text-xs px-2 py-1 rounded" style={{
                            backgroundColor: 'var(--bg-action-secondary)',
                            color: 'var(--text-main)'
                          }}>
                            {card.type.split(' ')[0]}
                          </span>
                        </div>
                        {card.atk !== undefined && card.def !== undefined && (
                          <span className="text-xs" style={{color: 'var(--text-secondary)'}}>
                            {card.atk}/{card.def}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Card Detail Modal */}
        {showCardModal && selectedCard && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4"
            style={{backgroundColor: 'rgba(0,0,0,0.9)'}}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeCardModal();
              }
            }}
          >
            <div
              className="relative max-w-4xl w-full max-h-[90vh] overflow-auto rounded-lg"
              style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-main)'
              }}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-4 border-b" style={{borderColor: 'var(--border-main)'}}>
                <h3 style={{...typography.h3, color: 'var(--text-main)'}}>
                  {selectedCard.name}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => navigateCard('prev')}
                    disabled={currentCardIndex === 0}
                    variant="secondary"
                    size="small"
                    style={{padding: '8px'}}
                  >
                    <Icon name="arrow-left" size={16} />
                  </Button>
                  <span style={{...typography.caption, color: 'var(--text-secondary)'}}>
                    {currentCardIndex + 1} of {searchResults.length}
                  </span>
                  <Button
                    onClick={() => navigateCard('next')}
                    disabled={currentCardIndex === searchResults.length - 1}
                    variant="secondary"
                    size="small"
                    style={{padding: '8px'}}
                  >
                    <Icon name="arrow-right" size={16} />
                  </Button>
                  <Button
                    onClick={closeCardModal}
                    variant="secondary"
                    size="small"
                    style={{padding: '8px'}}
                  >
                    <Icon name="x" size={16} />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="flex justify-center">
                    <img
                      src={selectedCard.card_images?.[0]?.image_url || '/placeholder-card.jpg'}
                      alt={selectedCard.name}
                      className="max-w-full h-auto rounded-lg"
                      style={{maxHeight: '500px'}}
                    />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="mb-2" style={{...typography.body, color: 'var(--text-main)', fontWeight: '600'}}>
                        Card Type
                      </h4>
                      <p style={{...typography.body, color: 'var(--text-secondary)'}}>
                        {selectedCard.type}
                      </p>
                    </div>

                    {selectedCard.attribute && (
                      <div>
                        <h4 className="mb-2" style={{...typography.body, color: 'var(--text-main)', fontWeight: '600'}}>
                          Attribute
                        </h4>
                        <p style={{...typography.body, color: 'var(--text-secondary)'}}>
                          {selectedCard.attribute}
                        </p>
                      </div>
                    )}

                    {selectedCard.level && (
                      <div>
                        <h4 className="mb-2" style={{...typography.body, color: 'var(--text-main)', fontWeight: '600'}}>
                          Level
                        </h4>
                        <p style={{...typography.body, color: 'var(--text-secondary)'}}>
                          {selectedCard.level}
                        </p>
                      </div>
                    )}

                    {(selectedCard.atk !== undefined || selectedCard.def !== undefined) && (
                      <div>
                        <h4 className="mb-2" style={{...typography.body, color: 'var(--text-main)', fontWeight: '600'}}>
                          ATK/DEF
                        </h4>
                        <p style={{...typography.body, color: 'var(--text-secondary)'}}>
                          {selectedCard.atk !== undefined ? selectedCard.atk : '?'} / {selectedCard.def !== undefined ? selectedCard.def : '?'}
                        </p>
                      </div>
                    )}

                    {selectedCard.desc && (
                      <div>
                        <h4 className="mb-2" style={{...typography.body, color: 'var(--text-main)', fontWeight: '600'}}>
                          Effect
                        </h4>
                        <p style={{...typography.body, color: 'var(--text-secondary)', lineHeight: '1.6'}}>
                          {selectedCard.desc}
                        </p>
                      </div>
                    )}

                    <div className="pt-4 border-t" style={{borderColor: 'var(--border-main)'}}>
                      <Button
                        onClick={() => {
                          onCardSelect(selectedCard);
                          closeCardModal();
                          handleClose();
                        }}
                        variant="primary"
                        size="medium"
                        style={{width: '100%'}}
                      >
                        Select Card
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardSearchModal;