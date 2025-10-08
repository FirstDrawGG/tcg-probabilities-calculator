import { useState, useCallback } from 'react';
import ProbabilityService from '../services/ProbabilityService';
import TitleGeneratorService from '../services/TitleGeneratorService';

/**
 * Custom hook for managing probability calculations
 * @returns {Object} Calculation state and handlers
 */
const useCalculations = () => {
  const [results, setResults] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculate = useCallback(async (combos, deckSize, handSize) => {
    setIsCalculating(true);

    try {
      // Run calculations
      const calculationResults = ProbabilityService.calculateMultipleCombos(
        combos,
        deckSize,
        handSize
      );

      // Add fun titles
      const resultsWithTitles = {
        individual: calculationResults.individual.map(result => ({
          ...result,
          title: TitleGeneratorService.generateTitle(result.probability)
        })),
        combined: calculationResults.combined ? {
          ...calculationResults.combined,
          title: TitleGeneratorService.generateCombinedTitle(calculationResults.combined)
        } : null
      };

      setResults(resultsWithTitles);
      return resultsWithTitles;
    } catch (error) {
      console.error('Calculation error:', error);
      throw error;
    } finally {
      setIsCalculating(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
  }, []);

  return {
    results,
    setResults,
    isCalculating,
    calculate,
    clearResults
  };
};

export default useCalculations;
