import Link from 'next/link';
import type { ReactNode } from 'react';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-base tracking-tight whitespace-nowrap sm:gap-3 sm:text-lg">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" />
        <path d="M3 15h6v6M9 9h6v6" />
      </svg>
      Correlation Explainer
    </Link>
  );
}

/** Centred content column; sections stay full-bleed around it. */
export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1600px] px-4 sm:px-8 xl:px-12 ${className}`}>{children}</div>;
}

export function SiteNav({ children }: { children?: ReactNode }) {
  return (
    <nav className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />
        {children}
      </Container>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <Container className="flex flex-col gap-2 py-6 font-mono text-[11px] tracking-wide text-white/50 uppercase sm:flex-row sm:justify-between">
        <span>Data harga: Sectors API · Bursa Efek Indonesia</span>
        <span>Analisis data untuk edukasi, bukan saran investasi</span>
      </Container>
    </footer>
  );
}

export function Frame({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col">{children}</div>;
}
