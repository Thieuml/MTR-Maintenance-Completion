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
          hd: process.env.GOOGLE_WORKSPACE_DOMAIN || undefined,
        },
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Optional: Restrict access to specific Google Workspace domain
      if (process.env.GOOGLE_WORKSPACE_DOMAIN) {
        const email = user.email || profile?.email
        if (email && !email.endsWith(`@${process.env.GOOGLE_WORKSPACE_DOMAIN}`)) {
          return false
        }
      }
      return true
    },
    async jwt({ token, user, account, profile }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.picture as string
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
  debug: process.env.NODE_ENV === 'development',
}

