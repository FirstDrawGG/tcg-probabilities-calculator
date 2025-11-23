/**
 * CardDatabaseService Tests
 * Test card database fetching, caching, and fallback mechanisms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import CardDatabaseService from './CardDatabaseService.js';

describe('CardDatabaseService', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset fetch mock
    global.fetch = vi.fn();
    // Clear console mocks
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('fetchCards', () => {
    it('should fetch cards from Vercel Blob successfully', async () => {
      const mockCards = [
        { id: 12345, name: 'Blue-Eyes White Dragon', type: 'Normal Monster' },
        { id: 67890, name: 'Dark Magician', type: 'Normal Monster' }
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockCards })
      });

      const cards = await CardDatabaseService.fetchCards();

      expect(cards).toEqual(mockCards);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cardDatabase-full.json')
      );
    });

    it('should fallback to YGOPro API when Blob fetch fails', async () => {
      const mockCards = [
        { id: 12345, name: 'Test Card', type: 'Monster' }
      ];

      // First call (Blob) fails
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      // Second call (YGOPro API) succeeds
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockCards })
      });

      const cards = await CardDatabaseService.fetchCards();

      expect(cards).toEqual(mockCards);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(2,
        'https://db.ygoprodeck.com/api/v7/cardinfo.php'
      );
    });

    it('should return empty array when both Blob and API fail', async () => {
      // Blob fetch fails
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // API fetch also fails
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const cards = await CardDatabaseService.fetchCards();

      expect(cards).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle network errors gracefully', async () => {
      // Blob throws network error
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      // API also throws error
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const cards = await CardDatabaseService.fetchCards();

      expect(cards).toEqual([]);
    });

    it('should handle missing data property in response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}) // No data property
      });

      const cards = await CardDatabaseService.fetchCards();

      expect(cards).toEqual([]);
    });
  });

  describe('Cache Management', () => {
    it('should load valid cached data from localStorage', () => {
      const mockCards = [
        { id: 12345, name: 'Cached Card' }
      ];

      const cacheData = {
        data: mockCards,
        timestamp: Date.now() - (3 * 24 * 60 * 60 * 1000) // 3 days ago
      };

      localStorage.setItem(
        CardDatabaseService.CACHE_KEY,
        JSON.stringify(cacheData)
      );

      const cachedCards = CardDatabaseService.loadFromCache();

      expect(cachedCards).toEqual(mockCards);
    });

    it('should return null when cache is expired (> 7 days)', () => {
      const mockCards = [{ id: 12345, name: 'Old Card' }];

      const cacheData = {
        data: mockCards,
        timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days ago
      };

      localStorage.setItem(
        CardDatabaseService.CACHE_KEY,
        JSON.stringify(cacheData)
      );

      const cachedCards = CardDatabaseService.loadFromCache();

      expect(cachedCards).toBeNull();
      // Cache should be cleared
      expect(localStorage.getItem(CardDatabaseService.CACHE_KEY)).toBeNull();
    });

    it('should return null when cache does not exist', () => {
      const cachedCards = CardDatabaseService.loadFromCache();
      expect(cachedCards).toBeNull();
    });

    it('should handle corrupted cache data gracefully', () => {
      localStorage.setItem(
        CardDatabaseService.CACHE_KEY,
        'invalid json {'
      );

      const cachedCards = CardDatabaseService.loadFromCache();
      expect(cachedCards).toBeNull();
    });

    it('should save cards to cache with timestamp', () => {
      const mockCards = [
        { id: 12345, name: 'Card to Cache' }
      ];

      CardDatabaseService.saveToCache(mockCards);

      const cached = localStorage.getItem(CardDatabaseService.CACHE_KEY);
      expect(cached).toBeTruthy();

      const parsed = JSON.parse(cached);
      expect(parsed.data).toEqual(mockCards);
      expect(parsed.timestamp).toBeGreaterThan(Date.now() - 1000); // Within last second
    });

    it('should handle localStorage quota exceeded error', () => {
      const mockCards = [{ id: 12345, name: 'Card' }];

      // Mock localStorage.setItem to throw quota exceeded error
      const setItemMock = vi.spyOn(Storage.prototype, 'setItem');
      setItemMock.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw, just log error
      expect(() => {
        CardDatabaseService.saveToCache(mockCards);
      }).not.toThrow();

      setItemMock.mockRestore();
    });
  });

  describe('Card Name Sanitization', () => {
    it('should remove special characters from card names', () => {
      const sanitized = CardDatabaseService.sanitizeCardName(
        'Ash Blossom & Joyous Spring'
      );
      expect(sanitized).toBe('ash-blossom-joyous-spring');
    });

    it('should replace spaces with hyphens', () => {
      const sanitized = CardDatabaseService.sanitizeCardName(
        'Blue Eyes White Dragon'
      );
      expect(sanitized).toBe('blue-eyes-white-dragon');
    });

    it('should convert to lowercase', () => {
      const sanitized = CardDatabaseService.sanitizeCardName('DARK MAGICIAN');
      expect(sanitized).toBe('dark-magician');
    });

    it('should handle multiple consecutive spaces', () => {
      const sanitized = CardDatabaseService.sanitizeCardName(
        'Card   With    Spaces'
      );
      expect(sanitized).toBe('card-with-spaces');
    });

    it('should truncate long names to 50 characters', () => {
      const longName = 'A'.repeat(100);
      const sanitized = CardDatabaseService.sanitizeCardName(longName);
      expect(sanitized.length).toBe(50);
    });

    it('should handle card names with slashes and quotes', () => {
      const sanitized = CardDatabaseService.sanitizeCardName(
        `Card "Name" / Test`
      );
      expect(sanitized).toBe('card-name-test');
    });

    it('should handle card names with apostrophes', () => {
      const sanitized = CardDatabaseService.sanitizeCardName(
        "Magician's Rod"
      );
      expect(sanitized).toBe('magicians-rod');
    });

    it('should handle empty strings', () => {
      const sanitized = CardDatabaseService.sanitizeCardName('');
      expect(sanitized).toBe('');
    });
  });

  describe('Image URL Generation', () => {
    it('should generate Blob storage URL for card images', () => {
      const cardName = 'Blue-Eyes White Dragon';

      const imageUrl = CardDatabaseService.getImageUrl(cardName);

      expect(imageUrl).toContain(CardDatabaseService.BLOB_BASE_URL);
      expect(imageUrl).toContain('blue-eyes-white-dragon');
      expect(imageUrl).toContain('/cards/');
      expect(imageUrl.endsWith('.webp')).toBe(true);
    });

    it('should handle card names with special characters in URLs', () => {
      const cardName = 'Ash Blossom & Joyous Spring';

      const imageUrl = CardDatabaseService.getImageUrl(cardName);

      // Should be sanitized in URL
      expect(imageUrl).toContain('ash-blossom-joyous-spring');
      expect(imageUrl).not.toContain('&');
    });

    it('should return empty string for null or empty card name', () => {
      expect(CardDatabaseService.getImageUrl(null)).toBe('');
      expect(CardDatabaseService.getImageUrl('')).toBe('');
    });

    it('should generate image props with correct attributes', () => {
      const cardName = 'Dark Magician';
      const cardId = '12345';

      const props = CardDatabaseService.getImageProps(cardName, cardId);

      expect(props.src).toContain('dark-magician');
      expect(props.alt).toBe('Dark Magician');
      expect(props.loading).toBe('lazy');
    });

    it('should handle missing card name in image props', () => {
      const props = CardDatabaseService.getImageProps(null, '12345');

      expect(props.alt).toBe('Yu-Gi-Oh Card');
    });
  });

  describe('Cache Duration', () => {
    it('should have 7-day cache duration constant', () => {
      const expectedDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      expect(CardDatabaseService.CACHE_DURATION).toBe(expectedDuration);
    });
  });

  describe('Blob Configuration', () => {
    it('should have Blob storage URL configured', () => {
      expect(CardDatabaseService.BLOB_BASE_URL).toBeTruthy();
      expect(CardDatabaseService.BLOB_BASE_URL).toContain('blob.vercel-storage.com');
    });

    it('should have Blob storage enabled by default', () => {
      expect(CardDatabaseService.BLOB_ENABLED).toBe(true);
    });
  });
});
