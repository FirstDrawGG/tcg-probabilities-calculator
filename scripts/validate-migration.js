#!/usr/bin/env node

/**
 * Migration Validation Script
 * 
 * This script validates that card images have been successfully migrated to Vercel Blob Storage.
 * It checks for completeness, quality, and accessibility of uploaded images.
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
  EXPECTED_FORMATS: ['webp', 'jpg'],
  EXPECTED_SIZES: ['full', 'small'],
  SAMPLE_SIZE: 100, // Number of images to test for accessibility
  MAX_CONCURRENT_TESTS: 10, // Limit concurrent HTTP requests
};

// Validation state
const validation = {
  total: {
    cards: 0,
    images: 0,
    expected: 0
  },
  found: {
    cards: new Set(),
    byFormat: {},
    bySize: {}
  },
  missing: [],
  broken: [],
  accessible: [],
  inaccessible: [],
  startTime: Date.now()
};

/**
 * Initialize validation counters
 */
function initializeValidation() {
  CONFIG.EXPECTED_FORMATS.forEach(format => {
    validation.found.byFormat[format] = 0;
  });
  
  CONFIG.EXPECTED_SIZES.forEach(size => {
    validation.found.bySize[size] = 0;
  });
}

/**
 * Fetch all cards from YGOPro API to get expected count
 */
async function fetchExpectedCards() {
  console.log('🔄 Fetching card data to determine expected count...');
  
  try {
    const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php');
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const cards = data.data || [];
    const cardsWithImages = cards.filter(card => card.card_images && card.card_images.length > 0);
    
    validation.total.cards = cardsWithImages.length;
    validation.total.expected = cardsWithImages.length * CONFIG.EXPECTED_FORMATS.length * CONFIG.EXPECTED_SIZES.length;
    
    console.log(`✅ Expected: ${validation.total.cards} cards with images`);
    console.log(`✅ Expected: ${validation.total.expected} total image files`);
    
    return cardsWithImages.map(card => ({
      id: card.id.toString(),
      name: card.name
    }));
  } catch (error) {
    console.error('❌ Failed to fetch expected cards:', error.message);
    throw error;
  }
}

/**
 * List all images in Blob storage
 */
async function listBlobImages() {
  console.log('🔄 Listing images in Blob storage...');
  
  try {
    const { blobs } = await list({ prefix: CONFIG.STORAGE_PREFIX });
    
    validation.total.images = blobs.length;
    
    // Parse blob information
    blobs.forEach(blob => {
      const pathParts = blob.pathname.split('/');
      
      if (pathParts.length >= 3) {
        const size = pathParts[pathParts.length - 2];
        const filename = pathParts[pathParts.length - 1];
        const [cardId, format] = filename.split('.');
        
        if (cardId && format) {
          validation.found.cards.add(cardId);
          
          if (validation.found.byFormat[format]) {
            validation.found.byFormat[format]++;
          }
          
          if (validation.found.bySize[size]) {
            validation.found.bySize[size]++;
          }
        }
      }
    });
    
    console.log(`✅ Found: ${validation.total.images} total image files`);
    console.log(`✅ Found: ${validation.found.cards.size} unique cards`);
    
    return blobs;
  } catch (error) {
    console.error('❌ Failed to list blob images:', error.message);
    throw error;
  }
}

/**
 * Find missing images by comparing expected vs found
 */
function findMissingImages(expectedCards, foundBlobs) {
  console.log('🔄 Checking for missing images...');
  
  const foundPaths = new Set(foundBlobs.map(blob => blob.pathname));
  
  expectedCards.forEach(card => {
    CONFIG.EXPECTED_SIZES.forEach(size => {
      CONFIG.EXPECTED_FORMATS.forEach(format => {
        const expectedPath = `${CONFIG.STORAGE_PREFIX}/${size}/${card.id}.${format}`;
        
        if (!foundPaths.has(expectedPath)) {
          validation.missing.push({
            cardId: card.id,
            cardName: card.name,
            path: expectedPath,
            size,
            format
          });
        }
      });
    });
  });
  
  console.log(`${validation.missing.length > 0 ? '⚠️' : '✅'} Missing images: ${validation.missing.length}`);
}

/**
 * Test accessibility of a sample of images
 */
async function testImageAccessibility(blobs) {
  console.log(`🔄 Testing accessibility of ${Math.min(CONFIG.SAMPLE_SIZE, blobs.length)} sample images...`);
  
  // Take a random sample
  const sample = blobs
    .sort(() => Math.random() - 0.5)
    .slice(0, CONFIG.SAMPLE_SIZE);
  
  // Test images in batches to avoid overwhelming the server
  const batchSize = CONFIG.MAX_CONCURRENT_TESTS;
  
  for (let i = 0; i < sample.length; i += batchSize) {
    const batch = sample.slice(i, i + batchSize);
    
    const promises = batch.map(async (blob) => {
      try {
        const response = await fetch(blob.url, { method: 'HEAD' });
        
        if (response.ok) {
          validation.accessible.push({
            url: blob.url,
            pathname: blob.pathname,
            size: response.headers.get('content-length')
          });
        } else {
          validation.inaccessible.push({
            url: blob.url,
            pathname: blob.pathname,
            status: response.status,
            statusText: response.statusText
          });
        }
      } catch (error) {
        validation.broken.push({
          url: blob.url,
          pathname: blob.pathname,
          error: error.message
        });
      }
    });
    
    await Promise.all(promises);
    
    // Progress update
    if (i + batchSize < sample.length) {
      console.log(`📊 Tested ${Math.min(i + batchSize, sample.length)}/${sample.length} images...`);
    }
  }
  
  console.log(`✅ Accessible: ${validation.accessible.length}`);
  console.log(`${validation.inaccessible.length > 0 ? '⚠️' : '✅'} Inaccessible: ${validation.inaccessible.length}`);
  console.log(`${validation.broken.length > 0 ? '❌' : '✅'} Broken: ${validation.broken.length}`);
}

/**
 * Calculate storage size estimate
 */
function calculateStorageStats(blobs) {
  console.log('🔄 Calculating storage statistics...');
  
  let totalSize = 0;
  const sizeBuckets = {
    'under-10kb': 0,
    '10-50kb': 0,
    '50-100kb': 0,
    'over-100kb': 0
  };
  
  blobs.forEach(blob => {
    const size = blob.size || 0;
    totalSize += size;
    
    if (size < 10 * 1024) {
      sizeBuckets['under-10kb']++;
    } else if (size < 50 * 1024) {
      sizeBuckets['10-50kb']++;
    } else if (size < 100 * 1024) {
      sizeBuckets['50-100kb']++;
    } else {
      sizeBuckets['over-100kb']++;
    }
  });
  
  const totalGB = totalSize / (1024 * 1024 * 1024);
  const monthlyCost = totalGB * 0.15; // $0.15 per GB per month
  
  console.log(`📊 Total storage: ${totalGB.toFixed(2)} GB`);
  console.log(`💰 Estimated monthly cost: $${monthlyCost.toFixed(2)}`);
  
  return {
    totalSize,
    totalGB,
    monthlyCost,
    sizeBuckets
  };
}

/**
 * Generate validation report
 */
function generateReport(expectedCards, storageStats) {
  const duration = (Date.now() - validation.startTime) / 1000;
  
  const report = {
    summary: {
      timestamp: new Date().toISOString(),
      duration: Math.round(duration),
      validation: 'PASSED', // Will be updated based on issues
      totalCards: validation.total.cards,
      expectedImages: validation.total.expected,
      foundImages: validation.total.images,
      uniqueCards: validation.found.cards.size,
      completeness: Math.round((validation.total.images / validation.total.expected) * 100),
      storage: storageStats
    },
    breakdown: {
      byFormat: validation.found.byFormat,
      bySize: validation.found.bySize
    },
    issues: {
      missing: validation.missing.length,
      inaccessible: validation.inaccessible.length,
      broken: validation.broken.length
    },
    details: {
      missing: validation.missing.slice(0, 50), // Limit to avoid huge reports
      inaccessible: validation.inaccessible,
      broken: validation.broken,
      accessible: validation.accessible.slice(0, 10) // Sample
    }
  };
  
  // Determine overall validation status
  if (validation.missing.length > validation.total.expected * 0.01) { // More than 1% missing
    report.summary.validation = 'FAILED';
  } else if (validation.inaccessible.length > 0 || validation.broken.length > 0) {
    report.summary.validation = 'WARNING';
  }
  
  return report;
}

/**
 * Save validation report to file
 */
function saveReport(report) {
  const outputPath = join(__dirname, 'validation-report.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  
  console.log(`📄 Validation report saved to: ${outputPath}`);
  return outputPath;
}

/**
 * Main validation function
 */
async function validateMigration() {
  console.log('🚀 Starting migration validation...');
  
  try {
    // Check environment
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required');
    }
    
    // Initialize
    initializeValidation();
    
    // Get expected cards
    const expectedCards = await fetchExpectedCards();
    
    // List actual blob images
    const blobs = await listBlobImages();
    
    // Find missing images
    findMissingImages(expectedCards, blobs);
    
    // Test accessibility
    await testImageAccessibility(blobs);
    
    // Calculate storage stats
    const storageStats = calculateStorageStats(blobs);
    
    // Generate report
    const report = generateReport(expectedCards, storageStats);
    
    // Save report
    saveReport(report);
    
    // Summary
    console.log(`
🎉 Validation completed!

📊 Summary:
  - Status: ${report.summary.validation}
  - Completeness: ${report.summary.completeness}%
  - Cards found: ${report.summary.uniqueCards}/${report.summary.totalCards}
  - Images found: ${report.summary.foundImages}/${report.summary.expectedImages}
  - Storage used: ${report.summary.storage.totalGB.toFixed(2)} GB
  - Monthly cost: $${report.summary.storage.monthlyCost.toFixed(2)}

🔍 Issues:
  - Missing images: ${report.issues.missing}
  - Inaccessible images: ${report.issues.inaccessible}
  - Broken images: ${report.issues.broken}
    `);
    
    if (report.summary.validation === 'FAILED') {
      console.log('❌ Validation FAILED - significant issues found');
      process.exit(1);
    } else if (report.summary.validation === 'WARNING') {
      console.log('⚠️  Validation completed with warnings');
    } else {
      console.log('✅ Validation PASSED - migration successful!');
    }
    
  } catch (error) {
    console.error('💥 Validation failed:', error.message);
    process.exit(1);
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  validateMigration();
}

module.exports = { validateMigration, testImageAccessibility };