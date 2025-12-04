import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function SignInLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if user is already signed in on the server
  const session = await getServerSession(authOptions)
  
  if (session) {
    // User is already authenticated, redirect to home
    redirect('/')
  }
  
  return <>{children}</>
}

