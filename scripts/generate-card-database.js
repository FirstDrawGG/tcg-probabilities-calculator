const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Generate static card database for YDK parsing
async function generateCardDatabase() {
  console.log('Generating static card database...');
  
  try {
    // Fetch all Yu-Gi-Oh cards from API
    console.log('Fetching cards from Yu-Gi-Oh API...');
    const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php');
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    const cards = data.data || [];
    
    console.log(`Fetched ${cards.length} cards from API`);
    
    // Create optimized card database for YDK parsing
    const cardDatabase = {};
    
    cards.forEach(card => {
      // Determine if card is Extra Deck
      const cardType = card.type ? card.type.toLowerCase() : '';
      const isExtraDeck = cardType.includes('xyz') || 
                         cardType.includes('link') || 
                         cardType.includes('fusion') || 
                         cardType.includes('synchro');
      
      cardDatabase[card.id] = {
        name: card.name,
        type: card.type || 'Unknown',
        level: card.level || null,
        attribute: card.attribute || null,
        isExtraDeck: isExtraDeck
      };
    });
    
    // Write to public directory for client access
    const outputPath = path.join(__dirname, '..', 'public', 'cardDatabase.json');
    const publicDir = path.dirname(outputPath);
    
    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(cardDatabase, null, 2));
    
    console.log(`✅ Card database generated successfully!`);
    console.log(`📍 Location: ${outputPath}`);
    console.log(`📊 Total cards: ${Object.keys(cardDatabase).length}`);
    console.log(`🔢 Extra Deck cards: ${Object.values(cardDatabase).filter(c => c.isExtraDeck).length}`);
    console.log(`🃏 Main Deck cards: ${Object.values(cardDatabase).filter(c => !c.isExtraDeck).length}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to generate card database:', error.message);
    
    // Try to use existing database if generation fails
    const existingPath = path.join(__dirname, '..', 'public', 'cardDatabase.json');
    if (fs.existsSync(existingPath)) {
      console.log('⚠️  Using existing card database file');
      return true;
    }
    
    console.error('💥 No existing card database found. Build will fail.');
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  generateCardDatabase()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { generateCardDatabase };