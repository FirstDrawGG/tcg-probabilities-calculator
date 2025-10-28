# SEO Implementation QA Checklist

This document provides a comprehensive QA testing checklist for the XML sitemap and SEO foundation implementation for FirstDrawGG.

## Pre-Deployment Testing (Local)

### File Existence and Structure

- [ ] **sitemap.xml exists in `/public` directory**
  - Path: `public/sitemap.xml`
  - Command: `ls -la public/sitemap.xml`

- [ ] **robots.txt exists in `/public` directory**
  - Path: `public/robots.txt`
  - Command: `ls -la public/robots.txt`

- [ ] **Both files are copied to `/dist` after build**
  - Command: `npm run build`
  - Verify: `ls -la dist/sitemap.xml dist/robots.txt`

### XML Validation

- [ ] **sitemap.xml has correct XML declaration**
  - Expected: `<?xml version="1.0" encoding="UTF-8"?>`
  - Command: `head -1 public/sitemap.xml`

- [ ] **sitemap.xml has correct namespace**
  - Expected: `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`
  - Command: `grep xmlns public/sitemap.xml`

- [ ] **All XML tags are properly closed**
  - Check: `<urlset>`, `<url>`, `<loc>`, `<lastmod>`, `<changefreq>`, `<priority>`
  - Command: `cat public/sitemap.xml`

- [ ] **No XML parsing errors**
  - Command: `npm run validate:seo`
  - Expected: All checks pass with ✅

### URL Validation

- [ ] **All URLs use HTTPS protocol**
  - Check each `<loc>` tag starts with `https://`
  - Command: `grep '<loc>' public/sitemap.xml`

- [ ] **All URLs use correct domain**
  - Expected: `https://www.firstdrawgg.online`
  - Verify no URLs use localhost or incorrect domains

- [ ] **All URLs contain only ASCII characters**
  - No special characters, emojis, or non-Latin scripts
  - Command: `npm run validate:seo`

- [ ] **URL count is within limits**
  - Max: 50,000 URLs per sitemap
  - Current: 1 URL (homepage)

### Date and Metadata Validation

- [ ] **lastmod dates are in ISO 8601 format**
  - Format: `YYYY-MM-DD` (e.g., `2025-10-28`)
  - Command: `grep '<lastmod>' public/sitemap.xml`

- [ ] **lastmod dates are current**
  - Should match build date or recent update
  - Verify date is not in the future

- [ ] **Priority values are between 0.0 and 1.0**
  - Homepage should be 1.0
  - Command: `grep '<priority>' public/sitemap.xml`

- [ ] **changefreq values are valid**
  - Valid: `always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never`
  - Homepage: `weekly` is appropriate
  - Command: `grep '<changefreq>' public/sitemap.xml`

### robots.txt Validation

- [ ] **robots.txt contains User-agent directive**
  - Expected: `User-agent: *`
  - Command: `grep 'User-agent:' public/robots.txt`

- [ ] **robots.txt allows public content**
  - Expected: `Allow: /`
  - Command: `grep 'Allow:' public/robots.txt`

- [ ] **robots.txt disallows private directories**
  - Expected: Disallow `/api/`, `/admin/`, `/src/`, `/node_modules/`
  - Command: `grep 'Disallow:' public/robots.txt`

- [ ] **robots.txt contains sitemap reference**
  - Expected: `Sitemap: https://www.firstdrawgg.online/sitemap.xml`
  - Command: `grep 'Sitemap:' public/robots.txt`

- [ ] **robots.txt has no BOM (Byte Order Mark)**
  - Command: `npm run validate:seo`
  - Should pass BOM check

- [ ] **robots.txt uses UTF-8 encoding**
  - File should be plain text, UTF-8
  - Command: `file public/robots.txt`

### File Size and Performance

- [ ] **sitemap.xml is under 50MB**
  - Current: ~0.26KB (well within limit)
  - Command: `du -h public/sitemap.xml`

- [ ] **robots.txt is under 500KB** (recommended limit)
  - Current: ~0.32KB
  - Command: `du -h public/robots.txt`

### Build Process Validation

- [ ] **sitemap generation script runs successfully**
  - Command: `npm run build:sitemap`
  - Expected: ✅ Sitemap generated successfully!

- [ ] **sitemap is generated with current date**
  - Verify lastmod matches current date
  - Command: `npm run build:sitemap && grep '<lastmod>' public/sitemap.xml`

- [ ] **Build process includes sitemap generation**
  - Command: `npm run build`
  - Verify sitemap generation runs before Vite build

- [ ] **All files are present in dist after build**
  - Command: `npm run build && ls -la dist/*.xml dist/robots.txt`
  - Expected: Both files exist in dist/

### Script and Automation Testing

- [ ] **Validation script runs without errors**
  - Command: `npm run validate:seo`
  - Expected: ✅ Validation successful! (exit code 0)

- [ ] **Validation script detects errors correctly**
  - Test by temporarily breaking sitemap
  - Should report errors and exit with code 1

- [ ] **Scripts are documented in package.json**
  - Verify: `build:sitemap`, `validate:seo`
  - Command: `cat package.json | grep -A 3 '"scripts"'`

## Post-Deployment Testing (Production)

### Accessibility Testing

- [ ] **sitemap.xml is accessible at root domain**
  - URL: https://www.firstdrawgg.online/sitemap.xml
  - Expected: Returns XML content with 200 status

- [ ] **robots.txt is accessible at root domain**
  - URL: https://www.firstdrawgg.online/robots.txt
  - Expected: Returns plain text with 200 status

- [ ] **Files load without authentication**
  - Test in incognito/private browsing mode
  - Should not require login

- [ ] **Files load within 3 seconds**
  - Test with network throttling
  - Measure with browser DevTools

### HTTP Header Validation

- [ ] **sitemap.xml returns correct Content-Type**
  - Expected: `Content-Type: application/xml` or `text/xml`
  - Command: `curl -I https://www.firstdrawgg.online/sitemap.xml`

- [ ] **robots.txt returns correct Content-Type**
  - Expected: `Content-Type: text/plain`
  - Command: `curl -I https://www.firstdrawgg.online/robots.txt`

- [ ] **sitemap.xml returns 200 status code**
  - Command: `curl -I https://www.firstdrawgg.online/sitemap.xml | grep HTTP`
  - Expected: `HTTP/2 200` or `HTTP/1.1 200`

- [ ] **robots.txt returns 200 status code**
  - Command: `curl -I https://www.firstdrawgg.online/robots.txt | grep HTTP`
  - Expected: `HTTP/2 200` or `HTTP/1.1 200`

- [ ] **No redirect chains exist**
  - Files should not redirect (301/302) before serving
  - Command: `curl -L -I https://www.firstdrawgg.online/sitemap.xml`

### URL Testing

- [ ] **All URLs in sitemap return 200 status**
  - Test homepage: `curl -I https://www.firstdrawgg.online/`
  - Expected: HTTP 200
  - Document any 404s or errors

- [ ] **All URLs are reachable from homepage**
  - Navigate to each URL manually
  - Verify no broken links

- [ ] **URLs match application routes exactly**
  - Case-sensitive check
  - No trailing slash mismatches

### Search Engine Validation

- [ ] **sitemap validates with XML Sitemap Validator**
  - Tool: https://www.xml-sitemaps.com/validate-xml-sitemap.html
  - Paste sitemap URL and validate

- [ ] **sitemap validates with Google Search Console**
  - Navigate to: Search Console > Sitemaps
  - Submit sitemap URL
  - Expected: "Success" status

- [ ] **robots.txt validates with Google Robots Tester**
  - Tool: Google Search Console > robots.txt Tester
  - Expected: No errors

- [ ] **sitemap validates with Bing Webmaster Tools**
  - Submit sitemap URL
  - Check for validation errors

### Content Validation

- [ ] **sitemap content matches local version**
  - Compare production XML with local dist/sitemap.xml
  - Should be identical (except possibly lastmod date)

- [ ] **robots.txt content matches local version**
  - Compare production with local dist/robots.txt
  - Should be identical

- [ ] **No extra/missing URLs in production**
  - Verify all expected pages are present
  - No unexpected URLs added

### Browser Testing

- [ ] **sitemap.xml renders correctly in Chrome**
  - Open URL in browser
  - Should display XML tree or plain text

- [ ] **sitemap.xml renders correctly in Firefox**
  - Should display XML with syntax highlighting

- [ ] **sitemap.xml renders correctly in Safari**
  - Should display XML content

- [ ] **sitemap.xml renders correctly in Edge**
  - Should display XML content

- [ ] **Mobile browser compatibility**
  - Test on iOS Safari and Chrome Mobile
  - Should load and display correctly

### Performance Testing

- [ ] **sitemap loads quickly on 3G network**
  - Test with network throttling
  - Target: < 3 seconds

- [ ] **sitemap loads quickly on slow 4G**
  - Should load in < 2 seconds

- [ ] **Files are cached appropriately**
  - Check Cache-Control headers
  - Verify reasonable cache duration

### Security Testing

- [ ] **Files use HTTPS protocol**
  - No mixed content warnings
  - Valid SSL certificate

- [ ] **No sensitive information in sitemap**
  - No API keys, tokens, or credentials
  - No private/admin URLs

- [ ] **robots.txt correctly blocks private areas**
  - Verify /api/, /admin/, /src/ are disallowed
  - Test that public areas are allowed

## Search Console Integration

### Google Search Console

- [ ] **Submit sitemap to Google Search Console**
  - URL: https://search.google.com/search-console
  - Navigate to Sitemaps section
  - Submit: `https://www.firstdrawgg.online/sitemap.xml`

- [ ] **Verify sitemap is processed successfully**
  - Check status shows "Success"
  - No errors reported

- [ ] **Monitor coverage report**
  - Check "Indexed" vs "Discovered" counts
  - Document any indexing issues

- [ ] **Verify robots.txt is detected**
  - Navigate to robots.txt Tester
  - Confirm Google can access it

### Bing Webmaster Tools

- [ ] **Submit sitemap to Bing Webmaster Tools**
  - URL: https://www.bing.com/webmasters
  - Submit sitemap URL

- [ ] **Verify sitemap validation in Bing**
  - Check for errors or warnings
  - Document any issues

## Monitoring (24-48 Hours Post-Deployment)

- [ ] **Check for crawl errors in Search Console**
  - Expected: No new errors related to sitemap

- [ ] **Verify pages are being indexed**
  - Check "URL Inspection" tool
  - Homepage should show "URL is on Google"

- [ ] **Monitor server logs for crawler activity**
  - Look for Googlebot, Bingbot requests
  - Verify they're accessing sitemap.xml

- [ ] **Check for robots.txt fetch errors**
  - Search Console should show successful robots.txt fetches

- [ ] **Verify no 404 errors from sitemap URLs**
  - Check Coverage report for errors
  - Fix any broken URLs

## Documentation and Knowledge Transfer

- [ ] **SEO_MAINTENANCE.md documentation exists**
  - Location: `docs/SEO_MAINTENANCE.md`
  - Contains complete instructions

- [ ] **QA_CHECKLIST.md is up to date**
  - This document is current
  - Reflects actual implementation

- [ ] **Team is trained on updating sitemap**
  - Process for adding new pages is documented
  - Scripts usage is understood

- [ ] **Build process is documented**
  - README or CLAUDE.md includes sitemap info
  - CI/CD includes sitemap generation

## Edge Cases and Error Handling

- [ ] **Test sitemap with trailing slash**
  - https://www.firstdrawgg.online/sitemap.xml/
  - Should return 404 or redirect to correct URL

- [ ] **Test case sensitivity**
  - https://www.firstdrawgg.online/SITEMAP.XML
  - Behavior should be documented

- [ ] **Test without www subdomain**
  - https://firstdrawgg.online/sitemap.xml
  - Should work or redirect correctly

- [ ] **Test with malformed requests**
  - Verify server handles errors gracefully
  - No 500 errors

## Analytics and Tracking

- [ ] **Organic traffic tracking is enabled**
  - Vercel Analytics or Google Analytics configured
  - Can track source of traffic

- [ ] **Set baseline metrics**
  - Document current indexed page count: ___
  - Current organic impressions: ___
  - Current organic clicks: ___

- [ ] **Monitor organic search performance**
  - Check weekly for first month
  - Look for upward trend in impressions

## Final Sign-Off

- [ ] **All acceptance criteria met**
  - Review original user story
  - Verify each AC is implemented

- [ ] **All critical tests pass**
  - No blocking issues found
  - All 200 status codes confirmed

- [ ] **Documentation is complete**
  - All docs created and reviewed
  - No missing information

- [ ] **Stakeholder approval obtained**
  - Product owner signs off
  - Ready for production release

---

## Test Results Log

**Tested by:** _________________
**Date:** _________________
**Environment:** ☐ Local  ☐ Staging  ☐ Production

**Overall Status:** ☐ PASS  ☐ FAIL  ☐ BLOCKED

**Critical Issues Found:**
1. _________________
2. _________________
3. _________________

**Non-Critical Issues:**
1. _________________
2. _________________

**Notes:**
_________________
_________________

---

## Quick Commands Reference

```bash
# Generate sitemap
npm run build:sitemap

# Validate SEO files
npm run validate:seo

# Full build with sitemap
npm run build

# Test sitemap locally
cat public/sitemap.xml

# Test in production
curl https://www.firstdrawgg.online/sitemap.xml
curl https://www.firstdrawgg.online/robots.txt

# Check HTTP headers
curl -I https://www.firstdrawgg.online/sitemap.xml
curl -I https://www.firstdrawgg.online/robots.txt
```

## Expected Outcomes

By completing this checklist, you should have:

✅ Valid sitemap.xml accessible at `/sitemap.xml`
✅ Valid robots.txt accessible at `/robots.txt`
✅ Both files in production and working correctly
✅ No XML validation errors
✅ All URLs returning 200 status codes
✅ Correct Content-Type headers
✅ Sitemap submitted to search engines
✅ No crawl errors in Search Console
✅ Documentation for future maintenance
✅ Monitoring in place for organic traffic
