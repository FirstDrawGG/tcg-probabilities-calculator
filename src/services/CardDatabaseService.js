/**
 * CardDatabaseService - Manages Yu-Gi-Oh! card database API calls and local caching
 * Implements 7-day caching strategy to reduce API calls
 * Uses Vercel Blob as primary source with YGOPro API fallback
 */

const CardDatabaseService = {
  CACHE_KEY: 'yugioh_cards_cache',
  CACHE_DURATION: 7 * 24 * 60 * 60 * 1000,

  // Blob storage configuration
  BLOB_BASE_URL: 'https://ws8edzxhvgmmgmdj.public.blob.vercel-storage.com', // Updated with correct Vercel Blob URL
  BLOB_ENABLED: true, // Enable blob storage for card images

  async fetchCards() {
    try {
      // Try Vercel Blob first for faster, more reliable access
      console.log('Fetching cards from Vercel Blob...');
      const blobUrl = `${this.BLOB_BASE_URL}/cardDatabase-full.json`;
      const response = await fetch(blobUrl);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded from Vercel Blob:', data.data ? data.data.length : 0, 'cards');
        return data.data || [];
      }

      // Fallback to YGOPro API if Blob fails
      console.warn('⚠️  Vercel Blob fetch failed, falling back to YGOPro API...');
      throw new Error('Blob fetch failed, trying fallback');

    } catch (error) {
      // Fallback to YGOPro API
      try {
        console.log('📡 Fetching cards from YGOPro API (fallback)...');
        const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php');
        console.log('API response status:', response.status);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Loaded from YGOPro API:', data.data ? data.data.length : 0, 'cards');
        console.log('First card example:', data.data ? data.data[0] : 'No cards');

        return data.data || [];
      } catch (fallbackError) {
        console.error('❌ Both Blob and API fetch failed:', fallbackError);
        return [];
      }
    }
  },

  loadFromCache() {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > this.CACHE_DURATION) {
        localStorage.removeItem(this.CACHE_KEY);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Cache load error:', error);
      return null;
    }
  },

  saveToCache(cards) {
    try {
      const cacheData = {
        data: cards,
        timestamp: Date.now()
      };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Cache save error:', error);
    }
  },

  /**
   * Sanitize card name for URL generation (matches migration script)
   * @param {string} cardName - The card name
   * @returns {string} Sanitized card name
   */
  sanitizeCardName(cardName) {
    const result = cardName
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
    console.log(`Sanitized "${cardName}" -> "${result}"`);
    return result;
  },

  /**
   * Generate optimized image URL for a card using new structure
   * @param {string} cardName - The card name
   * @param {string} size - Image size ('full' or 'small')
   * @returns {string} The optimized image URL
   */
  getImageUrl(cardName, size = 'small') {
    if (!cardName) {
      console.log('❌ No card name provided for image URL generation');
      return '';
    }

    const sanitizedName = this.sanitizeCardName(cardName);
    // Always use full-size images from cards/ directory - no need for separate small images
    const url = `${this.BLOB_BASE_URL}/cards/${sanitizedName}.webp`;
    console.log(`🔗 Generated Vercel Blob URL for "${cardName}":`, url);
    return url;
  },

  /**
   * Generate image props for WebP with YGOPro fallback
   * @param {string} cardName - The card name
   * @param {string} cardId - The card ID (for fallback)
   * @param {string} size - Image size ('full' or 'small')
   * @returns {object} Props for HTML img element with WebP support
   */
  getImageProps(cardName, cardId, size = 'small') {
    const webpUrl = this.getImageUrl(cardName, size);

    return {
      src: webpUrl,
      alt: cardName || 'Yu-Gi-Oh Card',
      loading: 'lazy'
    };
  }
};

export default CardDatabaseService;
