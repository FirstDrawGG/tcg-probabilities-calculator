#!/usr/bin/env node

/**
 * Yu-Gi-Oh Card Image Migration Script - Final Implementation
 * 
 * This script implements all acceptance criteria for Vercel Blob Storage setup:
 * - WebP format with 85% quality
 * - Two size variants: full (~420x614px) and small (168x245px)
 * - Storage structure: /cards/{cardName}.webp
 * - Rate limiting: 100ms delay between requests
 * - Comprehensive error handling with minimal retries
 * - Cost optimization: <3GB total storage
 * 
 * Usage: npm run migrate:images:final
 * 
 * Environment Variables Required:
 * - BLOB_READ_WRITE_TOKEN: Vercel Blob storage token
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { put, list } = require('@vercel/blob');
const sharp = require('sharp');
const fetch = require('node-fetch');
const { writeFileSync } = require('fs');
const { join } = require('path');

// Configuration - Optimized for AC requirements
const CONFIG = {
  // AC #4: Rate limiting - 100ms delay between requests
  DELAY_BETWEEN_REQUESTS: 100,
  
  // AC #2: WebP format with 85% quality
  WEBP_QUALITY: 85,
  
  // AC #3: Multi-size variants
  SIZES: {
    full: { width: 420, height: 614, suffix: '' },      // Original dimensions
    small: { width: 168, height: 245, suffix: '-small' } // Thumbnail size
  },
  
  // AC #2: Storage structure /cards/{cardName}.webp
  STORAGE_PREFIX: 'cards',
  
  // AC #4: Progress tracking
  LOG_INTERVAL: 25, // Log every 25 cards processed
  
  // AC #5 & AC #6: Minimal retries for cost optimization
  MAX_RETRIES: 1,
  RETRY_DELAY: 500, // ms
  
  // AC #6: Cost optimization - limit batch size if needed
  MAX_BATCH_SIZE: 15000, // Prevent runaway costs
};

// Global state tracking
const state = {
  processed: 0,
  uploaded: 0,
  failed: [],
  skipped: [],
  total: 0,
  startTime: Date.now(),
  totalSize: 0, // Track total storage size
};

/**
 * Utility function for rate limiting
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sanitize card name for use as filename
 * Removes special characters and limits length
 */
function sanitizeCardName(cardName) {
  return cardName
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .toLowerCase()
    .substring(0, 50); // Limit length to avoid filesystem issues
}

/**
 * AC #4: Fetch card data from YGOPro API
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
    
    // Filter cards that have images and limit batch size for cost control
    const cardsWithImages = cards
      .filter(card => card.card_images && card.card_images.length > 0)
      .slice(0, CONFIG.MAX_BATCH_SIZE);
    
    console.log(`✅ Found ${cardsWithImages.length} cards with images`);
    return cardsWithImages;
  } catch (error) {
    console.error('❌ Failed to fetch card data:', error.message);
    throw error;
  }
}

/**
 * AC #5: Check which images already exist to avoid duplicates
 */
async function getExistingImages() {
  console.log('🔄 Checking existing images in Blob storage...');
  
  try {
    const { blobs } = await list({ prefix: CONFIG.STORAGE_PREFIX });
    const existing = new Set();
    
    blobs.forEach(blob => {
      // Extract base filename (without size suffix and extension)
      const filename = blob.pathname.split('/').pop();
      const baseName = filename.replace(/(-small)?\.webp$/, '');
      existing.add(baseName);
    });
    
    console.log(`✅ Found ${existing.size} cards already in storage`);
    return existing;
  } catch (error) {
    console.error('❌ Failed to check existing images:', error.message);
    return new Set(); // Continue with empty set if check fails
  }
}

/**
 * AC #5: Download image with minimal retry logic
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
      console.log(`⚠️  Download retry (${retries} left): ${error.message}`);
      await sleep(CONFIG.RETRY_DELAY);
      return downloadImage(url, retries - 1);
    }
    throw error;
  }
}

/**
 * AC #2 & AC #3: Process image into WebP format with multiple sizes
 */
async function processImage(imageBuffer, cardName) {
  const sanitizedName = sanitizeCardName(cardName);
  const variants = [];
  
  try {
    for (const [sizeName, config] of Object.entries(CONFIG.SIZES)) {
      // Resize and convert to WebP
      const webpBuffer = await sharp(imageBuffer)
        .resize(config.width, config.height, {
          fit: 'fill',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .webp({ quality: CONFIG.WEBP_QUALITY })
        .toBuffer();
      
      // AC #2: Storage structure /cards/{cardName}.webp
      const fileName = `${sanitizedName}${config.suffix}.webp`;
      const storagePath = `${CONFIG.STORAGE_PREFIX}/${fileName}`;
      
      variants.push({
        buffer: webpBuffer,
        path: storagePath,
        contentType: 'image/webp',
        size: sizeName,
        fileName: fileName,
        fileSize: webpBuffer.length
      });
    }
    
    return variants;
  } catch (error) {
    throw new Error(`Image processing failed for ${cardName}: ${error.message}`);
  }
}

/**
 * AC #5 & AC #6: Upload image with minimal retry for cost optimization
 */
async function uploadImage(imageData, retries = CONFIG.MAX_RETRIES) {
  try {
    const blob = await put(imageData.path, imageData.buffer, {
      access: 'public',
      contentType: imageData.contentType,
      addRandomSuffix: false,
    });
    
    state.totalSize += imageData.fileSize;
    return blob;
  } catch (error) {
    if (error.message.includes('already exists')) {
      // Skip existing images silently
      return { url: `existing-${imageData.path}`, skipped: true };
    }
    
    if (retries > 0) {
      console.log(`⚠️  Upload retry (${retries} left): ${imageData.fileName}`);
      await sleep(CONFIG.RETRY_DELAY);
      return uploadImage(imageData, retries - 1);
    }
    throw error;
  }
}

/**
 * AC #4, #5, #6: Process a single card with all error handling
 */
async function processCard(card, existingImages) {
  const cardId = card.id.toString();
  const cardName = card.name;
  const sanitizedName = sanitizeCardName(cardName);
  
  // Skip if already processed
  if (existingImages.has(sanitizedName)) {
    state.skipped.push({ cardId, name: cardName, reason: 'Already exists' });
    return;
  }
  
  try {
    // Use the first image (highest quality)
    const imageUrl = card.card_images[0].image_url;
    
    // Download original image
    const imageBuffer = await downloadImage(imageUrl);
    
    // Process into multiple size variants
    const imageVariants = await processImage(imageBuffer, cardName);
    
    // Upload all variants
    let uploadedCount = 0;
    for (const variant of imageVariants) {
      const result = await uploadImage(variant);
      if (!result.skipped) {
        uploadedCount++;
      }
    }
    
    if (uploadedCount > 0) {
      state.uploaded += uploadedCount;
      console.log(`✅ Uploaded ${state.uploaded} images - ${cardName} (${uploadedCount} variants)`);
    }
    
    state.processed++;
    
    // AC #4: Progress tracking
    if (state.processed % CONFIG.LOG_INTERVAL === 0) {
      const elapsed = (Date.now() - state.startTime) / 1000;
      const rate = state.processed / elapsed;
      const eta = (state.total - state.processed) / rate;
      const sizeMB = (state.totalSize / 1024 / 1024).toFixed(1);
      
      console.log(`📊 Progress: ${state.processed}/${state.total} (${Math.round(state.processed / state.total * 100)}%) - ${rate.toFixed(1)}/s - ETA: ${Math.round(eta)}s - Size: ${sizeMB}MB`);
    }
    
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

/**
 * Save migration results for validation and debugging
 */
function saveMigrationResults() {
  const results = {
    summary: {
      total: state.total,
      processed: state.processed,
      uploaded: state.uploaded,
      failed: state.failed.length,
      skipped: state.skipped.length,
      duration: (Date.now() - state.startTime) / 1000,
      totalSizeMB: (state.totalSize / 1024 / 1024).toFixed(2),
      timestamp: new Date().toISOString(),
      configuration: {
        webpQuality: CONFIG.WEBP_QUALITY,
        sizes: CONFIG.SIZES,
        rateLimit: CONFIG.DELAY_BETWEEN_REQUESTS,
        maxRetries: CONFIG.MAX_RETRIES
      }
    },
    failed: state.failed,
    skipped: state.skipped.slice(0, 50) // Limit to avoid large files
  };
  
  const outputPath = join(__dirname, 'migration-results-final.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  
  console.log(`📄 Migration results saved to: ${outputPath}`);
  return results;
}

/**
 * AC #6: Check storage size limits
 */
function checkStorageLimit() {
  const sizeMB = state.totalSize / 1024 / 1024;
  const sizeGB = sizeMB / 1024;
  
  if (sizeGB > 3) {
    console.warn(`⚠️  WARNING: Storage size (${sizeGB.toFixed(2)}GB) exceeds 3GB limit!`);
    return false;
  }
  
  console.log(`✅ Storage size: ${sizeMB.toFixed(1)}MB (${sizeGB.toFixed(3)}GB) - Within 3GB limit`);
  return true;
}

/**
 * Main migration function implementing all ACs
 */
async function migrate() {
  console.log('🚀 Starting Yu-Gi-Oh Card Image Migration to Vercel Blob Storage');
  console.log(`📋 Configuration:
  - Format: WebP only (${CONFIG.WEBP_QUALITY}% quality)
  - Sizes: Full (${CONFIG.SIZES.full.width}x${CONFIG.SIZES.full.height}px), Small (${CONFIG.SIZES.small.width}x${CONFIG.SIZES.small.height}px)
  - Storage: ${CONFIG.STORAGE_PREFIX}/{cardName}.webp pattern
  - Rate Limit: ${CONFIG.DELAY_BETWEEN_REQUESTS}ms between requests
  - Max Retries: ${CONFIG.MAX_RETRIES} (cost optimized)
  `);
  
  try {
    // Verify environment
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required');
    }
    
    // Fetch card data
    const cards = await fetchCardData();
    state.total = cards.length;
    
    console.log(`🎯 Processing ${state.total} cards (${state.total * 2} total images)`);
    
    // Check existing images
    const existingImages = await getExistingImages();
    
    // Process cards with rate limiting
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      
      await processCard(card, existingImages);
      
      // AC #4: Rate limiting between requests
      if (i < cards.length - 1) {
        await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
      }
      
      // AC #6: Check storage limits periodically
      if (i % 100 === 0) {
        if (!checkStorageLimit()) {
          console.log('🛑 Stopping migration due to storage limit');
          break;
        }
      }
    }
    
    // Save final results
    const results = saveMigrationResults();
    
    // Final summary
    console.log(`
🎉 Migration Completed Successfully!
📊 Final Summary:
  - Total cards processed: ${results.summary.processed}/${results.summary.total}
  - Images uploaded: ${results.summary.uploaded}
  - Failed: ${results.summary.failed}
  - Skipped (already existed): ${results.summary.skipped}
  - Duration: ${Math.round(results.summary.duration)}s
  - Average rate: ${(results.summary.processed / results.summary.duration).toFixed(1)} cards/s
  - Total storage: ${results.summary.totalSizeMB}MB
  - Storage limit check: ${checkStorageLimit() ? '✅ PASSED' : '❌ EXCEEDED'}
    `);
    
    if (results.summary.failed > 0) {
      console.log(`⚠️  ${results.summary.failed} cards failed. Check migration-results-final.json for details.`);
    }
    
    console.log('✅ Migration completed! Images are now stored in Vercel Blob Storage.');
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    saveMigrationResults();
    process.exit(1);
  }
}

// Export functions for testing and validation
module.exports = {
  migrate,
  processImage,
  uploadImage,
  sanitizeCardName,
  fetchCardData
};

// Run migration if script is executed directly
if (require.main === module) {
  migrate();
}