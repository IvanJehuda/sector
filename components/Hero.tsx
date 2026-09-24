'use client';

import { useState, type MouseEvent } from 'react';
import { AnalyzeForm } from './AnalyzeForm';
import { CorrelationBoard } from './CorrelationBoard';
import { Container } from './SiteNav';

/** Deterministic so server and client render the same characters. */
function asciiField(rows: number, cols: number, seed: number): string {
  const chars = '.:-=+x#@S08X;%';
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const p = 0.012 + 0.6 * Math.pow(r / rows, 2.2);
    let line = '';
    for (let c = 0; c < cols; c++) line += rnd() < p ? chars[Math.floor(rnd() * chars.length)] : ' ';
    lines.push(line);
  }
  return lines.join('\n');
}

// Wide enough to cover a 2560px screen at 13px monospace.
const ASCII = asciiField(72, 340, 7);
const REST = { x: 62, y: 70 };
const asciiClass = 'pointer-events-none absolute inset-0 m-0 overflow-hidden font-mono text-[13px] leading-[17px] whitespace-pre select-none';

export function Hero() {
  const [spot, setSpot] = useState(REST);

  function move(e: MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  const mask = `radial-gradient(320px circle at ${spot.x}% ${spot.y}%, #000 0%, rgb(0 0 0 / 0.55) 40%, transparent 72%)`;
  const glow = `radial-gradient(300px circle at ${spot.x - 2}% ${spot.y + 4}%, rgb(245 165 36 / 0.2), transparent 70%), radial-gradient(300px circle at ${spot.x + 3}% ${spot.y + 8}%, rgb(43 217 197 / 0.16), transparent 70%)`;

  return (
    <section
      onMouseMove={move}
      onMouseLeave={() => setSpot(REST)}
      className="relative flex min-h-[calc(100svh-6.25rem)] items-center overflow-hidden border-b border-line"
    >
      <pre aria-hidden="true" className={`${asciiClass} text-white/[0.07]`}>
        {ASCII}
      </pre>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: glow }} />
      <pre aria-hidden="true" className={`${asciiClass} spectral font-medium`} style={{ WebkitMaskImage: mask, maskImage: mask }}>
        {ASCII}
      </pre>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />

      <Container className="relative grid items-center gap-12 py-12 xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)] xl:gap-16 xl:py-14">
        <div className="flex flex-col gap-7">
          <span className="font-mono text-xs tracking-widest text-white/80">{'// DATA HARGA DARI SECTORS · BURSA EFEK INDONESIA //'}</span>
          <h1 className="text-[40px] leading-[1.04] font-light sm:text-6xl xl:text-[52px] 2xl:text-[64px]">
            <span className="text-white/55">Ada berita ekonomi?</span>
            <br />
            Lihat saham mana yang <span className="spectral">ikut bergerak</span>
          </h1>
          <p className="max-w-[560px] text-lg leading-relaxed text-white/70">
            Tempel tautan atau isi berita. Kami cari saham di Bursa Efek Indonesia yang berkaitan, lalu bandingkan geraknya dengan pasar selama
            6 hari bursa.
          </p>
          <AnalyzeForm />
        </div>
        <CorrelationBoard />
      </Container>

      <a
        href="#cara-kerja"
        className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 font-mono text-[11px] tracking-widest text-white/45 hover:text-fg xl:block"
      >
        GULIR · CARA KERJA ↓
      </a>
    </section>
  );
}
