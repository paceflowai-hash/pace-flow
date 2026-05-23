import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  title: {
    default: 'Pace/Flow — Akıllı Hız Senkronizasyonu',
    template: '%s | Pace/Flow',
  },
  description:
    'Trafik akışını birlikte düzelt. Hayalet sıkışıklığı yok et. Senkronize hız ile daha akıcı yolculuklar.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pace/Flow',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: 'https://paceflow.app',
    title: 'Pace/Flow — Akıllı Hız Senkronizasyonu',
    description:
      'Trafik akışını birlikte düzelt. Hayalet sıkışıklığı yok et.',
    siteName: 'Pace/Flow',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pace/Flow — Akıllı Hız Senkronizasyonu',
    description:
      'Trafik akışını birlikte düzelt. Hayalet sıkışıklığı yok et.',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${inter.variable} h-full`}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
