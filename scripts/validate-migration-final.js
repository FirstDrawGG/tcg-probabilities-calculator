#!/usr/bin/env node

/**
 * Migration Validation Script - Final Implementation
 * 
 * This script validates the Yu-Gi-Oh card image migration according to AC #8:
 * - Verifies all cards with images have corresponding Blob storage entries
 * - Checks image quality and accessibility
 * - Validates storage structure and file integrity
 * - Tests sample images for direct URL access
 * 
 * Usage: npm run validate:migration:final
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { list } = require('@vercel/blob');
const fetch = require('node-fetch');
const { writeFileSync } = require('fs');
const { join } = require('path');

// Configuration
const CONFIG = {
  STORAGE_PREFIX: 'cards',
  EXPECTED_FORMATS: ['webp'],
  EXPECTED_SIZES: ['', '-small'], // '' for full size, '-small' for small size
  SAMPLE_SIZE: 50, // Number of images to test for accessibility
  MAX_CONCURRENT_TESTS: 5, // Limit concurrent HTTP requests
  EXPECTED_QUALITY_MIN_SIZE: 5000, // Min bytes for quality check
};

// Validation state
const validation = {
  total: {
    cards: 0,
    expectedImages: 0,
    foundImages: 0
  },
  found: {
    cards: new Set(),
    bySize: { full: 0, small: 0 },
    totalSize: 0
  },
  missing: [],
  accessible: [],
  inaccessible: [],
  qualityIssues: [],
  structureIssues: [],
  startTime: Date.now()
};

/**
 * Utility function to sanitize card names (matches migration script)
 */
function sanitizeCardName(cardName) {
  return cardName
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 50);
}

/**
 * Fetch card data from YGOPro API
 */
async function fetchCardData() {
  console.log('🔄 Fetching card data for validation...');
  
  try {
    const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php');
    const data = await response.json();
    const cardsWithImages = data.data.filter(card => 
      card.card_images && card.card_images.length > 0
    );
    
    console.log(`✅ Found ${cardsWithImages.length} cards with images to validate`);
    return cardsWithImages;
  } catch (error) {
    console.error('❌ Failed to fetch card data:', error.message);
    throw error;
  }
}

/**
 * Get all images from Blob storage
 */
async function getBlobImages() {
  console.log('🔄 Fetching images from Blob storage...');
  
  try {
    const { blobs } = await list({ prefix: CONFIG.STORAGE_PREFIX });
    console.log(`✅ Found ${blobs.length} images in Blob storage`);
    return blobs;
  } catch (error) {
    console.error('❌ Failed to fetch Blob images:', error.message);
    throw error;
  }
}

/**
 * Validate storage structure and file naming
 */
function validateStorageStructure(blobs) {
  console.log('🔄 Validating storage structure...');
  
  const structureMap = new Map();
  
  blobs.forEach(blob => {
    const parts = blob.pathname.split('/');
    
    // Check structure: should be cards/{filename}.webp
    if (parts.length !== 2 || parts[0] !== CONFIG.STORAGE_PREFIX) {
      validation.structureIssues.push({
        path: blob.pathname,
        issue: 'Invalid path structure',
        expected: `${CONFIG.STORAGE_PREFIX}/{filename}.webp`
      });
      return;
    }
    
    const filename = parts[1];
    
    // Check file extension
    if (!filename.endsWith('.webp')) {
      validation.structureIssues.push({
        path: blob.pathname,
        issue: 'Invalid file extension',
        expected: '.webp'
      });
      return;
    }
    
    // Parse filename to get card name and size
    const baseName = filename.replace(/(-small)?\.webp$/, '');
    const isSmall = filename.includes('-small.webp');
    const size = isSmall ? 'small' : 'full';
    
    if (!structureMap.has(baseName)) {
      structureMap.set(baseName, { full: false, small: false });
    }
    
    structureMap.get(baseName)[size] = true;
    validation.found.bySize[size]++;
    validation.found.totalSize += blob.size;
  });
  
  // Check for incomplete sets (missing size variants)
  structureMap.forEach((sizes, cardName) => {
    if (!sizes.full || !sizes.small) {
      validation.structureIssues.push({
        cardName,
        issue: 'Missing size variant',
        missing: sizes.full ? 'small' : sizes.small ? 'full' : 'both'
      });
    } else {
      validation.found.cards.add(cardName);
    }
  });
  
  console.log(`✅ Structure validation complete. Found ${validation.found.cards.size} complete card sets`);
  return structureMap;
}

/**
 * Compare expected cards vs found images
 */
function validateCompleteness(cards, structureMap) {
  console.log('🔄 Validating migration completeness...');
  
  validation.total.cards = cards.length;
  validation.total.expectedImages = cards.length * 2; // full + small
  validation.total.foundImages = validation.found.bySize.full + validation.found.bySize.small;
  
  cards.forEach(card => {
    const sanitizedName = sanitizeCardName(card.name);
    
    if (!structureMap.has(sanitizedName)) {
      validation.missing.push({
        cardId: card.id,
        name: card.name,
        sanitizedName,
        reason: 'Not found in Blob storage'
      });
    }
  });
  
  console.log(`✅ Completeness check: ${validation.total.foundImages}/${validation.total.expectedImages} images found`);
}

/**
 * Test image accessibility and quality
 */
async function testImageAccessibility(blobs) {
  console.log(`🔄 Testing accessibility of ${CONFIG.SAMPLE_SIZE} sample images...`);
  
  // Select random sample
  const sampleBlobs = blobs
    .sort(() => 0.5 - Math.random())
    .slice(0, CONFIG.SAMPLE_SIZE);
  
  const testPromises = sampleBlobs.map(async (blob, index) => {
    try {
      const response = await fetch(blob.url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      const size = buffer.byteLength;
      
      // Basic quality check - WebP images should be reasonably sized
      if (size < CONFIG.EXPECTED_QUALITY_MIN_SIZE) {
        validation.qualityIssues.push({
          path: blob.pathname,
          url: blob.url,
          size,
          issue: 'Unusually small file size - possible quality issue'
        });
      }
      
      validation.accessible.push({
        path: blob.pathname,
        url: blob.url,
        size,
        status: 'accessible'
      });
      
      // Progress logging
      if ((index + 1) % 10 === 0) {
        console.log(`   Tested ${index + 1}/${sampleBlobs.length} images...`);
      }
      
    } catch (error) {
      validation.inaccessible.push({
        path: blob.pathname,
        url: blob.url,
        error: error.message
      });
    }
  });
  
  await Promise.all(testPromises);
  
  console.log(`✅ Accessibility test complete: ${validation.accessible.length}/${sampleBlobs.length} accessible`);
}

/**
 * Generate comprehensive validation report
 */
function generateReport() {
  const duration = (Date.now() - validation.startTime) / 1000;
  const sizeMB = (validation.found.totalSize / 1024 / 1024).toFixed(2);
  
  const report = {
    summary: {
      timestamp: new Date().toISOString(),
      duration: `${duration.toFixed(1)}s`,
      totalStorageMB: sizeMB,
      validation: {
        expectedCards: validation.total.cards,
        foundCards: validation.found.cards.size,
        expectedImages: validation.total.expectedImages,
        foundImages: validation.total.foundImages,
        completeness: `${Math.round((validation.found.cards.size / validation.total.cards) * 100)}%`,
        accessibility: validation.accessible.length > 0 ? 
          `${Math.round((validation.accessible.length / (validation.accessible.length + validation.inaccessible.length)) * 100)}%` : 'N/A'
      }
    },
    results: {
      missingCards: validation.missing.length,
      structureIssues: validation.structureIssues.length,
      qualityIssues: validation.qualityIssues.length,
      inaccessibleImages: validation.inaccessible.length
    },
    details: {
      missing: validation.missing.slice(0, 20), // Limit for readability
      structureIssues: validation.structureIssues.slice(0, 20),
      qualityIssues: validation.qualityIssues.slice(0, 20),
      inaccessible: validation.inaccessible.slice(0, 20),
      accessible: validation.accessible.slice(0, 10) // Sample of successful tests
    },
    sizes: {
      fullSize: validation.found.bySize.full,
      smallSize: validation.found.bySize.small,
      totalStorageBytes: validation.found.totalSize
    }
  };
  
  const outputPath = join(__dirname, 'validation-report-final.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  
  console.log(`📄 Validation report saved to: ${outputPath}`);
  return report;
}

/**
 * Main validation function
 */
async function validate() {
  console.log('🚀 Starting Yu-Gi-Oh Card Image Migration Validation');
  console.log(`📋 Validation Configuration:
  - Expected format: WebP
  - Expected sizes: Full (~420x614px) and Small (168x245px)
  - Storage prefix: ${CONFIG.STORAGE_PREFIX}
  - Sample test size: ${CONFIG.SAMPLE_SIZE} images
  `);
  
  try {
    // Verify environment
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required');
    }
    
    // Fetch reference data and blob images
    const [cards, blobs] = await Promise.all([
      fetchCardData(),
      getBlobImages()
    ]);
    
    // Validate storage structure
    const structureMap = validateStorageStructure(blobs);
    
    // Validate completeness
    validateCompleteness(cards, structureMap);
    
    // Test accessibility (with sample)
    if (blobs.length > 0) {
      await testImageAccessibility(blobs);
    }
    
    // Generate and display report
    const report = generateReport();
    
    console.log(`
🎉 Validation Complete!
📊 Summary:
  - Cards found: ${report.summary.validation.foundCards}/${report.summary.validation.expectedCards} (${report.summary.validation.completeness})
  - Images found: ${report.summary.validation.foundImages}/${report.summary.validation.expectedImages}
  - Full size images: ${report.sizes.fullSize}
  - Small size images: ${report.sizes.smallSize}
  - Total storage: ${report.summary.totalStorageMB}MB
  - Missing cards: ${report.results.missingCards}
  - Structure issues: ${report.results.structureIssues}
  - Quality issues: ${report.results.qualityIssues}
  - Accessibility: ${report.summary.validation.accessibility}
  - Duration: ${report.summary.duration}
    `);
    
    // Validation status
    const hasIssues = report.results.missingCards > 0 || 
                     report.results.structureIssues > 0 || 
                     report.results.qualityIssues > 0 ||
                     report.results.inaccessibleImages > 0;
    
    if (hasIssues) {
      console.log('⚠️  Validation completed with issues. Check validation-report-final.json for details.');
      return false;
    } else {
      console.log('✅ Validation passed! Migration was successful.');
      return true;
    }
    
  } catch (error) {
    console.error('💥 Validation failed:', error.message);
    process.exit(1);
  }
}

// Export for testing
module.exports = {
  validate,
  sanitizeCardName,
  validateStorageStructure,
  testImageAccessibility
};

// Run validation if script is executed directly
if (require.main === module) {
  validate();
}