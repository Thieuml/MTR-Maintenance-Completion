# Google Workspace SSO Setup Guide

This guide will help you set up Single Sign-On (SSO) with Google Workspace for the MTR Maintenance Tracking application.

## Prerequisites

- A Google Workspace account with admin access
- Access to Google Cloud Console
- The application deployed or running locally

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **Internal** (for Google Workspace users only)
   - Fill in the required fields:
     - App name: `MTR Maintenance Tracking`
     - User support email: Your email
     - Developer contact: Your email
   - Click **Save and Continue**
   - Skip scopes (click **Save and Continue**)
   - Add test users if needed (click **Save and Continue**)
6. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `MTR Maintenance Tracking Web Client`
   - Authorized JavaScript origins:
     - `http://localhost:3004` (for local development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs (add BOTH for development and production):
     - `http://localhost:3004/api/auth/callback/google` (for local development)
     - `https://mtr-maintenance.wemaintain.com/api/auth/callback/google` (for production)
     
     **Note:** You can add multiple redirect URIs. Make sure both are added so you can test locally and deploy to production.
   - Click **Create**
7. Copy the **Client ID** and **Client Secret** (you'll need these for environment variables)

## Step 2: Configure Environment Variables

Add the following environment variables to your `.env.local` file (for local development) or your hosting platform's environment variables (for production):

```bash
# NextAuth.js Configuration
# IMPORTANT: For local development, use http://localhost:3004
# For production, use https://yourdomain.com
NEXTAUTH_URL=http://localhost:3004  # Change to your production URL in production
NEXTAUTH_SECRET=your-secret-key-here  # Generate with: openssl rand -base64 32

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: Restrict to specific Google Workspace domain
GOOGLE_WORKSPACE_DOMAIN=yourcompany.com  # Only allow users from this domain
```

**Important:** Make sure `NEXTAUTH_URL` matches your current environment:
- **Local development**: `http://localhost:3004`
- **Production**: `https://mtr-maintenance.wemaintain.com`

If `NEXTAUTH_URL` is set to production while running locally, Google will redirect back to production after authentication, causing errors.

### Generate NEXTAUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

## Step 3: Run Database Migration

After adding the NextAuth models to your Prisma schema, run the migration:

**Important:** Prisma CLI reads from `.env` file by default (not `.env.local`). Make sure your `DATABASE_URL` is available:

```bash
# Option 1: Copy .env.local to .env (if you use .env.local)
cp .env.local .env

# Option 2: Or set DATABASE_URL directly
export DATABASE_URL="your-database-url"

# Then run the migration
npm run db:migrate
```

This will create the necessary tables (`User`, `Account`, `Session`, `VerificationToken`) in your database.

**Note:** If you encounter connection errors, ensure your database is accessible and the connection string is correct.

## Step 4: Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3004`
   - You should be redirected to `/auth/signin`
   - Click "Sign in with Google"
   - Complete the Google sign-in flow
   - You should be redirected back to the application

## Step 5: Domain Restriction (Optional)

If you want to restrict access to users from your Google Workspace domain only:

1. Set `GOOGLE_WORKSPACE_DOMAIN` environment variable to your domain (e.g., `yourcompany.com`)
2. The application will automatically restrict sign-ins to users with emails ending in `@yourcompany.com`

## Troubleshooting

### Error: "Access Denied"

- Check that your Google Workspace domain is correctly set in `GOOGLE_WORKSPACE_DOMAIN`
- Verify that the user's email domain matches your workspace domain
- Check the OAuth consent screen configuration

### Error: "Redirect URI mismatch"

- Verify that the redirect URI in Google Cloud Console exactly matches:
  - `http://localhost:3004/api/auth/callback/google` (development)
  - `https://yourdomain.com/api/auth/callback/google` (production)
- Make sure there are no trailing slashes

### Error: "Invalid client"

- Verify that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correctly set
- Check that the OAuth client is enabled in Google Cloud Console

### Session not persisting

- Verify that `NEXTAUTH_SECRET` is set and consistent across all instances
- Check that cookies are enabled in your browser
- Verify that `NEXTAUTH_URL` matches your application URL

## Security Considerations

1. **Never commit secrets to version control** - Always use environment variables
2. **Use HTTPS in production** - Required for secure cookie handling
3. **Rotate secrets regularly** - Change `NEXTAUTH_SECRET` periodically
4. **Restrict OAuth consent screen** - Use "Internal" for Google Workspace-only access
5. **Monitor access logs** - Review Google Cloud Console logs for suspicious activity

## Production Deployment

When deploying to production:

1. Update `NEXTAUTH_URL` to your production domain
2. Add production redirect URI to Google Cloud Console
3. Ensure all environment variables are set in your hosting platform
4. Use HTTPS (required for secure authentication)
5. Consider setting up additional security headers

## Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Workspace Admin Help](https://support.google.com/a)

