# Yu-Gi-Oh Card Image Migration

This directory contains scripts for migrating Yu-Gi-Oh card images from the YGOPro API to Vercel Blob Storage.

## Overview

The migration system downloads all ~13,000 card images from the YGOPro API and stores them in Vercel Blob Storage with:

- **Multiple formats**: WebP (85% quality) and JPEG (90% quality) for browser compatibility
- **Multiple sizes**: Full size (420x614px) and small thumbnails (168x245px)
- **Optimized storage**: Under 3GB total (~$0.45/month cost)
- **Rate limiting**: 100ms delay between requests to respect API limits
- **Error handling**: Robust retry logic and failure tracking

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

## Usage

### Full Migration

To migrate all card images:

```bash
node scripts/migrate-card-images.js
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

Images are stored with the following structure:

```
cards/
├── full/
│   ├── 12345.webp    (420x614px WebP)
│   ├── 12345.jpg     (420x614px JPEG)
│   └── ...
└── small/
    ├── 12345.webp    (168x245px WebP)
    ├── 12345.jpg     (168x245px JPEG)
    └── ...
```

## Cost Optimization

- **WebP compression**: 25-35% smaller than equivalent JPEG
- **Quality settings**: Balanced for optimal size/quality ratio
- **Total storage**: ~2.5GB for full database (~$0.42/month)
- **CDN delivery**: Fast global access through Vercel's network

## Error Handling

The script includes comprehensive error handling:

- **Retry logic**: Up to 3 retries for failed downloads/uploads
- **Graceful continuation**: Script continues if individual cards fail
- **Detailed logging**: All failures logged with card ID and error details
- **Resumable**: Can be re-run to retry failed uploads without duplicating

## Monitoring

### Progress Tracking

The script provides real-time progress updates:

```
📊 Progress: 1250/13000 (9.6%) - Rate: 2.1/s - ETA: 5238s
✅ Uploaded 1250/13000: Blue-Eyes White Dragon (89631139)
```

### Results File

After completion, detailed results are saved to `migration-results.json`:

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