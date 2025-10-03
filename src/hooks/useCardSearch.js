import { useState } from 'react';

/**
 * Custom hook for managing card database state
 * @returns {Object} Card database state
 */
const useCardSearch = () => {
  const [cardDatabase, setCardDatabase] = useState({});

  return {
    cardDatabase,
    setCardDatabase
  };
};

export default useCardSearch;
