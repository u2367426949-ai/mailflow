// ============================================================
// MailFlow — Layout principal Next.js
// ============================================================

import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'MailFlow — Ta boîte mail, enfin sous contrôle',
    template: '%s | MailFlow',
  },
  description:
    'MailFlow est l\'assistant IA qui trie, priorise et résume tes emails automatiquement. Connecte ta boîte Gmail en 1 clic.',
  keywords: [
    'email sorter',
    'tri email IA',
    'Gmail AI',
    'inbox zero',
    'productivité',
    'intelligence artificielle',
  ],
  authors: [{ name: 'NodeIA', url: 'https://nodeia.io' }],
  creator: 'NodeIA',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: '/',
    title: 'MailFlow — Ta boîte mail, enfin sous contrôle',
    description:
      'MailFlow est l\'assistant IA qui trie, priorise et résume tes emails automatiquement.',
    siteName: 'MailFlow',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MailFlow — Ta boîte mail, enfin sous contrôle',
    description: 'L\'assistant IA pour trier et prioriser tes emails Gmail.',
    creator: '@nodeia',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${inter.className} bg-[#0a0a0a] text-[#f5f5f5] antialiased min-h-screen`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}
