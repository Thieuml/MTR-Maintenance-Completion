# CRON_SECRET Setup Guide

## What is CRON_SECRET?

`CRON_SECRET` is a security token you create yourself to protect your CRON endpoint from unauthorized access. It's not something that exists - you need to generate it.

## Generate a Secret

### Option 1: Using OpenSSL (Recommended)
```bash
openssl rand -hex 32
```

This generates a 64-character hexadecimal string like:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Option 2: Using Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Option 3: Online Generator
Use a secure random string generator (64+ characters recommended)

## Add to Vercel

### Via Vercel CLI
```bash
# Set for production
vercel env add CRON_SECRET production

# Set for preview
vercel env add CRON_SECRET preview

# Set for development
vercel env add CRON_SECRET development
```

When prompted, paste your generated secret.

### Via Vercel Dashboard
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Click **Add New**
4. Name: `CRON_SECRET`
5. Value: Paste your generated secret
6. Select environments: Production, Preview, Development (as needed)
7. Click **Save**

## Add to Local Development

Add to `.env.local`:
```bash
CRON_SECRET=your-generated-secret-here
```

**Important:** Don't commit `.env.local` to git (it should be in `.gitignore`)

## Usage

Once set, the CRON endpoint will:
- Accept requests with `Authorization: Bearer <CRON_SECRET>` header
- Accept Vercel Cron requests (which have `x-vercel-signature` header)
- Reject unauthorized requests

## Testing

After setting up, test with:
```bash
curl -X POST http://localhost:3000/api/cron/planned-to-pending \
  -H "Authorization: Bearer your-generated-secret-here"
```

## Security Notes

- **Keep it secret**: Don't share or commit the secret
- **Use different secrets**: Use different secrets for production vs development
- **Rotate if compromised**: If you suspect it's leaked, generate a new one
- **Length**: Use at least 32 bytes (64 hex characters) for security



