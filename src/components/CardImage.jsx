import React from 'react';

/**
 * Optimized card image component with WebP/JPEG fallback
 * 
 * Features:
 * - WebP with JPEG fallback for browser compatibility
 * - Lazy loading for performance
 * - Multiple size options
 * - Error handling with fallback to YGOPro URLs
 */

const CardImage = ({ 
  cardId, 
  cardName, 
  size = 'small', 
  className = '', 
  style = {},
  onClick = null,
  loading = 'lazy'
}) => {
  // Blob storage configuration
  const BLOB_BASE_URL = 'https://blob.vercel-storage.com'; // Will be updated with actual URL
  const BLOB_ENABLED = process.env.NODE_ENV === 'production';
  
  /**
   * Generate image URLs
   */
  const getImageUrls = () => {
    if (!BLOB_ENABLED) {
      // Fallback to YGOPro URLs for development
      return {
        fallback: `https://images.ygoprodeck.com/images/cards/${cardId}.jpg`
      };
    }
    
    return {
      webp: `${BLOB_BASE_URL}/cards/${size}/${cardId}.webp`,
      jpeg: `${BLOB_BASE_URL}/cards/${size}/${cardId}.jpg`,
      fallback: `https://images.ygoprodeck.com/images/cards/${cardId}.jpg`
    };
  };
  
  const urls = getImageUrls();
  
  /**
   * Handle image loading errors
   */
  const handleError = (event) => {
    // Fallback to YGOPro URL if blob image fails
    if (event.target.src !== urls.fallback) {
      console.warn(`Failed to load optimized image for card ${cardId}, falling back to YGOPro`);
      event.target.src = urls.fallback;
    }
  };
  
  /**
   * Handle source errors in picture element
   */
  const handleSourceError = (event) => {
    // Remove the failed source element
    event.target.remove();
  };
  
  // Common image props
  const imageProps = {
    alt: cardName || `Yu-Gi-Oh card ${cardId}`,
    loading: loading,
    className: className,
    style: style,
    onClick: onClick,
    onError: handleError
  };
  
  // For development or when blob is disabled, use simple img
  if (!BLOB_ENABLED || !urls.webp) {
    return (
      <img
        src={urls.fallback}
        {...imageProps}
      />
    );
  }
  
  // For production with blob storage, use picture element with WebP/JPEG fallback
  return (
    <picture>
      <source 
        srcSet={urls.webp} 
        type="image/webp"
        onError={handleSourceError}
      />
      <source 
        srcSet={urls.jpeg} 
        type="image/jpeg"
        onError={handleSourceError}
      />
      <img
        src={urls.jpeg}
        {...imageProps}
      />
    </picture>
  );
};

export default CardImage;