/**
 * YdkParser - Service for parsing YDK (Yu-Gi-Oh! Deck) files
 * 
 * This service handles loading card databases and parsing YDK file content
 * to extract card information for probability calculations.
 */

class YdkParser {
  constructor() {
    this.cardDatabase = null;
  }

  /**
   * Loads the static card database from the public directory
   * @returns {Promise<Object>} Card database object
   */
  async loadStaticCardDatabase() {
    try {
      const response = await fetch('/cardDatabase.json');
      if (!response.ok) {
        throw new Error(`Failed to load card database: ${response.status}`);
      }
      const database = await response.json();
      this.cardDatabase = database;
      return database;
    } catch (error) {
      console.error('Failed to load static card database:', error);
      return {};
    }
  }

  /**
   * Parses YDK file content and extracts card information
   * @param {string} fileContent - Raw YDK file content
   * @param {Object} staticCardDatabase - Card database for lookups
   * @returns {Object} Parsed result with cards, counts, and unmatched IDs
   */
  parseYdkFile(fileContent, staticCardDatabase) {
    try {
      const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line);
      const result = {
        cards: [], // Main deck cards for probability calculation
        unmatchedIds: [],
        cardCounts: {}, // Track count of each card by name (main deck only)
        // Deck builder sections
        deckZones: {
          main: [],
          extra: [],
          side: []
        }
      };

      let currentSection = 'main'; // Default to main deck

      for (const line of lines) {
        // Skip comments that start with #
        if (line.startsWith('#')) continue;

        // Track current section
        if (line === '#main') {
          currentSection = 'main';
          continue;
        }
        if (line === '#extra') {
          currentSection = 'extra';
          continue;
        }
        if (line === '!side') {
          currentSection = 'side';
          continue;
        }

        // Parse card ID
        const cardId = line.trim();
        if (!cardId || isNaN(cardId)) continue;

        const cardData = staticCardDatabase[cardId];
        if (cardData) {
          // Determine correct zone based on card type and isExtraDeck property
          let correctZone = currentSection;
          if (cardData.isExtraDeck === true && currentSection === 'main') {
            // Extra deck card found in main deck section - move to extra deck
            correctZone = 'extra';
            console.log(`🔄 Auto-correcting: Moving ${cardData.name} from main to extra deck`);
          } else if (cardData.isExtraDeck === false && currentSection === 'extra') {
            // Main deck card found in extra deck section - move to main deck
            correctZone = 'main';
            console.log(`🔄 Auto-correcting: Moving ${cardData.name} from extra to main deck`);
          }

          // Create card object for deck builder
          const deckCard = {
            id: `${correctZone}_${cardId}_${Date.now()}_${Math.random()}`,
            cardId: cardId,
            name: cardData.name,
            type: cardData.type || 'Unknown',
            level: cardData.level || null,
            attribute: cardData.attribute || null,
            zone: correctZone
          };

          // Add to correct deck zone
          result.deckZones[correctZone].push(deckCard);

          // For main deck cards, also add to cards array and card counts (for probability calculation)
          if (correctZone === 'main') {
            result.cards.push({
              id: cardId,
              name: cardData.name,
              isExtraDeck: false
            });

            // Track count of each card by name
            if (!result.cardCounts[cardData.name]) {
              result.cardCounts[cardData.name] = 0;
            }
            result.cardCounts[cardData.name]++;
          }
        } else {
          // Track unmatched card IDs
          result.unmatchedIds.push(cardId);
        }
      }

      return result;
    } catch (error) {
      console.error('Error parsing YDK file:', error);
      throw new Error('Failed to parse YDK file');
    }
  }

  /**
   * Validates a YDK file before parsing
   * @param {File} file - File object to validate
   * @throws {Error} If file is invalid
   * @returns {boolean} True if file is valid
   */
  validateYdkFile(file) {
    // Check file size (100KB limit)
    if (file.size > 100 * 1024) {
      throw new Error('File size exceeds 100KB limit');
    }

    // Check file extension
    if (!file.name.toLowerCase().endsWith('.ydk')) {
      throw new Error('Only YDK files are supported');
    }

    return true;
  }

  /**
   * Parses YDK content from clipboard or text input
   * @param {string} content - YDK content as text
   * @param {Object} staticCardDatabase - Card database for lookups
   * @returns {Object} Parsed result
   */
  parseYdkContent(content, staticCardDatabase) {
    return this.parseYdkFile(content, staticCardDatabase);
  }

  /**
   * Gets the loaded card database
   * @returns {Object} Card database or empty object if not loaded
   */
  getCardDatabase() {
    return this.cardDatabase || {};
  }

  /**
   * Checks if a card database is loaded
   * @returns {boolean} True if database is loaded
   */
  isDatabaseLoaded() {
    return this.cardDatabase !== null && Object.keys(this.cardDatabase).length > 0;
  }
}

// Export singleton instance
export default new YdkParser();