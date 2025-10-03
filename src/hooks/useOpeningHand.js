import { useState, useCallback } from 'react';

/**
 * Custom hook for managing opening hand state
 * @returns {Object} Opening hand state and handlers
 */
const useOpeningHand = () => {
  const [openingHand, setOpeningHand] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshOpeningHand = useCallback((generateHandFn) => {
    setIsRefreshing(true);
    const newHand = generateHandFn();
    setOpeningHand(newHand);

    // Reset refreshing state after animation
    setTimeout(() => setIsRefreshing(false), 300);
  }, []);

  const clearOpeningHand = useCallback(() => {
    setOpeningHand([]);
  }, []);

  return {
    openingHand,
    setOpeningHand,
    isRefreshing,
    setIsRefreshing,
    refreshOpeningHand,
    clearOpeningHand
  };
};

export default useOpeningHand;
