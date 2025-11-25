import type { Metadata } from 'next'
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
      <body>{children}</body>
    </html>
  )
}

