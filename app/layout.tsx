import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });
// Not in next/font/google yet; latin subset from Google Fonts (OFL).
const display = localFont({ src: './fonts/StackSansNotch-latin.woff2', weight: '200 700', variable: '--font-stack-notch' });

export const metadata: Metadata = {
  title: 'JejakPasar',
  description: 'Tempel berita ekonomi, lihat saham Bursa Efek Indonesia yang ikut bergerak beserta buktinya. Bukan saran investasi.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body className="bg-ink font-sans text-fg antialiased">{children}</body>
    </html>
  );
}
