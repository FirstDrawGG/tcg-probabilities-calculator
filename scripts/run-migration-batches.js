#!/usr/bin/env node

/**
 * Background Migration Runner
 * 
 * Runs the migration in multiple sequential calls to avoid timeouts
 * Each call processes ~500-1000 cards, then exits and restarts
 */

require('dotenv').config({ path: '.env.local' });

const { exec } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const BATCH_TIMEOUT = 4 * 60 * 1000; // 4 minutes per batch
const MAX_BATCHES = 30; // Maximum batches to run (should cover all remaining cards)

let currentBatch = 1;

function runBatch() {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Starting batch ${currentBatch}/${MAX_BATCHES}...`);
    
    const process = exec(
      'node scripts/continue-migration.js',
      { 
        cwd: __dirname + '/..',
        timeout: BATCH_TIMEOUT
      },
      (error, stdout, stderr) => {
        if (error && error.signal !== 'SIGTERM') {
          console.error(`❌ Batch ${currentBatch} failed:`, error.message);
          reject(error);
          return;
        }
        
        console.log(`✅ Batch ${currentBatch} completed (or timed out gracefully)`);
        resolve();
      }
    );
    
    // Stream output in real-time
    process.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    process.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}

async function checkProgress() {
  const resultsFile = join(__dirname, 'continue-migration-results.json');
  if (existsSync(resultsFile)) {
    try {
      const results = JSON.parse(readFileSync(resultsFile, 'utf8'));
      console.log(`📊 Current progress: ${results.summary.processed} cards processed, ${results.summary.failed} failed`);
      return results.summary.processed;
    } catch (e) {
      console.log('⚠️  Could not read results file');
    }
  }
  return 0;
}

async function runMigration() {
  console.log('🚀 Starting background migration runner...');
  console.log(`Will run up to ${MAX_BATCHES} batches, ${BATCH_TIMEOUT/1000}s each`);
  
  let totalProcessed = 0;
  
  try {
    for (currentBatch = 1; currentBatch <= MAX_BATCHES; currentBatch++) {
      await runBatch();
      
      const newProgress = await checkProgress();
      if (newProgress === totalProcessed) {
        console.log('🎉 No new cards processed - migration appears complete!');
        break;
      }
      
      totalProcessed = newProgress;
      console.log(`📈 Total progress: ${totalProcessed} cards processed`);
      
      // Short break between batches
      console.log('⏸️  Brief pause before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\n🎉 Migration runner completed!`);
    console.log(`📊 Final stats: ${totalProcessed} cards processed across ${currentBatch - 1} batches`);
    
  } catch (error) {
    console.error('💥 Migration runner failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration();
}