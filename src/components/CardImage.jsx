import React from 'react';

/**
 * Optimized card image component with WebP from Vercel Blob Storage
 * 
 * Features:
 * - WebP format with YGOPro fallback for compatibility  
 * - Lazy loading for performance
 * - Multiple size options (full, small)
 * - Error handling with fallback to YGOPro URLs
 * - Uses card name for Blob URLs, card ID for fallbacks
 */

const CardImage = ({ 
  cardName, 
  cardId, 
  size = 'small', 
  className = '', 
  style = {},
  onClick = null,
  loading = 'lazy'
}) => {
  // Blob storage configuration - updated to match AC requirements
  const BLOB_BASE_URL = 'https://ws8edzxhvgmmgmdj.public.blob.vercel-storage.com'; // Correct Vercel Blob URL
  const BLOB_ENABLED = true; // Enable blob storage for card images
  
  /**
   * Sanitize card name for URL generation (matches migration script)
   */
  const sanitizeCardName = (name) => {
    if (!name) return '';
    return name
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
  };
  
  /**
   * Generate image URLs using new card name-based structure
   */
  const getImageUrls = () => {
    const fallbackUrl = cardId ? 
      `https://images.ygoprodeck.com/images/cards/${cardId}.jpg` :
      `https://images.ygoprodeck.com/images/cards/small.jpg`;
    
    if (!BLOB_ENABLED || !cardName) {
      return { fallback: fallbackUrl };
    }
    
    const sanitizedName = sanitizeCardName(cardName);
    const suffix = size === 'small' ? '-small' : '';
    
    return {
      webp: `${BLOB_BASE_URL}/cards/${sanitizedName}${suffix}.webp`,
      fallback: fallbackUrl
    };
  };
  
  const urls = getImageUrls();
  
  /**
   * Handle image loading errors - fallback to YGOPro
   */
  const handleError = (event) => {
    if (event.target.src !== urls.fallback) {
      console.warn(`Failed to load blob image for card "${cardName}", falling back to YGOPro`);
      event.target.src = urls.fallback;
    }
  };
  
  // Common image props
  const imageProps = {
    alt: cardName || `Yu-Gi-Oh card ${cardId || 'Unknown'}`,
    loading: loading,
    className: className,
    style: style,
    onClick: onClick,
    onError: handleError,
    title: cardName
  };
  
  // If blob disabled or no WebP URL, use fallback
  if (!BLOB_ENABLED || !urls.webp) {
    return (
      <img
        src={urls.fallback}
        {...imageProps}
      />
    );
  }
  
  // Use WebP with fallback - simpler structure for modern browsers
  return (
    <img
      src={urls.webp}
      {...imageProps}
    />
  );
};

export default CardImage;