import { useState } from 'react';

/**
 * Custom hook for managing shareable URL state
 * @returns {Object} URL state
 */
const useShareableUrl = () => {
  const [shareableUrl, setShareableUrl] = useState('');
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);

  return {
    shareableUrl,
    setShareableUrl,
    showCopiedMessage,
    setShowCopiedMessage
  };
};

export default useShareableUrl;
