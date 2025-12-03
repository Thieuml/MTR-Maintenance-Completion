import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

/**
 * NextAuth configuration for Google Workspace SSO
 * 
 * Required environment variables:
 * - NEXTAUTH_URL: Your application URL (e.g., http://localhost:3004 for dev, https://yourdomain.com for prod)
 * - NEXTAUTH_SECRET: A random secret string (generate with: openssl rand -base64 32)
 * - GOOGLE_CLIENT_ID: Google OAuth Client ID from Google Cloud Console
 * - GOOGLE_CLIENT_SECRET: Google OAuth Client Secret from Google Cloud Console
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          // Restrict to your Google Workspace domain (optional but recommended)
          // Remove @ if present - hd parameter expects just the domain
          hd: process.env.GOOGLE_WORKSPACE_DOMAIN 
            ? process.env.GOOGLE_WORKSPACE_DOMAIN.replace('@', '').trim() 
            : undefined,
        },
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'database', // Use database strategy with PrismaAdapter
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Optional: Restrict access to specific Google Workspace domain
      if (process.env.GOOGLE_WORKSPACE_DOMAIN) {
        const email = user.email || profile?.email
        const domain = process.env.GOOGLE_WORKSPACE_DOMAIN.replace('@', '').trim()
        if (email && !email.endsWith(`@${domain}`)) {
          console.error(`[Auth] Access denied: ${email} does not match domain ${domain}`)
          return false
        }
      }
      return true
    },
    async session({ session, user }) {
      // With database strategy, user is available directly
      if (session.user && user) {
        session.user.id = user.id
        session.user.email = user.email || null
        session.user.name = user.name || null
        session.user.image = user.image || null
      }
      return session
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      // Optional: Log sign-in events or sync user data
      console.log(`User signed in: ${user.email} (${isNewUser ? 'new' : 'existing'})`)
    },
  },
  debug: true, // Enable debug logging to troubleshoot callback issues
}

