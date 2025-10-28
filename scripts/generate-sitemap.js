/**
 * Sitemap Generator for FirstDrawGG
 * Generates sitemap.xml with current date and proper structure
 *
 * Usage: node scripts/generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DOMAIN = 'https://www.firstdrawgg.online';
const OUTPUT_PATH = path.join(__dirname, '../public/sitemap.xml');

// Get current date in ISO 8601 format (YYYY-MM-DD)
const getCurrentDate = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

// Define all pages with their metadata
const pages = [
  {
    path: '/',
    priority: 1.0,
    changefreq: 'weekly',
    description: 'Homepage - TCG Probabilities Calculator'
  }
  // Future pages can be added here:
  // {
  //   path: '/help',
  //   priority: 0.7,
  //   changefreq: 'monthly',
  //   description: 'Help and documentation'
  // },
  // {
  //   path: '/about',
  //   priority: 0.5,
  //   changefreq: 'monthly',
  //   description: 'About page'
  // },
  // {
  //   path: '/privacy',
  //   priority: 0.3,
  //   changefreq: 'yearly',
  //   description: 'Privacy policy'
  // },
  // {
  //   path: '/terms',
  //   priority: 0.3,
  //   changefreq: 'yearly',
  //   description: 'Terms of service'
  // }
];

// Generate XML for a single URL entry
const generateUrlEntry = (page, lastmod) => {
  return `  <url>
    <loc>${DOMAIN}${page.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
};

// Generate complete sitemap XML
const generateSitemap = () => {
  const lastmod = getCurrentDate();
  const urlEntries = pages.map(page => generateUrlEntry(page, lastmod)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;
};

// Main execution
const main = () => {
  try {
    console.log('🗺️  Generating sitemap.xml...\n');

    const sitemap = generateSitemap();

    // Ensure public directory exists
    const publicDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Write sitemap to file
    fs.writeFileSync(OUTPUT_PATH, sitemap, 'utf8');

    console.log('✅ Sitemap generated successfully!');
    console.log(`📍 Location: ${OUTPUT_PATH}`);
    console.log(`📊 Total URLs: ${pages.length}`);
    console.log(`📅 Last Modified: ${getCurrentDate()}\n`);

    // Display generated URLs
    console.log('Generated URLs:');
    pages.forEach(page => {
      console.log(`  - ${DOMAIN}${page.path} (priority: ${page.priority})`);
    });

  } catch (error) {
    console.error('❌ Error generating sitemap:', error.message);
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { generateSitemap, pages };
