# SEO Maintenance Guide

This guide provides instructions for maintaining the sitemap.xml, robots.txt, and SEO foundation for FirstDrawGG.

## Table of Contents

- [Overview](#overview)
- [Files and Locations](#files-and-locations)
- [Automated Sitemap Generation](#automated-sitemap-generation)
- [Manual Updates](#manual-updates)
- [Adding New Pages](#adding-new-pages)
- [Build Process](#build-process)
- [Validation and Testing](#validation-and-testing)
- [Troubleshooting](#troubleshooting)
- [Post-Deployment Checklist](#post-deployment-checklist)

## Overview

FirstDrawGG uses an automated sitemap generation system that:
- Generates `sitemap.xml` with current dates during each build
- Maintains `robots.txt` for crawler instructions
- Automatically copies both files to the production build output
- Supports extensible page structure for future growth

## Files and Locations

### Source Files
- **Sitemap Generator**: `scripts/generate-sitemap.js`
- **Robots.txt**: `public/robots.txt` (static file)
- **Generated Sitemap**: `public/sitemap.xml` (auto-generated)

### Build Output
- Both files are automatically copied to `dist/` during build
- Accessible at root domain: `/sitemap.xml` and `/robots.txt`

## Automated Sitemap Generation

The sitemap is automatically regenerated during each build with updated timestamps.

### Generate Sitemap Manually

```bash
npm run build:sitemap
```

This command:
- Reads page definitions from `scripts/generate-sitemap.js`
- Generates `public/sitemap.xml` with current date
- Outputs summary of generated URLs

### Sitemap Configuration

All page definitions are in `scripts/generate-sitemap.js`:

```javascript
const pages = [
  {
    path: '/',
    priority: 1.0,
    changefreq: 'weekly',
    description: 'Homepage - TCG Probabilities Calculator'
  }
];
```

## Manual Updates

### Updating robots.txt

To modify crawler rules:

1. Open `public/robots.txt`
2. Make changes following robots.txt syntax
3. Test locally: `npm run build` and check `dist/robots.txt`
4. Deploy changes

**Common modifications:**
```
# Allow specific bot
User-agent: Googlebot
Allow: /

# Block specific directory
Disallow: /private/

# Add additional sitemap
Sitemap: https://www.firstdrawgg.online/sitemap-images.xml
```

### Updating Sitemap Structure

To modify the sitemap structure:

1. Open `scripts/generate-sitemap.js`
2. Modify the `pages` array or generation logic
3. Run `npm run build:sitemap` to test
4. Verify output in `public/sitemap.xml`
5. Commit changes

## Adding New Pages

### Step-by-Step Process

1. **Add page definition to generator:**

   Edit `scripts/generate-sitemap.js`:

   ```javascript
   const pages = [
     {
       path: '/',
       priority: 1.0,
       changefreq: 'weekly',
       description: 'Homepage'
     },
     {
       path: '/help',
       priority: 0.7,
       changefreq: 'monthly',
       description: 'Help and documentation'
     },
     // Add new page here
     {
       path: '/about',
       priority: 0.5,
       changefreq: 'monthly',
       description: 'About page'
     }
   ];
   ```

2. **Generate and verify:**

   ```bash
   npm run build:sitemap
   cat public/sitemap.xml
   ```

3. **Test build process:**

   ```bash
   npm run build
   ls -la dist/sitemap.xml
   ```

4. **Commit changes:**

   ```bash
   git add scripts/generate-sitemap.js public/sitemap.xml
   git commit -m "Add [page] to sitemap"
   ```

### Priority Guidelines

- **1.0**: Homepage only
- **0.8-0.9**: Primary tools/calculators
- **0.6-0.7**: Help, documentation, important static pages
- **0.4-0.5**: Secondary pages (about, contact)
- **0.1-0.3**: Legal pages (privacy, terms, cookies)

### Change Frequency Guidelines

- **always**: Real-time data pages (not recommended for static sites)
- **hourly/daily**: News, frequently updated content
- **weekly**: Homepage, active tools
- **monthly**: Documentation, help pages
- **yearly**: Legal pages, rarely updated content
- **never**: Archived content

## Build Process

### Development Build

```bash
npm run dev
# Sitemap NOT regenerated (uses existing public/sitemap.xml)
```

### Production Build

```bash
npm run build
```

This runs:
1. `node scripts/generate-card-database.js` - Generates card database
2. `node scripts/generate-sitemap.js` - Generates sitemap with current date
3. `vite build` - Builds app and copies public/ files to dist/

### Build Verification

After building:

```bash
# Check files exist
ls -la dist/sitemap.xml dist/robots.txt

# Verify content
cat dist/sitemap.xml
cat dist/robots.txt

# Check file sizes
du -h dist/sitemap.xml dist/robots.txt
```

## Validation and Testing

### Local Validation

1. **XML Syntax Validation:**

   ```bash
   # Using xmllint (if available)
   xmllint --noout public/sitemap.xml

   # Manual check
   cat public/sitemap.xml
   ```

2. **Robots.txt Validation:**

   ```bash
   cat public/robots.txt
   ```

### Online Validators

**Sitemap Validators:**
- XML Sitemap Validator: https://www.xml-sitemaps.com/validate-xml-sitemap.html
- Google Search Console: https://search.google.com/search-console
- Bing Webmaster Tools: https://www.bing.com/webmasters

**Robots.txt Validators:**
- Google Robots Testing Tool: https://support.google.com/webmasters/answer/6062598
- Robots.txt Checker: https://support.google.com/webmasters/answer/6062596

### Validation Checklist

- [ ] XML is well-formed (no parsing errors)
- [ ] All URLs return HTTP 200 status codes
- [ ] All URLs use HTTPS protocol
- [ ] Priority values are between 0.0 and 1.0
- [ ] Change frequency uses valid values
- [ ] lastmod dates are in ISO 8601 format (YYYY-MM-DD)
- [ ] File size under 50MB
- [ ] Less than 50,000 URLs
- [ ] URLs contain only ASCII characters
- [ ] robots.txt includes sitemap reference
- [ ] No redirect chains on sitemap/robots.txt URLs

### Testing in Production

After deployment:

```bash
# Check accessibility
curl https://www.firstdrawgg.online/sitemap.xml
curl https://www.firstdrawgg.online/robots.txt

# Check headers
curl -I https://www.firstdrawgg.online/sitemap.xml
# Should return: Content-Type: application/xml

curl -I https://www.firstdrawgg.online/robots.txt
# Should return: Content-Type: text/plain

# Verify no redirects
curl -L -I https://www.firstdrawgg.online/sitemap.xml | grep HTTP
```

## Troubleshooting

### Sitemap Not Updating

**Problem:** Generated sitemap has old date

**Solutions:**
1. Run `npm run build:sitemap` manually
2. Check if `generate-sitemap.js` is in build script
3. Verify no caching issues: `rm -rf dist && npm run build`

### Files Not in Dist

**Problem:** sitemap.xml or robots.txt missing from dist/

**Solutions:**
1. Verify files exist in `public/` directory
2. Check Vite configuration (should auto-copy public/ files)
3. Run clean build: `rm -rf dist && npm run build`
4. Check build output logs for errors

### URLs Return 404

**Problem:** URLs in sitemap return 404 errors

**Solutions:**
1. Verify routes exist in application
2. Check URL paths match exactly (case-sensitive)
3. Test each URL manually in browser
4. Update sitemap to reflect actual routes

### XML Validation Errors

**Problem:** Sitemap fails XML validation

**Solutions:**
1. Check XML structure in `scripts/generate-sitemap.js`
2. Ensure special characters are XML-escaped
3. Verify UTF-8 encoding
4. Test with: `xmllint --noout public/sitemap.xml`

### Robots.txt Not Working

**Problem:** Crawlers ignoring robots.txt

**Solutions:**
1. Verify file is at domain root: `/robots.txt`
2. Check file has no BOM (byte order mark)
3. Use plain text encoding (UTF-8)
4. Test with Google's Robots Testing Tool
5. Verify no syntax errors

## Post-Deployment Checklist

After deploying sitemap/robots.txt changes:

- [ ] Access `https://www.firstdrawgg.online/sitemap.xml` - returns XML
- [ ] Access `https://www.firstdrawgg.online/robots.txt` - returns text
- [ ] Validate XML structure with online validator
- [ ] Test all URLs from sitemap return 200 status
- [ ] Check Content-Type headers are correct
- [ ] Submit to Google Search Console (if applicable)
- [ ] Submit to Bing Webmaster Tools (if applicable)
- [ ] Verify no 404 errors in crawler logs
- [ ] Monitor Search Console for indexing status
- [ ] Check for crawl errors after 24-48 hours

## Monitoring and Maintenance

### Weekly Tasks

- Check Search Console for crawl errors
- Monitor indexed page count
- Review organic traffic in analytics

### Monthly Tasks

- Update `lastmod` dates for significantly changed pages
- Review and update priority values
- Add new pages to sitemap
- Check for broken URLs

### Quarterly Tasks

- Full sitemap audit
- Update change frequencies if needed
- Review robots.txt rules
- Validate all URLs still return 200

### Annual Tasks

- Comprehensive SEO audit
- Review domain authority metrics
- Update legal page priorities
- Clean up deprecated URLs

## Future Enhancements

### Dynamic Sitemap Generation

For dynamic content (e.g., shared deck URLs):

```javascript
// Example: Add dynamic routes
const dynamicPages = await fetchSharedDecks();
dynamicPages.forEach(deck => {
  pages.push({
    path: `/share/${deck.id}`,
    priority: 0.6,
    changefreq: 'weekly',
    description: `Shared deck: ${deck.name}`
  });
});
```

### Sitemap Index

When URL count exceeds 50,000:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.firstdrawgg.online/sitemap-main.xml</loc>
    <lastmod>2025-10-28</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.firstdrawgg.online/sitemap-decks.xml</loc>
    <lastmod>2025-10-28</lastmod>
  </sitemap>
</sitemapindex>
```

### Image Sitemap

For card images:

```xml
<url>
  <loc>https://www.firstdrawgg.online/</loc>
  <image:image>
    <image:loc>https://firstdrawgg.blob.core.windows.net/card-images/12345.webp</image:loc>
    <image:caption>Blue-Eyes White Dragon</image:caption>
  </image:image>
</url>
```

## Support

For questions or issues:
- Review this documentation
- Check Vite documentation for public file handling
- Test changes locally before deploying
- Use online validators to verify correctness

## References

- [Sitemaps.org Protocol](https://www.sitemaps.org/protocol.html)
- [Google Sitemap Guidelines](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Robots.txt Specification](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Vite Static Assets](https://vitejs.dev/guide/assets.html#the-public-directory)
