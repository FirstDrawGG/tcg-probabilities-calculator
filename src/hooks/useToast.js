import { useState, useCallback } from 'react';

/**
 * Custom hook for managing toast notifications
 * @returns {Object} Toast state and handlers
 */
const useToast = () => {
  const [toastMessage, setToastMessage] = useState('');

  const showToast = useCallback((message) => {
    setToastMessage(message);
    // Toast component handles auto-dismiss, so we just set the message
  }, []);

  const hideToast = useCallback(() => {
    setToastMessage('');
  }, []);

  return {
    toastMessage,
    showToast,
    hideToast
  };
};

export default useToast;
