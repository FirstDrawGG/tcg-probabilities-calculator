import React, { useState, useEffect, useRef, useMemo } from 'react';
import Icon from './Icon';

const CardSearchDrawer = ({ isOpen, onClose, onCardSelect, addCardToDeckZone, deckZones, typography }) => {
  // State for search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
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

  // Filter state
  const [filters, setFilters] = useState({
    cardType: [],
    monsterSubType: [],
    attribute: [],
    level: [],
    sets: [],
    archetype: []
  });

  // Refs
  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Auto-focus search on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Cache management utilities
  const getCacheKey = (query, filters) => {
    return JSON.stringify({ query: query.toLowerCase(), filters });
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

  const applyFiltersToResults = (results, activeFilters) => {
    if (activeFilters.cardType.length > 0) {
      results = results.filter(card =>
        activeFilters.cardType.some(type => card.type.toLowerCase().includes(type.toLowerCase()))
      );
    }

    if (activeFilters.monsterSubType.length > 0) {
      results = results.filter(card =>
        activeFilters.monsterSubType.some(subType => card.type.toLowerCase().includes(subType.toLowerCase()))
      );
    }

    if (activeFilters.attribute.length > 0) {
      results = results.filter(card =>
        card.attribute && activeFilters.attribute.includes(card.attribute)
      );
    }

    if (activeFilters.level.length > 0) {
      results = results.filter(card =>
        card.level && activeFilters.level.includes(card.level)
      );
    }

    return results;
  };

  const performSearch = async (query, activeFilters, signal) => {
    try {
      const cacheKey = getCacheKey(query, activeFilters);
      const cachedData = getCachedResults(cacheKey);

      if (cachedData && isCacheValid(cachedData)) {
        setSearchResults(cachedData.results);
        setIsSearching(false);
        return;
      }

      // Build API URL - if no query but filters are active, get all cards; otherwise search by name
      const apiUrl = query.trim()
        ? `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}&num=50&offset=0`
        : `https://db.ygoprodeck.com/api/v7/cardinfo.php?num=50&offset=0`;

      const response = await fetch(apiUrl, {
        signal
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      let results = data.data || [];

      results = applyFiltersToResults(results, activeFilters);

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

    const hasActiveFilters = getActiveFilterCount() > 0;

    if (searchQuery.length < 2 && !hasActiveFilters) {
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
        await performSearch(searchQuery, filters, controller.signal);
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
  }, [searchQuery, filters]);

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

  const handleFilterChange = (filterType, value, checked) => {
    const newFilters = {
      ...filters,
      [filterType]: checked
        ? [...filters[filterType], value]
        : filters[filterType].filter(item => item !== value)
    };

    setFilters(newFilters);
  };

  const clearAllFilters = () => {
    setFilters({
      cardType: [],
      monsterSubType: [],
      attribute: [],
      level: [],
      sets: [],
      archetype: []
    });
  };

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).reduce((count, filterArray) => count + filterArray.length, 0);
  }, [filters]);

  const getActiveFilterCount = () => activeFilterCount;

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
              placeholder="Search cards by name or text..."
              className="w-full px-4 py-3 pr-10 border rounded-lg"
              style={{
                backgroundColor: 'var(--bg-input)',
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

          {/* AC #6: Ghost text filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-0 py-2 hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              ...typography.body
            }}
            aria-expanded={showFilters}
            type="button"
          >
            Show filters
            {getActiveFilterCount() > 0 && (
              <span
                className="ml-2 px-2 py-1 rounded-full text-xs"
                style={{
                  backgroundColor: 'var(--bg-action-primary)',
                  color: 'white'
                }}
                aria-label={`${getActiveFilterCount()} filter${getActiveFilterCount() > 1 ? 's' : ''} active`}
              >
                {getActiveFilterCount()}
              </span>
            )}
          </button>
        </div>

        {/* AC #7-8: Filter Panel */}
        {showFilters && (
          <div
            className="mb-6 p-4 rounded-lg"
            style={{
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-main)'
            }}
            role="region"
            aria-label="Card search filters"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 style={{...typography.h3, color: 'var(--text-main)'}}>Filters</h3>
              {getActiveFilterCount() > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-sm hover:opacity-80 transition-opacity"
                  style={{color: 'var(--text-secondary)'}}
                >
                  Clear All Filters ({getActiveFilterCount()})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card Type Filter */}
              <div>
                <h4 className="mb-3" style={{...typography.body, color: 'var(--text-main)', fontWeight: '600'}}>
                  Card Type
                </h4>
                <div className="flex flex-wrap gap-4">
                  {['Monster', 'Spell', 'Trap'].map(type => (
                    <label key={type} className="flex items-center cursor-pointer hover:opacity-80" style={{width: '80px'}}>
                      <input
                        type="checkbox"
                        checked={filters.cardType.includes(type)}
                        onChange={(e) => handleFilterChange('cardType', type, e.target.checked)}
                        className="mr-2"
                        style={{accentColor: 'var(--bg-action-primary)'}}
                      />
                      <span style={{...typography.body, color: 'var(--text-main)'}}>{type}</span>
                    </label>
                  ))}
                </div>

                {/* Monster Sub-types */}
                {filters.cardType.includes('Monster') && (
                  <div className="mt-4 pl-4 border-l-2" style={{borderColor: 'var(--border-secondary)'}}>
                    <h5 className="mb-2" style={{...typography.caption, color: 'var(--text-secondary)', fontWeight: '600'}}>
                      Monster Sub-types
                    </h5>
                    <div className="flex flex-wrap gap-4">
                      {['Normal', 'Effect', 'Fusion', 'Ritual', 'Synchro', 'Xyz', 'Pendulum', 'Link', 'Token', 'Tuner', 'Flip', 'Toon', 'Spirit', 'Union', 'Gemini'].map(subType => (
                        <label key={subType} className="flex items-center cursor-pointer hover:opacity-80" style={{width: '80px'}}>
                          <input
                            type="checkbox"
                            checked={filters.monsterSubType.includes(subType)}
                            onChange={(e) => handleFilterChange('monsterSubType', subType, e.target.checked)}
                            className="mr-2"
                            style={{accentColor: 'var(--bg-action-primary)'}}
                          />
                          <span style={{...typography.caption, color: 'var(--text-secondary)'}}>{subType}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Attribute Filter */}
              <div>
                <h4 className="mb-3" style={{...typography.body, color: 'var(--text-main)', fontWeight: '600'}}>
                  Attribute
                </h4>
                <div className="flex flex-wrap gap-4">
                  {['DARK', 'LIGHT', 'EARTH', 'WIND', 'WATER', 'FIRE', 'DIVINE'].map(attr => (
                    <label key={attr} className="flex items-center cursor-pointer hover:opacity-80" style={{width: '80px'}}>
                      <input
                        type="checkbox"
                        checked={filters.attribute.includes(attr)}
                        onChange={(e) => handleFilterChange('attribute', attr, e.target.checked)}
                        className="mr-2"
                        style={{accentColor: 'var(--bg-action-primary)'}}
                      />
                      <span style={{...typography.body, color: 'var(--text-main)'}}>{attr}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Level Filter */}
              <div>
                <h4 className="mb-3" style={{...typography.body, color: 'var(--text-main)', fontWeight: '600'}}>
                  Level/Rank
                </h4>
                <div className="flex flex-wrap gap-4">
                  {Array.from({length: 12}, (_, i) => i + 1).map(level => (
                    <label key={level} className="flex items-center cursor-pointer hover:opacity-80" style={{width: '40px'}}>
                      <input
                        type="checkbox"
                        checked={filters.level.includes(level)}
                        onChange={(e) => handleFilterChange('level', level, e.target.checked)}
                        className="mr-1"
                        style={{accentColor: 'var(--bg-action-primary)'}}
                      />
                      <span style={{...typography.caption, color: 'var(--text-main)'}}>{level}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

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
                <button
                  onClick={cancelSearch}
                  className="px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-main)',
                    color: 'var(--text-main)'
                  }}
                >
                  Cancel
                </button>
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
            <button
              onClick={() => performSearch(searchQuery, filters)}
              className="mt-2 px-3 py-1 rounded hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: 'var(--bg-action-primary)',
                color: 'white'
              }}
            >
              Retry
            </button>
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
              Search by card name, type, or any text that appears on the card
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
              <p style={typography.body}>Try removing some filters</p>
              <p style={typography.body}>Check your spelling</p>
              <p style={typography.body}>Search for partial card names</p>
            </div>
            {getActiveFilterCount() > 0 && (
              <button
                onClick={clearAllFilters}
                className="mt-4 px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: 'var(--bg-action-primary)',
                  color: 'white'
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* AC #4-5: Horizontal Scrollable Search Results */}
        {searchResults.length > 0 && (
          <>
            <div className="mb-4 space-y-2">
              <p style={{...typography.body, color: 'var(--text-secondary)'}}>
                Showing {searchResults.length} results
                {getActiveFilterCount() > 0 && ` with ${getActiveFilterCount()} filter${getActiveFilterCount() > 1 ? 's' : ''} applied`}
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
                  onClick={(e) => {
                    // Prevent opening modal if we just finished dragging
                    if (!isDragging) {
                      openCardModal(card, index);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openCardModal(card, index);
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
                    width: '120px',
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
                  <div className="p-2">
                    <h4
                      className="font-medium mb-1 line-clamp-2 text-xs"
                      style={{
                        ...typography.caption,
                        color: 'var(--text-main)'
                      }}
                      title={card.name}
                    >
                      {card.name}
                    </h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 flex items-center justify-center">
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
                        <span className="text-xs px-1 py-1 rounded" style={{
                          backgroundColor: 'var(--bg-action-secondary)',
                          color: 'var(--text-main)',
                          fontSize: '10px'
                        }}>
                          {card.type.split(' ')[0]}
                        </span>
                      </div>
                      {card.atk !== undefined && card.def !== undefined && (
                        <span className="text-xs" style={{color: 'var(--text-secondary)', fontSize: '10px'}}>
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

      {/* Card Detail Modal - same as original */}
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
                <button
                  onClick={() => navigateCard('prev')}
                  disabled={currentCardIndex === 0}
                  className="p-2 rounded hover:opacity-80 transition-opacity disabled:opacity-30"
                  style={{backgroundColor: 'var(--bg-secondary)'}}
                >
                  <Icon name="arrow-left" size={16} />
                </button>
                <span style={{...typography.caption, color: 'var(--text-secondary)'}}>
                  {currentCardIndex + 1} of {searchResults.length}
                </span>
                <button
                  onClick={() => navigateCard('next')}
                  disabled={currentCardIndex === searchResults.length - 1}
                  className="p-2 rounded hover:opacity-80 transition-opacity disabled:opacity-30"
                  style={{backgroundColor: 'var(--bg-secondary)'}}
                >
                  <Icon name="arrow-right" size={16} />
                </button>
                <button
                  onClick={closeCardModal}
                  className="p-2 rounded hover:opacity-80 transition-opacity"
                  style={{backgroundColor: 'var(--bg-secondary)'}}
                >
                  <Icon name="x" size={16} />
                </button>
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
                    {/* AC #10: Quick add buttons for deck zones */}
                    {addCardToDeckZone ? (
                      <div className="space-y-2">
                        <p style={{...typography.caption, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '12px'}}>
                          Add to deck:
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => {
                              addCardToDeckZone(selectedCard, 'main');
                              closeCardModal();
                            }}
                            className="px-3 py-2 rounded-lg hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor: 'var(--bg-action-primary)',
                              color: 'var(--text-action)',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            Main Deck
                          </button>
                          <button
                            onClick={() => {
                              addCardToDeckZone(selectedCard, 'extra');
                              closeCardModal();
                            }}
                            className="px-3 py-2 rounded-lg hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-main)',
                              border: '1px solid var(--border-main)',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            Extra Deck
                          </button>
                          <button
                            onClick={() => {
                              addCardToDeckZone(selectedCard, 'side');
                              closeCardModal();
                            }}
                            className="px-3 py-2 rounded-lg hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-main)',
                              border: '1px solid var(--border-main)',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            Side Deck
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          onCardSelect(selectedCard);
                          closeCardModal();
                        }}
                        className="w-full px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
                        style={{
                          backgroundColor: 'var(--bg-action-primary)',
                          color: 'var(--text-action)',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}
                      >
                        Select Card
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardSearchDrawer;