'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/shared/Navigation'

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The verification token has expired or has already been used.',
  Default: 'An error occurred during authentication.',
}

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'Default'
  const errorMessage = errorMessages[error] || errorMessages.Default

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="ml-64 flex items-center justify-center min-h-screen px-4">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
          <div>
            <h2 className="text-center text-3xl font-extrabold text-gray-900">
              Authentication Error
            </h2>
          </div>

          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-medium">Error: {error}</p>
            <p className="mt-2 text-sm">{errorMessage}</p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/auth/signin"
              className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Go to Home
            </Link>
          </div>

          {error === 'AccessDenied' && (
            <div className="mt-4 text-sm text-gray-600">
              <p>
                If you believe you should have access, please contact your administrator.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

