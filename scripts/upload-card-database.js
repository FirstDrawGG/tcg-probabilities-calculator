const fetch = require('node-fetch');
const { put } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

/**
 * Upload full card database to Vercel Blob Storage
 * This script fetches the complete card database from YGOPro API
 * and uploads it to Vercel Blob for fast, reliable access
 */

async function uploadCardDatabase() {
  console.log('🚀 Starting card database upload to Vercel Blob...\n');

  // Check for Blob token
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found in environment variables');
    console.error('   Please add it to your .env.local file or set it in your environment');
    process.exit(1);
  }

  try {
    // Step 1: Fetch full card database from YGOPro API
    console.log('📥 Fetching full card database from YGOPro API...');
    const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php');

    if (!response.ok) {
      throw new Error(`YGOPro API returned ${response.status}: ${response.statusText}`);
    }

    const apiData = await response.json();
    const cards = apiData.data || [];

    console.log(`✅ Fetched ${cards.length} cards from YGOPro API\n`);

    // Step 2: Calculate file size
    const jsonString = JSON.stringify(apiData, null, 2);
    const sizeInBytes = Buffer.byteLength(jsonString, 'utf8');
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

    console.log(`📊 Database Statistics:`);
    console.log(`   - Total cards: ${cards.length}`);
    console.log(`   - File size: ${sizeInMB} MB`);
    console.log(`   - Format: JSON with full metadata\n`);

    // Step 3: Save locally for backup
    const localPath = path.join(__dirname, '..', 'public', 'cardDatabase-full.json');
    fs.writeFileSync(localPath, jsonString);
    console.log(`💾 Saved local backup: ${localPath}\n`);

    // Step 4: Upload to Vercel Blob
    console.log('☁️  Uploading to Vercel Blob Storage...');

    const blob = await put('cardDatabase-full.json', jsonString, {
      access: 'public',
      contentType: 'application/json',
      token: blobToken,
      addRandomSuffix: false // Keep consistent filename
    });

    console.log('\n🎉 Upload successful!\n');
    console.log('📍 Blob URL:', blob.url);
    console.log('📦 Size:', sizeInMB, 'MB');
    console.log('🔗 Public URL:', blob.url);

    // Step 5: Verify upload
    console.log('\n🔍 Verifying upload...');
    const verifyResponse = await fetch(blob.url);
    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      console.log(`✅ Verification passed: ${verifyData.data.length} cards accessible`);
    } else {
      console.warn('⚠️  Warning: Could not verify upload immediately (may take a moment to propagate)');
    }

    // Step 6: Show integration instructions
    console.log('\n📝 Next Steps:');
    console.log('   1. Update CardDatabaseService.fetchCards() in src/App.jsx');
    console.log('   2. Test the implementation with: npm run dev');
    console.log('   3. Deploy to production\n');

    console.log('💡 Blob URL to use in code:');
    console.log(`   ${blob.url}\n`);

    return blob;

  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);

    if (error.message.includes('BLOB_READ_WRITE_TOKEN')) {
      console.error('\n💡 Make sure you have set up your Vercel Blob token:');
      console.error('   1. Go to your Vercel project dashboard');
      console.error('   2. Navigate to Storage > Create > Blob');
      console.error('   3. Copy the token to .env.local');
    }

    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  uploadCardDatabase()
    .then(() => {
      console.log('✨ All done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { uploadCardDatabase };