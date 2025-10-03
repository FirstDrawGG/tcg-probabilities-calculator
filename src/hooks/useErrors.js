import { useState, useCallback } from 'react';

/**
 * Custom hook for managing form validation errors
 * @returns {Object} Error state and handlers
 */
const useErrors = () => {
  const [errors, setErrors] = useState({});

  const setError = useCallback((key, message) => {
    setErrors(prev => ({
      ...prev,
      [key]: message
    }));
  }, []);

  const clearError = useCallback((key) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const hasErrors = useCallback(() => {
    return Object.keys(errors).length > 0;
  }, [errors]);

  return {
    errors,
    setError,
    clearError,
    clearAllErrors,
    hasErrors,
    setErrors // For bulk setting
  };
};

export default useErrors;
