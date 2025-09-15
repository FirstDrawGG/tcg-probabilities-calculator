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
  cardData,
  size = 'small', 
  className = '', 
  style = {},
  onClick = null,
  loading = 'lazy'
}) => {
  // Support both cardData object and individual props for backward compatibility
  const actualCardName = cardData?.cardName || cardName;
  const actualCardId = cardData?.cardId || cardId;
  const isBlank = !cardData || cardData.type === 'blank' || (!actualCardName && !actualCardId);
  
  // Blob storage configuration - updated to match AC requirements
  const BLOB_BASE_URL = 'https://ws8edzxhvgmmgmdj.public.blob.vercel-storage.com'; // Correct Vercel Blob URL
  const BLOB_ENABLED = true; // Enable blob storage for card images
  const BLANK_CARD_URL = 'https://ws8edzxhvgmmgmdj.public.blob.vercel-storage.com/cards/yugioh_card_back_blank.jpg';
  
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
    const fallbackUrl = actualCardId ? 
      `https://images.ygoprodeck.com/images/cards/${actualCardId}.jpg` :
      `https://images.ygoprodeck.com/images/cards/small.jpg`;
    
    if (!BLOB_ENABLED || !actualCardName) {
      return { fallback: fallbackUrl };
    }
    
    const sanitizedName = sanitizeCardName(actualCardName);
    // Always use full-size images from cards/ directory - no need for separate small images
    
    return {
      webp: `${BLOB_BASE_URL}/cards/${sanitizedName}.webp`,
      fallback: fallbackUrl
    };
  };
  
  const urls = getImageUrls();
  
  /**
   * Handle image loading errors - fallback to YGOPro
   */
  const handleError = (event) => {
    if (event.target.src !== urls.fallback) {
      console.warn(`Failed to load blob image for card "${actualCardName}", falling back to YGOPro`);
      event.target.src = urls.fallback;
    }
  };
  
  // Size constraints based on size prop
  const sizeStyles = {
    width: size === 'small' ? '60px' : '120px',
    height: size === 'small' ? '87px' : '174px',
    objectFit: 'cover',
    borderRadius: '4px'
  };

  // Handle blank cards
  if (isBlank) {
    return (
      <img
        src={BLANK_CARD_URL}
        alt="Yu-Gi-Oh Card Back"
        loading={loading}
        className={className}
        style={{ ...sizeStyles, ...style }}
        onClick={onClick}
        title="Blank Card"
      />
    );
  }

  // Handle custom cards - black and white blank card with name overlay
  if (cardData?.isCustom) {
    return (
      <div
        className={className}
        style={{
          ...sizeStyles,
          position: 'relative',
          overflow: 'hidden',
          ...style
        }}
        onClick={onClick}
      >
        <img
          src={BLANK_CARD_URL}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '4px',
            filter: 'grayscale(100%) brightness(0.7)'
          }}
          alt={`Custom Card: ${actualCardName}`}
          loading={loading}
          title={`Custom Card: ${actualCardName}`}
        />
        {/* Overlay custom card name */}
        <div
          style={{
            position: 'absolute',
            bottom: '2px',
            left: '2px',
            right: '2px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            fontSize: '7px',
            textAlign: 'center',
            padding: '1px 2px',
            borderRadius: '2px',
            maxHeight: '20px',
            overflow: 'hidden'
          }}
        >
          {actualCardName}
        </div>
      </div>
    );
  }

  // Common image props for regular cards
  const imageProps = {
    alt: actualCardName || `Yu-Gi-Oh card ${actualCardId || 'Unknown'}`,
    loading: loading,
    className: className,
    style: { ...sizeStyles, ...style },
    onClick: onClick,
    onError: handleError,
    title: actualCardName
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