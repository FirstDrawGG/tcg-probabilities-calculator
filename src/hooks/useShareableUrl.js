import { useState, useEffect, useCallback } from 'react';
import URLService from '../services/URLService';

/**
 * Custom hook for managing shareable URLs
 * @param {Function} onLoadFromUrl - Callback when loading state from URL
 * @returns {Object} URL state and handlers
 */
const useShareableUrl = (onLoadFromUrl) => {
  const [shareableUrl, setShareableUrl] = useState('');
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);

  // Load from URL on mount
  useEffect(() => {
    if (URLService.hasHash()) {
      const hash = URLService.getCurrentHash();
      const data = URLService.decodeFromHash(hash);

      if (data && onLoadFromUrl) {
        onLoadFromUrl(data);
      }
    }
  }, [onLoadFromUrl]);

  const generateShareableUrl = useCallback((combos, deckSize, handSize) => {
    const hash = URLService.encodeToHash(combos, deckSize, handSize);
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    setShareableUrl(url);
    return url;
  }, []);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setShowCopiedMessage(true);
      setTimeout(() => setShowCopiedMessage(false), 2000);
      return true;
    } catch (error) {
      console.error('Failed to copy:', error);
      return false;
    }
  }, [shareableUrl]);

  const updateUrl = useCallback((combos, deckSize, handSize) => {
    URLService.updateURL(combos, deckSize, handSize);
  }, []);

  return {
    shareableUrl,
    showCopiedMessage,
    generateShareableUrl,
    copyToClipboard,
    updateUrl
  };
};

export default useShareableUrl;
