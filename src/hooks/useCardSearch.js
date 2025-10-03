import { useState, useCallback, useEffect } from 'react';
import CardDatabaseService from '../services/CardDatabaseService';

/**
 * Custom hook for card search with debouncing
 * @param {number} debounceMs - Debounce delay in milliseconds
 * @returns {Object} Search state and handlers
 */
const useCardSearch = (debounceMs = 300) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cardDatabase, setCardDatabase] = useState({});

  // Load card database on mount
  useEffect(() => {
    const loadDatabase = async () => {
      try {
        const db = await CardDatabaseService.getDatabase();
        setCardDatabase(db);
      } catch (error) {
        console.error('Failed to load card database:', error);
      }
    };

    loadDatabase();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    const timeoutId = setTimeout(async () => {
      try {
        const results = await CardDatabaseService.searchCards(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, debounceMs]);

  const search = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const getCard = useCallback(async (cardName) => {
    return await CardDatabaseService.getCard(cardName);
  }, []);

  return {
    searchQuery,
    searchResults,
    isSearching,
    cardDatabase,
    search,
    clearSearch,
    getCard
  };
};

export default useCardSearch;
