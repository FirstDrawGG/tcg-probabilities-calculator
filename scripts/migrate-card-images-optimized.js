#!/usr/bin/env node

/**
 * OPTIMIZED Yu-Gi-Oh Card Image Migration Script
 * 
 * This optimized version reduces Vercel Blob operations by 75% by using:
 * - WebP format only (no JPEG fallback)
 * - Small size only (168x245px)
 * - Single file per card instead of 4 files
 * 
 * Total operations: 13,806 instead of 55,216 (75% reduction)
 * 
 * Usage: node scripts/migrate-card-images-optimized.js
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { put, list } = require('@vercel/blob');
const sharp = require('sharp');
const fetch = require('node-fetch');
const { writeFileSync, readFileSync, existsSync } = require('fs');
const { join } = require('path');

// Configuration
const CONFIG = {
  // Rate limiting to avoid overwhelming APIs
  DELAY_BETWEEN_REQUESTS: 200, // Increased delay for stability
  
  // OPTIMIZED: Single format and size
  WEBP_QUALITY: 85,
  SIZE: { width: 168, height: 245 }, // Small size only
  
  // Storage paths - use simple structure to avoid conflicts
  STORAGE_PREFIX: 'cards-small',
  
  // Progress tracking
  LOG_INTERVAL: 25, // More frequent logging
  
  // Error handling - reduced retries to save resources
  MAX_RETRIES: 1,
  RETRY_DELAY: 500, // ms
};

// Global state
const state = {
  processed: 0,
  failed: [],
  skipped: [],
  total: 0,
  startTime: Date.now(),
};

/**
 * Sleep utility for rate limiting
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch card data from YGOPro API
 */
async function fetchCardData() {
  console.log('🔄 Fetching card data from YGOPro API...');
  
  try {
    const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php');
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const cards = data.data || [];
    
    console.log(`✅ Found ${cards.length} cards in database`);
    return cards;
  } catch (error) {
    console.error('❌ Failed to fetch card data:', error.message);
    throw error;
  }
}

/**
 * Check which images already exist in Blob storage
 */
async function getExistingImages() {
  console.log('🔄 Checking existing images in Blob storage...');
  
  try {
    const { blobs } = await list({ prefix: CONFIG.STORAGE_PREFIX });
    const existing = new Set();
    
    blobs.forEach(blob => {
      // Extract card ID from blob pathname - check for cards-small prefix
      if (blob.pathname.startsWith(CONFIG.STORAGE_PREFIX + '/')) {
        const filename = blob.pathname.split('/').pop();
        const cardId = filename.split('.')[0];
        existing.add(cardId);
      }
    });
    
    console.log(`✅ Found ${existing.size} cards already in storage`);
    return existing;
  } catch (error) {
    console.error('❌ Failed to check existing images:', error.message);
    return new Set(); // Continue with empty set if check fails
  }
}

/**
 * Download image from URL with retry logic
 */
async function downloadImage(url, retries = CONFIG.MAX_RETRIES) {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    if (retries > 0) {
      console.log(`⚠️  Download failed, retrying in ${CONFIG.RETRY_DELAY}ms... (${retries} retries left)`);
      await sleep(CONFIG.RETRY_DELAY);
      return downloadImage(url, retries - 1);
    }
    throw error;
  }
}

/**
 * OPTIMIZED: Process image into single WebP format and size
 */
async function processImage(imageBuffer, cardId) {
  try {
    // Resize to small dimensions and convert to WebP
    const webpBuffer = await sharp(imageBuffer)
      .resize(CONFIG.SIZE.width, CONFIG.SIZE.height, {
        fit: 'fill',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .webp({ quality: CONFIG.WEBP_QUALITY })
      .toBuffer();
    
    const webpPath = `${CONFIG.STORAGE_PREFIX}/${cardId}.webp`;
    
    return {
      buffer: webpBuffer,
      path: webpPath,
      contentType: 'image/webp',
      format: 'webp'
    };
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

/**
 * Upload image to Vercel Blob
 */
async function uploadImage(imageData, retries = CONFIG.MAX_RETRIES) {
  try {
    const blob = await put(imageData.path, imageData.buffer, {
      access: 'public',
      contentType: imageData.contentType,
      addRandomSuffix: false,
      allowOverwrite: false, // Don't overwrite existing images
    });
    
    return blob;
  } catch (error) {
    // If image already exists, treat as success to avoid waste
    if (error.message.includes('This blob already exists')) {
      console.log(`ℹ️  Image already exists: ${imageData.path}`);
      return { url: `existing-${imageData.path}` }; // Return dummy blob object
    }
    
    if (retries > 0) {
      console.log(`⚠️  Upload failed, retrying... (${retries} retries left)`);
      await sleep(CONFIG.RETRY_DELAY);
      return uploadImage(imageData, retries - 1);
    }
    throw error;
  }
}

/**
 * Process a single card (OPTIMIZED)
 */
async function processCard(card, existingImages) {
  const cardId = card.id.toString();
  const cardName = card.name;
  
  // Skip if already processed
  if (existingImages.has(cardId)) {
    state.skipped.push({ cardId, name: cardName, reason: 'Already exists' });
    return;
  }
  
  // Skip if no image available
  if (!card.card_images || card.card_images.length === 0) {
    state.skipped.push({ cardId, name: cardName, reason: 'No image available' });
    return;
  }
  
  try {
    // Use the first image (highest quality)
    const imageUrl = card.card_images[0].image_url;
    
    // Download original image
    const imageBuffer = await downloadImage(imageUrl);
    
    // Process into single optimized format
    const imageData = await processImage(imageBuffer, cardId);
    
    // Upload single image
    await uploadImage(imageData);
    
    state.processed++;
    
    // Log progress more frequently
    if (state.processed % CONFIG.LOG_INTERVAL === 0) {
      const elapsed = (Date.now() - state.startTime) / 1000;
      const rate = state.processed / elapsed;
      const eta = (state.total - state.processed) / rate;
      
      console.log(`📊 Progress: ${state.processed}/${state.total} (${Math.round(state.processed / state.total * 100)}%) - Rate: ${rate.toFixed(1)}/s - ETA: ${Math.round(eta)}s`);
    }
    
    console.log(`✅ Uploaded ${state.processed}/${state.total}: ${cardName} (${cardId})`);
    
  } catch (error) {
    state.failed.push({
      cardId,
      name: cardName,
      error: error.message,
      imageUrl: card.card_images?.[0]?.image_url
    });
    
    console.error(`❌ Failed to process ${cardName} (${cardId}): ${error.message}`);
  }
}

/**
 * Save migration results to file
 */
function saveMigrationResults() {
  const results = {
    summary: {
      total: state.total,
      processed: state.processed,
      failed: state.failed.length,
      skipped: state.skipped.length,
      duration: (Date.now() - state.startTime) / 1000,
      timestamp: new Date().toISOString(),
      optimization: '75% reduction - WebP only, small size only'
    },
    failed: state.failed,
    skipped: state.skipped.slice(0, 100) // Limit skipped list to avoid huge files
  };
  
  const outputPath = join(__dirname, 'migration-results-optimized.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  
  console.log(`📄 Migration results saved to: ${outputPath}`);
  return results;
}

/**
 * Main migration function (OPTIMIZED)
 */
async function migrate() {
  console.log('🚀 Starting OPTIMIZED Yu-Gi-Oh card image migration...');
  console.log(`📋 Configuration:
  - Format: WebP only (${CONFIG.WEBP_QUALITY}% quality)
  - Size: ${CONFIG.SIZE.width}x${CONFIG.SIZE.height}px only
  - Operations reduced by 75% (1 file per card vs 4)
  - Rate Limit: ${CONFIG.DELAY_BETWEEN_REQUESTS}ms between requests
  `);
  
  try {
    // Check environment
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required');
    }
    
    // Fetch card data
    const cards = await fetchCardData();
    const cardsWithImages = cards.filter(card => card.card_images && card.card_images.length > 0);
    
    state.total = cardsWithImages.length;
    console.log(`🎯 Processing ${state.total} cards (${state.total} operations vs ${state.total * 4} in original)`);
    
    // Check existing images
    const existingImages = await getExistingImages();
    
    // Process cards with rate limiting
    for (let i = 0; i < cardsWithImages.length; i++) {
      const card = cardsWithImages[i];
      
      await processCard(card, existingImages);
      
      // Rate limiting
      if (i < cardsWithImages.length - 1) {
        await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
      }
    }
    
    // Save results
    const results = saveMigrationResults();
    
    // Final summary
    console.log(`
🎉 OPTIMIZED Migration completed!
📊 Summary:
  - Total cards: ${results.summary.total}
  - Successfully processed: ${results.summary.processed}
  - Failed: ${results.summary.failed}
  - Skipped: ${results.summary.skipped}
  - Duration: ${Math.round(results.summary.duration)}s
  - Average rate: ${(results.summary.processed / results.summary.duration).toFixed(1)} cards/s
  - Operations saved: ${(state.total * 3).toLocaleString()} (75% reduction)
    `);
    
    if (results.summary.failed > 0) {
      console.log(`⚠️  ${results.summary.failed} cards failed to process. See migration-results-optimized.json for details.`);
    }
    
    console.log('✅ Optimized migration completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    
    // Save partial results
    saveMigrationResults();
    
    process.exit(1);
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate, processImage, uploadImage };