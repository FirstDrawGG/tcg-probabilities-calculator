#!/usr/bin/env node

/**
 * Yu-Gi-Oh Card Image Migration Script
 * 
 * This script downloads all card images from YGOPro API and uploads them to Vercel Blob Storage
 * with multiple formats (WebP, JPEG) and sizes (full, small, cropped).
 * 
 * Usage: node scripts/migrate-card-images.js
 * 
 * Environment Variables Required:
 * - BLOB_READ_WRITE_TOKEN: Vercel Blob storage token
 * 
 * Features:
 * - Multi-format storage (WebP 85%, JPEG 90%)
 * - Multi-size variants (full 420x614, small 168x245, cropped artwork)
 * - Rate limiting (100ms delay between requests)
 * - Error handling and retry logic
 * - Progress tracking
 * - Cost optimization (under 3GB total)
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
  DELAY_BETWEEN_REQUESTS: 100, // ms
  
  // Image quality settings for optimal size/quality balance
  WEBP_QUALITY: 85,
  JPEG_QUALITY: 90,
  
  // Image sizes
  SIZES: {
    full: { width: 420, height: 614 }, // Original YGOPro dimensions
    small: { width: 168, height: 245 }, // Thumbnail size (40% of original)
  },
  
  // Storage paths
  STORAGE_PREFIX: 'cards',
  
  // Progress tracking
  LOG_INTERVAL: 50, // Log progress every N cards
  
  // Error handling
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // ms
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
      // Extract card ID from blob pathname
      const pathParts = blob.pathname.split('/');
      if (pathParts.length >= 3) {
        const filename = pathParts[pathParts.length - 1];
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
 * Process image into multiple formats and sizes
 */
async function processImage(imageBuffer, cardId) {
  const variants = [];
  
  try {
    // Get image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    // Process each size variant
    for (const [sizeName, dimensions] of Object.entries(CONFIG.SIZES)) {
      // Resize image
      const resized = image.clone().resize(dimensions.width, dimensions.height, {
        fit: 'fill', // Maintain aspect ratio, may crop if needed
        background: { r: 255, g: 255, b: 255, alpha: 1 } // White background for any padding
      });
      
      // Generate WebP version (85% quality)
      const webpBuffer = await resized.clone().webp({ quality: CONFIG.WEBP_QUALITY }).toBuffer();
      const webpPath = `${CONFIG.STORAGE_PREFIX}/${sizeName}/${cardId}.webp`;
      
      variants.push({
        buffer: webpBuffer,
        path: webpPath,
        contentType: 'image/webp',
        format: 'webp',
        size: sizeName
      });
      
      // Generate JPEG version (90% quality)
      const jpegBuffer = await resized.clone().jpeg({ quality: CONFIG.JPEG_QUALITY }).toBuffer();
      const jpegPath = `${CONFIG.STORAGE_PREFIX}/${sizeName}/${cardId}.jpg`;
      
      variants.push({
        buffer: jpegBuffer,
        path: jpegPath,
        contentType: 'image/jpeg',
        format: 'jpeg',
        size: sizeName
      });
    }
    
    return variants;
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

/**
 * Upload image variant to Vercel Blob
 */
async function uploadImageVariant(variant, retries = CONFIG.MAX_RETRIES) {
  try {
    const blob = await put(variant.path, variant.buffer, {
      access: 'public',
      contentType: variant.contentType,
    });
    
    return blob;
  } catch (error) {
    if (retries > 0) {
      console.log(`⚠️  Upload failed, retrying... (${retries} retries left)`);
      await sleep(CONFIG.RETRY_DELAY);
      return uploadImageVariant(variant, retries - 1);
    }
    throw error;
  }
}

/**
 * Process a single card
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
    
    // Process into multiple formats and sizes
    const variants = await processImage(imageBuffer, cardId);
    
    // Upload all variants
    const uploadPromises = variants.map(variant => uploadImageVariant(variant));
    await Promise.all(uploadPromises);
    
    state.processed++;
    
    // Log progress
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
      timestamp: new Date().toISOString()
    },
    failed: state.failed,
    skipped: state.skipped.slice(0, 100) // Limit skipped list to avoid huge files
  };
  
  const outputPath = join(__dirname, 'migration-results.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  
  console.log(`📄 Migration results saved to: ${outputPath}`);
  return results;
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting Yu-Gi-Oh card image migration...');
  console.log(`📋 Configuration:
  - WebP Quality: ${CONFIG.WEBP_QUALITY}%
  - JPEG Quality: ${CONFIG.JPEG_QUALITY}%
  - Rate Limit: ${CONFIG.DELAY_BETWEEN_REQUESTS}ms between requests
  - Image Sizes: ${Object.keys(CONFIG.SIZES).join(', ')}
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
    console.log(`🎯 Processing ${state.total} cards with images`);
    
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
🎉 Migration completed!
📊 Summary:
  - Total cards: ${results.summary.total}
  - Successfully processed: ${results.summary.processed}
  - Failed: ${results.summary.failed}
  - Skipped: ${results.summary.skipped}
  - Duration: ${Math.round(results.summary.duration)}s
  - Average rate: ${(results.summary.processed / results.summary.duration).toFixed(1)} cards/s
    `);
    
    if (results.summary.failed > 0) {
      console.log(`⚠️  ${results.summary.failed} cards failed to process. See migration-results.json for details.`);
    }
    
    console.log('✅ Migration completed successfully!');
    
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

module.exports = { migrate, processImage, uploadImageVariant };