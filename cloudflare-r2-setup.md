# 📁 Cloudflare R2 Setup Guide for ARYV

## Step 1: Create Cloudflare R2 Bucket

1. **Login to Cloudflare Dashboard**: https://dash.cloudflare.com
2. **Navigate to R2**: R2 Object Storage → Create bucket
3. **Bucket Name**: `aryv-uploads`
4. **Location**: Automatic (global distribution)

## Step 2: Generate R2 API Tokens

1. **R2 Dashboard** → Manage R2 API tokens
2. **Create API token** → Custom token
3. **Permissions**: 
   - Zone: Zone Read, Zone Edit
   - Account: R2:Read, R2:Edit
4. **Resources**:
   - Include: Specific account → Your account
   - Include: Specific bucket → aryv-uploads
5. **Copy tokens** (save securely)

## Step 3: Get Account ID

1. **Right sidebar** in Cloudflare dashboard
2. **Account ID**: Copy the account ID
3. **Zone ID**: Copy if using custom domain

## Step 4: Environment Variables for Railway

```bash
# Add these to Railway environment variables:
CLOUDFLARE_R2_ACCESS_KEY=your_r2_access_key
CLOUDFLARE_R2_SECRET_KEY=your_r2_secret_key
CLOUDFLARE_R2_BUCKET=aryv-uploads
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
CLOUDFLARE_R2_PUBLIC_URL=https://uploads.aryv-app.com
```

## Step 5: Custom Domain (Optional)

1. **R2 Bucket Settings** → Connect domain
2. **Add domain**: uploads.aryv-app.com
3. **DNS**: Add CNAME record in Cloudflare DNS
4. **SSL**: Automatic with Cloudflare

## Step 6: CORS Configuration

```json
{
  "AllowedOrigins": [
    "https://aryv-app.com",
    "https://www.aryv-app.com",
    "https://api.aryv-app.com",
    "https://admin.aryv-app.com",
    "https://aryv-admin-professional.majokoobo.workers.dev"
  ],
  "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
```

**Total Setup Time: ~5 minutes**
**Monthly Cost: ~$20 for 10K users**