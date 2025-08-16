#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { list } = require('@vercel/blob');

(async () => {
  try {
    console.log('🔍 Checking current migration progress...');
    
    const { blobs } = await list({ prefix: 'cards/' });
    const cardNameBlobs = blobs.filter(blob => 
      blob.pathname.startsWith('cards/') && 
      blob.pathname.endsWith('.webp')
    );
    
    // Count full and small variants
    const fullSize = cardNameBlobs.filter(blob => !blob.pathname.includes('-small')).length;
    const smallSize = cardNameBlobs.filter(blob => blob.pathname.includes('-small')).length;
    const totalSize = cardNameBlobs.reduce((sum, blob) => sum + blob.size, 0);
    const cardsProcessed = Math.min(fullSize, smallSize);
    const progressPercent = Math.round((cardsProcessed / 13808) * 100);
    
    console.log('\n📊 Current Migration Progress:');
    console.log('==========================================');
    console.log(`📁 Full size images: ${fullSize}`);
    console.log(`📁 Small size images: ${smallSize}`);
    console.log(`📁 Total card images: ${cardNameBlobs.length}`);
    console.log(`🎯 Cards processed: ${cardsProcessed}/13,808`);
    console.log(`📈 Progress: ${progressPercent}%`);
    console.log(`💾 Total storage size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
    console.log(`💾 Storage usage: ${(totalSize / 1024 / 1024 / 1024).toFixed(3)} GB / 3GB limit`);
    
    if (cardsProcessed > 0) {
      const avgSizePerCard = totalSize / cardsProcessed / 1024; // KB per card
      const estimatedTotalSize = (avgSizePerCard * 13808) / 1024; // MB
      console.log(`📊 Estimated final size: ${estimatedTotalSize.toFixed(1)} MB`);
      
      const rate = cardsProcessed > 100 ? '~1.3 cards/second (estimated)' : 'Calculating...';
      console.log(`⚡ Processing rate: ${rate}`);
      
      if (cardsProcessed < 13808) {
        const remaining = 13808 - cardsProcessed;
        const etaSeconds = remaining / 1.3; // Based on observed rate
        const etaHours = Math.floor(etaSeconds / 3600);
        const etaMinutes = Math.floor((etaSeconds % 3600) / 60);
        console.log(`⏱️  Estimated completion: ${etaHours}h ${etaMinutes}m remaining`);
      } else {
        console.log('✅ Migration completed!');
      }
    }
    
    console.log('==========================================\n');
    
    // Show some recent files as examples
    if (cardNameBlobs.length > 0) {
      console.log('📋 Recent migrated cards (sample):');
      const recentCards = cardNameBlobs
        .filter(blob => !blob.pathname.includes('-small'))
        .slice(-5)
        .map(blob => {
          const filename = blob.pathname.split('/').pop();
          const cardName = filename.replace('.webp', '');
          return `   • ${cardName}`;
        });
      console.log(recentCards.join('\n'));
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error checking progress:', error.message);
    process.exit(1);
  }
})();