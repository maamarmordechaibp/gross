import type { Metadata } from 'next';
import { Toaster } from '@/components/app/toaster';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Gross Printing', template: '%s · Gross Printing' },
  description: 'Production-grade printing management. Real-time orders, finance, and shop floor.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
