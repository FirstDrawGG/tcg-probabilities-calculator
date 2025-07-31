import { describe, it, expect, beforeEach, vi } from 'vitest';
import YdkParser from './YdkParser.js';

// Mock fetch for testing
global.fetch = vi.fn();

describe('YdkParser', () => {
  beforeEach(() => {
    // Clear any cached database
    YdkParser.cardDatabase = null;
    vi.clearAllMocks();
  });

  describe('Database Loading', () => {
    it('should load card database successfully', async () => {
      const mockDatabase = {
        '12345': { name: 'Blue-Eyes White Dragon', isExtraDeck: false },
        '67890': { name: 'Dark Magician', isExtraDeck: false }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDatabase)
      });

      const database = await YdkParser.loadStaticCardDatabase();
      
      expect(fetch).toHaveBeenCalledWith('/cardDatabase.json');
      expect(database).toEqual(mockDatabase);
      expect(YdkParser.getCardDatabase()).toEqual(mockDatabase);
    });

    it('should handle database loading errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const database = await YdkParser.loadStaticCardDatabase();
      
      expect(database).toEqual({});
      expect(YdkParser.getCardDatabase()).toEqual({});
    });

    it('should handle HTTP errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const database = await YdkParser.loadStaticCardDatabase();
      
      expect(database).toEqual({});
    });
  });

  describe('File Validation', () => {
    it('should validate correct YDK files', () => {
      const validFile = {
        name: 'deck.ydk',
        size: 1024 // 1KB
      };

      expect(() => YdkParser.validateYdkFile(validFile)).not.toThrow();
      expect(YdkParser.validateYdkFile(validFile)).toBe(true);
    });

    it('should reject files that are too large', () => {
      const largeFile = {
        name: 'deck.ydk',
        size: 200 * 1024 // 200KB, over 100KB limit
      };

      expect(() => YdkParser.validateYdkFile(largeFile))
        .toThrow('File size exceeds 100KB limit');
    });

    it('should reject non-YDK files', () => {
      const wrongExtension = {
        name: 'deck.txt',
        size: 1024
      };

      expect(() => YdkParser.validateYdkFile(wrongExtension))
        .toThrow('Only YDK files are supported');
    });

    it('should handle case-insensitive extensions', () => {
      const upperCaseFile = {
        name: 'deck.YDK',
        size: 1024
      };

      expect(() => YdkParser.validateYdkFile(upperCaseFile)).not.toThrow();
    });
  });

  describe('YDK File Parsing', () => {
    const mockDatabase = {
      '12345': { name: 'Blue-Eyes White Dragon', isExtraDeck: false },
      '67890': { name: 'Dark Magician', isExtraDeck: false },
      '11111': { name: 'Blue-Eyes Ultimate Dragon', isExtraDeck: true },
      '22222': { name: 'Polymerization', isExtraDeck: false }
    };

    it('should parse basic YDK file correctly', () => {
      const ydkContent = `#main
12345
12345
12345
67890
67890
22222
#extra
11111
!side`;

      const result = YdkParser.parseYdkFile(ydkContent, mockDatabase);

      expect(result.cards).toHaveLength(6); // 3 Blue-Eyes + 2 Dark Magician + 1 Polymerization
      expect(result.extraDeckCards).toHaveLength(1); // 1 Ultimate Dragon
      expect(result.cardCounts['Blue-Eyes White Dragon']).toBe(3);
      expect(result.cardCounts['Dark Magician']).toBe(2);
      expect(result.cardCounts['Polymerization']).toBe(1);
      expect(result.unmatchedIds).toHaveLength(0);
    });

    it('should handle unmatched card IDs', () => {
      const ydkContent = `#main
12345
99999
67890`;

      const result = YdkParser.parseYdkFile(ydkContent, mockDatabase);

      expect(result.cards).toHaveLength(2); // Only matched cards
      expect(result.unmatchedIds).toContain('99999');
      expect(result.cardCounts['Blue-Eyes White Dragon']).toBe(1);
      expect(result.cardCounts['Dark Magician']).toBe(1);
    });

    it('should ignore side deck cards', () => {
      const ydkContent = `#main
12345
67890
!side
22222
11111`;

      const result = YdkParser.parseYdkFile(ydkContent, mockDatabase);

      expect(result.cards).toHaveLength(2); // Only main deck cards
      expect(result.cardCounts).not.toHaveProperty('Polymerization');
    });

    it('should separate extra deck cards from main deck', () => {
      const ydkContent = `#main
12345
22222
#extra
11111
11111`;

      const result = YdkParser.parseYdkFile(ydkContent, mockDatabase);

      expect(result.cards).toHaveLength(2); // Main deck only
      expect(result.extraDeckCards).toHaveLength(2); // Extra deck cards tracked separately
      expect(result.cardCounts).not.toHaveProperty('Blue-Eyes Ultimate Dragon');
    });

    it('should handle comments and empty lines', () => {
      const ydkContent = `# This is a comment
#main

12345
# Another comment
67890

#extra
11111`;

      const result = YdkParser.parseYdkFile(ydkContent, mockDatabase);

      expect(result.cards).toHaveLength(2);
      expect(result.extraDeckCards).toHaveLength(1);
    });

    it('should handle invalid card IDs gracefully', () => {
      const ydkContent = `#main
12345
invalid
abc123
67890`;

      const result = YdkParser.parseYdkFile(ydkContent, mockDatabase);

      expect(result.cards).toHaveLength(2); // Only valid numeric IDs that exist in DB
      expect(result.cardCounts['Blue-Eyes White Dragon']).toBe(1);
      expect(result.cardCounts['Dark Magician']).toBe(1);
    });

    it('should throw error for completely invalid content', () => {
      expect(() => YdkParser.parseYdkFile(null, mockDatabase))
        .toThrow('Failed to parse YDK file');
    });
  });

  describe('Database Status', () => {
    it('should correctly report database loading status', () => {
      expect(YdkParser.isDatabaseLoaded()).toBe(false);
      
      YdkParser.cardDatabase = { '12345': { name: 'Test Card' } };
      expect(YdkParser.isDatabaseLoaded()).toBe(true);
      
      YdkParser.cardDatabase = {};
      expect(YdkParser.isDatabaseLoaded()).toBe(false);
    });
  });

  describe('Content Parsing', () => {
    it('should parse clipboard content same as file content', () => {
      const mockDatabase = {
        '12345': { name: 'Test Card', isExtraDeck: false }
      };
      
      const content = `#main\n12345\n12345`;
      
      const result1 = YdkParser.parseYdkFile(content, mockDatabase);
      const result2 = YdkParser.parseYdkContent(content, mockDatabase);
      
      expect(result1).toEqual(result2);
    });
  });
});