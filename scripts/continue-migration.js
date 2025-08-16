#!/usr/bin/env node

/**
 * Continue Migration Script
 * 
 * Resumes the optimized migration from where it left off
 * Uses batch processing to avoid timeouts
 */

require('dotenv').config({ path: '.env.local' });

const { put, list } = require('@vercel/blob');
const sharp = require('sharp');
const fetch = require('node-fetch');
const { writeFileSync } = require('fs');
const { join } = require('path');

const CONFIG = {
  DELAY_BETWEEN_REQUESTS: 150, // Faster processing
  WEBP_QUALITY: 85,
  SIZE: { width: 168, height: 245 },
  STORAGE_PREFIX: 'cards-small',
  LOG_INTERVAL: 10,
  BATCH_SIZE: 100, // Process in smaller batches
  MAX_RETRIES: 1,
  RETRY_DELAY: 500,
};

const state = {
  processed: 0,
  failed: [],
  skipped: [],
  total: 0,
  startTime: Date.now(),
  batchCount: 0,
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchCardData() {
  console.log('🔄 Fetching card data from YGOPro API...');
  const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php');
  const data = await response.json();
  return data.data.filter(card => card.card_images && card.card_images.length > 0);
}

async function getExistingImages() {
  console.log('🔄 Checking existing images...');
  const { blobs } = await list({ prefix: CONFIG.STORAGE_PREFIX });
  const existing = new Set();
  
  blobs.forEach(blob => {
    if (blob.pathname.startsWith(CONFIG.STORAGE_PREFIX + '/')) {
      const filename = blob.pathname.split('/').pop();
      const cardId = filename.split('.')[0];
      existing.add(cardId);
    }
  });
  
  console.log(`✅ Found ${existing.size} cards already processed`);
  return existing;
}

async function processImage(imageBuffer, cardId) {
  const webpBuffer = await sharp(imageBuffer)
    .resize(CONFIG.SIZE.width, CONFIG.SIZE.height, {
      fit: 'fill',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .webp({ quality: CONFIG.WEBP_QUALITY })
    .toBuffer();
  
  return {
    buffer: webpBuffer,
    path: `${CONFIG.STORAGE_PREFIX}/${cardId}.webp`,
    contentType: 'image/webp'
  };
}

async function uploadImage(imageData) {
  try {
    const blob = await put(imageData.path, imageData.buffer, {
      access: 'public',
      contentType: imageData.contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return blob;
  } catch (error) {
    if (error.message.includes('This blob already exists')) {
      return { url: `existing-${imageData.path}` };
    }
    throw error;
  }
}

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

async function processBatch(cards, existingImages, startIndex) {
  console.log(`\n🚀 Processing batch ${state.batchCount + 1} (cards ${startIndex + 1} to ${Math.min(startIndex + CONFIG.BATCH_SIZE, cards.length)})`);
  
  for (let i = 0; i < CONFIG.BATCH_SIZE && (startIndex + i) < cards.length; i++) {
    const card = cards[startIndex + i];
    const cardId = card.id.toString();
    const cardName = card.name;
    
    try {
      // Skip if already exists
      if (existingImages.has(cardId)) {
        state.skipped.push({ cardId, name: cardName, reason: 'Already exists' });
        continue;
      }
      
      // Download and process
      const imageUrl = card.card_images[0].image_url;
      const imageBuffer = await downloadImage(imageUrl);
      const imageData = await processImage(imageBuffer, cardId);
      await uploadImage(imageData);
      
      state.processed++;
      
      if (state.processed % CONFIG.LOG_INTERVAL === 0) {
        console.log(`✅ Processed ${state.processed} cards (${cardName})`);
      }
      
      // Rate limiting
      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
      
    } catch (error) {
      state.failed.push({
        cardId,
        name: cardName,
        error: error.message,
        imageUrl: card.card_images?.[0]?.image_url
      });
      console.error(`❌ Failed: ${cardName} (${cardId}) - ${error.message}`);
    }
  }
}

async function migrate() {
  console.log('🚀 Continuing optimized migration...');
  
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required');
    }
    
    const cards = await fetchCardData();
    const existingImages = await getExistingImages();
    
    // Filter to only unprocessed cards
    const unprocessedCards = cards.filter(card => !existingImages.has(card.id.toString()));
    
    state.total = unprocessedCards.length;
    console.log(`🎯 Found ${unprocessedCards.length} unprocessed cards`);
    
    if (unprocessedCards.length === 0) {
      console.log('✅ All cards already processed!');
      return;
    }
    
    // Process in batches
    const totalBatches = Math.ceil(unprocessedCards.length / CONFIG.BATCH_SIZE);
    
    for (let batchStart = 0; batchStart < unprocessedCards.length; batchStart += CONFIG.BATCH_SIZE) {
      state.batchCount++;
      await processBatch(unprocessedCards, existingImages, batchStart);
      
      console.log(`📊 Batch ${state.batchCount}/${totalBatches} complete - Processed: ${state.processed}, Failed: ${state.failed.length}`);
      
      // Save intermediate results
      if (state.batchCount % 5 === 0) {
        saveResults();
      }
    }
    
    const results = saveResults();
    
    console.log(`
🎉 Migration batch completed!
📊 Summary:
  - Processed: ${state.processed}
  - Failed: ${state.failed.length}
  - Skipped: ${state.skipped.length}
  - Duration: ${Math.round((Date.now() - state.startTime) / 1000)}s
  - Rate: ${(state.processed / ((Date.now() - state.startTime) / 1000)).toFixed(1)} cards/s
    `);
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    saveResults();
    process.exit(1);
  }
}

function saveResults() {
  const results = {
    summary: {
      processed: state.processed,
      failed: state.failed.length,
      skipped: state.skipped.length,
      duration: (Date.now() - state.startTime) / 1000,
      timestamp: new Date().toISOString()
    },
    failed: state.failed,
    skipped: state.skipped.slice(0, 50) // Limit size
  };
  
  const outputPath = join(__dirname, 'continue-migration-results.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved to: ${outputPath}`);
  return results;
}

if (require.main === module) {
  migrate();
}