import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { RegisterServiceWorker } from '@/components/RegisterSW';

export const metadata: Metadata = {
  title: 'WowBingo Vouchers',
  description: 'Recharge WowBingo game credits via hardware-locked voucher codes',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WowBingo',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#022c22',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <RegisterServiceWorker />
        </AuthProvider>
      </body>
    </html>
  );
}
