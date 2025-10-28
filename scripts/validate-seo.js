/**
 * SEO Validation Script
 * Validates sitemap.xml and robots.txt for correctness
 *
 * Usage: node scripts/validate-seo.js
 */

const fs = require('fs');
const path = require('path');

// File paths
const SITEMAP_PATH = path.join(__dirname, '../public/sitemap.xml');
const ROBOTS_PATH = path.join(__dirname, '../public/robots.txt');
const DIST_SITEMAP_PATH = path.join(__dirname, '../dist/sitemap.xml');
const DIST_ROBOTS_PATH = path.join(__dirname, '../dist/robots.txt');

// Configuration
const DOMAIN = 'https://www.firstdrawgg.online';
const MAX_URLS = 50000;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Validation results
const errors = [];
const warnings = [];
const success = [];

// Helper functions
const addError = (message) => errors.push(`❌ ${message}`);
const addWarning = (message) => warnings.push(`⚠️  ${message}`);
const addSuccess = (message) => success.push(`✅ ${message}`);

// Validate file exists
const validateFileExists = (filePath, name) => {
  if (!fs.existsSync(filePath)) {
    addError(`${name} not found at: ${filePath}`);
    return false;
  }
  addSuccess(`${name} exists`);
  return true;
};

// Validate file size
const validateFileSize = (filePath, name) => {
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    addError(`${name} exceeds 50MB limit (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
    return false;
  }
  addSuccess(`${name} size is acceptable (${(stats.size / 1024).toFixed(2)}KB)`);
  return true;
};

// Validate XML structure
const validateXMLStructure = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');

  // Check for XML declaration
  if (!content.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    addError('XML declaration missing or incorrect');
    return false;
  }
  addSuccess('XML declaration is correct');

  // Check for urlset element
  if (!content.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) {
    addError('Missing or incorrect urlset namespace');
    return false;
  }
  addSuccess('XML namespace is correct');

  // Check for closing tags
  if (!content.includes('</urlset>')) {
    addError('Missing closing urlset tag');
    return false;
  }

  // Basic XML structure validation
  const openTags = (content.match(/<url>/g) || []).length;
  const closeTags = (content.match(/<\/url>/g) || []).length;
  if (openTags !== closeTags) {
    addError(`Mismatched <url> tags: ${openTags} opening, ${closeTags} closing`);
    return false;
  }
  addSuccess(`XML structure is valid (${openTags} URLs)`);

  return true;
};

// Validate sitemap URLs
const validateSitemapURLs = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const urlMatches = content.match(/<loc>(.*?)<\/loc>/g) || [];
  const urls = urlMatches.map(match => match.replace(/<\/?loc>/g, ''));

  if (urls.length === 0) {
    addError('No URLs found in sitemap');
    return false;
  }

  if (urls.length > MAX_URLS) {
    addError(`Sitemap contains ${urls.length} URLs (max: ${MAX_URLS})`);
    return false;
  }

  addSuccess(`Sitemap contains ${urls.length} URL(s)`);

  // Validate each URL
  let validUrls = 0;
  urls.forEach((url, index) => {
    // Check protocol
    if (!url.startsWith('https://')) {
      addWarning(`URL ${index + 1} doesn't use HTTPS: ${url}`);
    }

    // Check domain
    if (!url.startsWith(DOMAIN)) {
      addWarning(`URL ${index + 1} uses different domain: ${url}`);
    }

    // Check for non-ASCII characters
    if (!/^[\x00-\x7F]*$/.test(url)) {
      addError(`URL ${index + 1} contains non-ASCII characters: ${url}`);
    } else {
      validUrls++;
    }
  });

  addSuccess(`${validUrls}/${urls.length} URLs are valid`);
  return validUrls === urls.length;
};

// Validate lastmod dates
const validateLastmodDates = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lastmodMatches = content.match(/<lastmod>(.*?)<\/lastmod>/g) || [];
  const dates = lastmodMatches.map(match => match.replace(/<\/?lastmod>/g, ''));

  if (dates.length === 0) {
    addWarning('No lastmod dates found (optional but recommended)');
    return true;
  }

  // ISO 8601 date format: YYYY-MM-DD
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}$/;
  let validDates = 0;

  dates.forEach((date, index) => {
    if (!iso8601Regex.test(date)) {
      addError(`Invalid lastmod date format at position ${index + 1}: ${date}`);
    } else {
      validDates++;
    }
  });

  addSuccess(`${validDates}/${dates.length} lastmod dates are in ISO 8601 format`);
  return validDates === dates.length;
};

// Validate priority values
const validatePriorities = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const priorityMatches = content.match(/<priority>(.*?)<\/priority>/g) || [];
  const priorities = priorityMatches.map(match => match.replace(/<\/?priority>/g, ''));

  if (priorities.length === 0) {
    addWarning('No priority values found (optional)');
    return true;
  }

  let validPriorities = 0;
  priorities.forEach((priority, index) => {
    const value = parseFloat(priority);
    if (isNaN(value) || value < 0.0 || value > 1.0) {
      addError(`Invalid priority value at position ${index + 1}: ${priority} (must be 0.0-1.0)`);
    } else {
      validPriorities++;
    }
  });

  addSuccess(`${validPriorities}/${priorities.length} priority values are valid`);
  return validPriorities === priorities.length;
};

// Validate changefreq values
const validateChangefreq = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const changefreqMatches = content.match(/<changefreq>(.*?)<\/changefreq>/g) || [];
  const changefreqs = changefreqMatches.map(match => match.replace(/<\/?changefreq>/g, ''));

  if (changefreqs.length === 0) {
    addWarning('No changefreq values found (optional)');
    return true;
  }

  const validValues = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
  let validChangefreqs = 0;

  changefreqs.forEach((freq, index) => {
    if (!validValues.includes(freq)) {
      addError(`Invalid changefreq value at position ${index + 1}: ${freq}`);
    } else {
      validChangefreqs++;
    }
  });

  addSuccess(`${validChangefreqs}/${changefreqs.length} changefreq values are valid`);
  return validChangefreqs === changefreqs.length;
};

// Validate robots.txt
const validateRobotsTxt = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');

  // Check for User-agent
  if (!content.includes('User-agent:')) {
    addError('robots.txt missing User-agent directive');
    return false;
  }
  addSuccess('robots.txt contains User-agent directive');

  // Check for sitemap reference
  if (!content.includes('Sitemap:')) {
    addWarning('robots.txt missing Sitemap reference (recommended)');
  } else {
    addSuccess('robots.txt contains Sitemap reference');
  }

  // Verify sitemap URL
  const sitemapMatch = content.match(/Sitemap:\s*(.+)/);
  if (sitemapMatch) {
    const sitemapUrl = sitemapMatch[1].trim();
    if (sitemapUrl !== `${DOMAIN}/sitemap.xml`) {
      addWarning(`Sitemap URL might be incorrect: ${sitemapUrl}`);
    } else {
      addSuccess('Sitemap URL is correct');
    }
  }

  // Check for BOM (byte order mark)
  if (content.charCodeAt(0) === 0xFEFF) {
    addError('robots.txt contains BOM (byte order mark) - remove it');
    return false;
  }

  return true;
};

// Main validation function
const validate = () => {
  console.log('🔍 Validating SEO files...\n');

  console.log('=== Sitemap.xml Validation ===\n');

  // Validate public/sitemap.xml
  if (validateFileExists(SITEMAP_PATH, 'sitemap.xml')) {
    validateFileSize(SITEMAP_PATH, 'sitemap.xml');
    validateXMLStructure(SITEMAP_PATH);
    validateSitemapURLs(SITEMAP_PATH);
    validateLastmodDates(SITEMAP_PATH);
    validatePriorities(SITEMAP_PATH);
    validateChangefreq(SITEMAP_PATH);
  }

  console.log('\n=== Robots.txt Validation ===\n');

  // Validate public/robots.txt
  if (validateFileExists(ROBOTS_PATH, 'robots.txt')) {
    validateFileSize(ROBOTS_PATH, 'robots.txt');
    validateRobotsTxt(ROBOTS_PATH);
  }

  console.log('\n=== Build Output Validation ===\n');

  // Check if dist files exist (optional - only if build has been run)
  const distExists = fs.existsSync(path.join(__dirname, '../dist'));
  if (distExists) {
    validateFileExists(DIST_SITEMAP_PATH, 'dist/sitemap.xml');
    validateFileExists(DIST_ROBOTS_PATH, 'dist/robots.txt');
  } else {
    addWarning('dist/ directory not found - run "npm run build" to verify build output');
  }

  // Print results
  console.log('\n=== Validation Results ===\n');

  if (success.length > 0) {
    console.log('✅ Passed Checks:\n');
    success.forEach(msg => console.log(`   ${msg}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:\n');
    warnings.forEach(msg => console.log(`   ${msg}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ Errors:\n');
    errors.forEach(msg => console.log(`   ${msg}`));
  }

  console.log('\n=== Summary ===\n');
  console.log(`✅ Passed: ${success.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);
  console.log(`❌ Errors: ${errors.length}\n`);

  // Exit with error code if validation failed
  if (errors.length > 0) {
    console.log('❌ Validation failed!\n');
    process.exit(1);
  } else {
    console.log('✅ Validation successful!\n');
    process.exit(0);
  }
};

// Run validation
if (require.main === module) {
  validate();
}

module.exports = { validate };
