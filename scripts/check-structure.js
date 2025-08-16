#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { list } = require('@vercel/blob');

(async () => {
  try {
    console.log('🔍 Checking storage structure...');
    
    // Check cards/ prefix (new format)
    const { blobs: cardsBlobs } = await list({ prefix: 'cards/' });
    const newFormatCards = cardsBlobs.filter(blob => 
      blob.pathname.startsWith('cards/') && 
      blob.pathname.endsWith('.webp')
    );
    
    // Check cards-small/ prefix (old format)  
    const { blobs: cardsSmallBlobs } = await list({ prefix: 'cards-small/' });
    const oldFormatCards = cardsSmallBlobs.filter(blob => 
      blob.pathname.startsWith('cards-small/') && 
      blob.pathname.endsWith('.webp')
    );
    
    console.log('\n📁 Storage Structure Analysis:');
    console.log('==========================================');
    console.log('NEW FORMAT (/cards/):');
    console.log('- Full size images:', newFormatCards.filter(b => !b.pathname.includes('-small')).length);
    console.log('- Small size images:', newFormatCards.filter(b => b.pathname.includes('-small')).length);
    console.log('- Total new format:', newFormatCards.length);
    
    console.log('\nOLD FORMAT (/cards-small/):');
    console.log('- Images:', oldFormatCards.length);
    
    console.log('\nTOTAL IMAGES:', newFormatCards.length + oldFormatCards.length);
    
    console.log('\n📋 Sample paths:');
    if (newFormatCards.length > 0) {
      console.log('New format examples:');
      newFormatCards.slice(0, 5).forEach(blob => console.log('  ', blob.pathname));
    }
    if (oldFormatCards.length > 0) {
      console.log('\nOld format examples:');
      oldFormatCards.slice(0, 5).forEach(blob => console.log('  ', blob.pathname));
    }
    
    // Calculate storage usage
    const newFormatSize = newFormatCards.reduce((sum, blob) => sum + blob.size, 0);
    const oldFormatSize = oldFormatCards.reduce((sum, blob) => sum + blob.size, 0);
    
    console.log('\n💾 Storage Usage:');
    console.log('- New format:', (newFormatSize / 1024 / 1024).toFixed(1), 'MB');
    console.log('- Old format:', (oldFormatSize / 1024 / 1024).toFixed(1), 'MB');
    console.log('- Total:', ((newFormatSize + oldFormatSize) / 1024 / 1024).toFixed(1), 'MB');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();