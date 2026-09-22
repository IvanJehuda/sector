import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Correlation Explainer',
  description: 'Dari berita ke saham IDX yang terkait, lengkap dengan bukti data Sectors. Bukan saran investasi.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
