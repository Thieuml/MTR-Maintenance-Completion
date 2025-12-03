import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // You can add additional middleware logic here
    // For example, role-based access control
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Public routes: auth pages, API routes (handled individually), health check
        const publicPaths = ['/auth', '/api/auth', '/api/health']
        const isPublicPath = publicPaths.some((path) => req.nextUrl.pathname.startsWith(path))
        
        // API routes - let them handle their own authentication
        // This prevents middleware from redirecting API calls
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return true
        }
        
        if (isPublicPath) {
          return true
        }
        
        // Require authentication for page routes only
        return !!token
      },
    },
  }
)

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


