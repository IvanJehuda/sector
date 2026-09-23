import Link from 'next/link';
import type { ReactNode } from 'react';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 text-lg tracking-tight">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" />
        <path d="M3 15h6v6M9 9h6v6" />
      </svg>
      Correlation Explainer
    </Link>
  );
}

export function SiteNav({ children }: { children?: ReactNode }) {
  return (
    <nav className="flex h-16 items-center justify-between gap-4 border-b border-line px-4 sm:h-18 sm:px-10">
      <Logo />
      {children}
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-4 flex flex-col gap-2 border-t border-line py-6 font-mono text-[11px] tracking-wide text-white/50 uppercase sm:mx-10 sm:flex-row sm:justify-between">
      <span>Data harga: Sectors API · Bursa Efek Indonesia</span>
      <span>Analisis data untuk edukasi, bukan saran investasi</span>
    </footer>
  );
}

/** The framed 1200px column with hairline side borders. */
export function Frame({ children }: { children: ReactNode }) {
  return <div className="relative mx-auto min-h-screen max-w-[1200px] border-line xl:border-x">{children}</div>;
}
