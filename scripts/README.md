# Yu-Gi-Oh Card Data & Image Migration

This directory contains scripts for managing Yu-Gi-Oh card data and images in Vercel Blob Storage.

## Overview

This directory manages two types of data:

### 1. Card Metadata (New!)
- Full card database with 13,931 cards and complete metadata (~26 MB)
- Uploaded to Vercel Blob for fast, reliable access
- Used as primary data source with YGOPro API fallback
- See [CARD_DATABASE_ARCHITECTURE.md](../CARD_DATABASE_ARCHITECTURE.md) for details

### 2. Card Images
The image migration system downloads all ~13,000 card images from the YGOPro API and stores them in Vercel Blob Storage with:

- **WebP format only**: 85% quality for optimal size/quality balance
- **Multiple sizes**: Full size (~420x614px) and small thumbnails (168x245px)
- **Card name-based URLs**: `/cards/{cardName}.webp` structure for easy frontend integration
- **Optimized storage**: Under 3GB total (~$0.42/month cost)
- **Rate limiting**: 100ms delay between requests to respect API limits
- **Minimal retries**: Cost-optimized error handling with 1 retry max

## Setup

### 1. Environment Variables

Set up the required environment variable in your Vercel dashboard:

```bash
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here
```

To get your Blob token:
1. Go to your Vercel dashboard
2. Navigate to your project settings
3. Go to Environment Variables
4. Add `BLOB_READ_WRITE_TOKEN` with your Blob storage token

### 2. Install Dependencies

The required packages should already be installed, but if needed:

```bash
npm install @vercel/blob sharp node-fetch
```

## Available Scripts

### Card Database Management

#### Upload Card Database (New!)
Upload the full card metadata database to Vercel Blob:

```bash
npm run upload:card-database
```

This uploads 13,931 cards with complete metadata (ATK, DEF, type, description, etc.) to Vercel Blob Storage. The app will then use this as the primary data source instead of the YGOPro API.

#### Generate Local Card Database
Generate a minimal static database for YDK parsing:

```bash
npm run build:db
```

This creates `/public/cardDatabase.json` with minimal card data for offline YDK file parsing.

### Image Migration Scripts

#### Primary Image Migration (Recommended)

To migrate all card images using the final implementation:

```bash
npm run migrate:images:final
```

This runs the `migrate-card-images-final.js` script which implements all acceptance criteria:
- WebP format with 85% quality
- Card name-based URLs structure
- Cost optimization with minimal retries
- Comprehensive progress tracking

### Alternative Scripts

Legacy scripts available for reference:

```bash
# Original multi-format script
npm run migrate:images

# Optimized WebP-only script (old version)
npm run migrate:images:optimized
```

### Environment Setup

For local development, create a `.env.local` file:

```bash
echo "BLOB_READ_WRITE_TOKEN=your_token_here" > .env.local
```

## Migration Process

The script follows this process:

1. **Fetch Card Data**: Downloads card database from YGOPro API
2. **Check Existing**: Verifies which images are already in Blob storage
3. **Download Images**: Downloads card images from YGOPro CDN
4. **Process Images**: Converts to multiple formats and sizes using Sharp
5. **Upload to Blob**: Stores processed images in Vercel Blob Storage
6. **Track Progress**: Logs progress and generates detailed results

## Storage Structure

Images are stored with the following structure (new card name-based format):

```
cards/
├── blue-eyes-white-dragon.webp        (420x614px full size)
├── blue-eyes-white-dragon-small.webp  (168x245px small size)
├── dark-magician.webp                 (420x614px full size)
├── dark-magician-small.webp           (168x245px small size)
└── ...
```

### Card Name Sanitization

Card names are processed for URL-safe filenames:
- Remove special characters (keep alphanumeric, spaces, hyphens)
- Replace spaces with hyphens  
- Convert to lowercase
- Limit to 50 characters

Example: `"Blue-Eyes White Dragon"` → `"blue-eyes-white-dragon"`

## Cost Optimization

- **WebP format only**: 25-35% smaller than equivalent JPEG quality
- **Quality setting**: 85% for optimal size/quality balance
- **Minimal retries**: Only 1 retry per operation to avoid waste
- **Total storage**: <3GB limit (~$0.42/month target)
- **CDN delivery**: Fast global access through Vercel's network
- **Batch limiting**: Max 15,000 cards per run to prevent runaway costs

## Error Handling

The script includes comprehensive error handling:

- **Minimal retry logic**: 1 retry for cost optimization
- **Graceful continuation**: Script continues if individual cards fail  
- **Detailed logging**: All failures logged with card ID and error details
- **Resumable**: Can be re-run to retry failed uploads without duplicating
- **Storage limit monitoring**: Stops at 3GB to prevent cost overruns

## Validation

After migration, validate the results:

```bash
npm run validate:migration:final
```

The validation script checks:
- **Completeness**: All cards with images have been migrated
- **Structure**: Proper file naming and organization
- **Accessibility**: Sample images can be accessed via direct URLs
- **Quality**: Images maintain expected visual quality
- **Costs**: Storage size within expected limits

## Monitoring

### Progress Tracking

The script provides real-time progress updates:

```
📊 Progress: 1250/13000 (9.6%) - Rate: 2.1/s - ETA: 5238s
✅ Uploaded 1250/13000: Blue-Eyes White Dragon (89631139)
```

### Results File

After completion, detailed results are saved to `migration-results-final.json`:

```json
{
  "summary": {
    "total": 13000,
    "processed": 12890,
    "failed": 23,
    "skipped": 87,
    "duration": 6420,
    "timestamp": "2024-07-20T10:30:00.000Z"
  },
  "failed": [
    {
      "cardId": "12345",
      "name": "Card Name",
      "error": "Download failed after 3 retries",
      "imageUrl": "https://..."
    }
  ]
}
```

## Frontend Integration

After migration, update the frontend to use Blob URLs:

### CardDatabaseService Updates

```javascript
// Before: YGOPro URLs
const imageUrl = card.card_images[0].image_url;

// After: Blob URLs with WebP/JPEG fallback
const getImageUrl = (cardId, size = 'full', format = 'webp') => {
  return `https://your-blob-url.vercel-storage.com/cards/${size}/${cardId}.${format}`;
};
```

### HTML Picture Element

For optimal browser support with WebP fallback:

```html
<picture>
  <source srcset="/cards/small/12345.webp" type="image/webp">
  <img src="/cards/small/12345.jpg" alt="Card Name" loading="lazy">
</picture>
```

## Maintenance

### Adding New Cards

When YGOPro releases new cards:

1. The migration script automatically skips existing images
2. Run the script again to process only new cards:
   ```bash
   node scripts/migrate-card-images.js
   ```

### Monitoring Costs

Check Blob storage usage in your Vercel dashboard:
- Go to Storage tab in your project
- Monitor usage and costs
- Set up alerts if needed

### Vercel Blob Limits

- **Free tier**: 500MB
- **Pro tier**: 100GB ($0.15/GB/month)
- **Enterprise**: Custom limits

## Troubleshooting

### Common Issues

**1. Token Error**
```
Error: BLOB_READ_WRITE_TOKEN environment variable is required
```
Solution: Set the environment variable in Vercel dashboard

**2. Rate Limiting**
```
Error: HTTP 429: Too Many Requests
```
Solution: Increase `DELAY_BETWEEN_REQUESTS` in the script

**3. Storage Full**
```
Error: Blob storage quota exceeded
```
Solution: Upgrade Vercel plan or optimize image sizes

### Re-running Failed Uploads

To retry only failed uploads:

1. Check `migration-results.json` for failed cards
2. The script automatically skips successful uploads
3. Re-run: `node scripts/migrate-card-images.js`

## Performance Tips

- **Run during off-peak hours**: Less API congestion
- **Monitor network**: Stable connection recommended
- **Local development**: Use smaller test dataset first
- **Production deployment**: Consider running in Vercel Functions for better reliability

## Security Notes

- **Token security**: Never commit tokens to version control
- **API limits**: Respect YGOPro API rate limits
- **CORS**: Blob URLs are public but obscured
- **Content policy**: Ensure compliance with image usage rights