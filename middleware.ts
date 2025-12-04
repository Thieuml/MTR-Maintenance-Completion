import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function middleware(req: NextRequest) {
  // Public routes: auth pages, API routes (handled individually), health check
  const publicPaths = ['/auth', '/api/auth', '/api/health']
  const isPublicPath = publicPaths.some((path) => req.nextUrl.pathname.startsWith(path))
  
  // API routes - let them handle their own authentication
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }
  
  // Allow public paths
  if (isPublicPath) {
    return NextResponse.next()
  }
  
  // Check for session using getServerSession (works with database sessions)
  // Note: getServerSession needs the request in a specific format
  // We'll check the session cookie directly as a fallback
  const sessionToken = req.cookies.get(
    process.env.NODE_ENV === 'production' 
      ? '__Secure-next-auth.session-token' 
      : 'next-auth.session-token'
  )?.value
  
  // If no session cookie, redirect to sign-in
  if (!sessionToken) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', req.url)
    return NextResponse.redirect(signInUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - API routes (handled individually in each route)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}


