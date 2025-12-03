import type { Metadata } from 'next'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { SWRProvider } from '@/components/providers/SWRProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'MTR Maintenance Tracking',
  description: 'Maintenance scheduling and compliance control tool for MTR lifts and escalators',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SWRProvider>
          <SessionProvider>{children}</SessionProvider>
        </SWRProvider>
      </body>
    </html>
  )
}

