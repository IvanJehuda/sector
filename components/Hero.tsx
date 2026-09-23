'use client';

import { useState, type MouseEvent } from 'react';
import { AnalyzeForm } from './AnalyzeForm';
import { BoardCaption, CorrelationBoard, useBoardCaption } from './CorrelationBoard';

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
    const p = 0.012 + 0.62 * Math.pow(r / rows, 2.2);
    let line = '';
    for (let c = 0; c < cols; c++) line += rnd() < p ? chars[Math.floor(rnd() * chars.length)] : ' ';
    lines.push(line);
  }
  return lines.join('\n');
}

const ASCII = asciiField(64, 170, 7);
const REST = { x: 50, y: 55 };
const asciiClass = 'pointer-events-none absolute inset-0 m-0 overflow-hidden font-mono text-[13px] leading-[17px] whitespace-pre select-none';

export function Hero() {
  const [spot, setSpot] = useState(REST);
  const board = useBoardCaption();

  function move(e: MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  const mask = `radial-gradient(300px circle at ${spot.x}% ${spot.y}%, #000 0%, rgb(0 0 0 / 0.55) 40%, transparent 72%)`;
  const glow = `radial-gradient(260px circle at ${spot.x - 3}% ${spot.y + 4}%, rgb(245 165 36 / 0.22), transparent 70%), radial-gradient(260px circle at ${spot.x + 4}% ${spot.y + 8}%, rgb(43 217 197 / 0.18), transparent 70%)`;

  return (
    <section onMouseMove={move} onMouseLeave={() => setSpot(REST)} className="relative overflow-hidden border-b border-line">
      <pre aria-hidden="true" className={`${asciiClass} text-white/[0.075]`}>
        {ASCII}
      </pre>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: glow }} />
      <pre aria-hidden="true" className={`${asciiClass} spectral font-medium`} style={{ WebkitMaskImage: mask, maskImage: mask }}>
        {ASCII}
      </pre>

      <div className="relative flex flex-col gap-8 px-4 pt-12 pb-10 sm:px-10 sm:pt-16">
        <div className="grid gap-8 xl:grid-cols-[640px_1fr] xl:gap-14">
          <div className="flex flex-col gap-5">
            <span className="font-mono text-xs tracking-widest text-white/80">{'// DATA HARGA DARI SECTORS · BURSA EFEK INDONESIA //'}</span>
            <h1 className="text-4xl leading-[1.06] font-light tracking-tight sm:text-[52px]">
              <span className="text-white/60">Ada berita ekonomi?</span>
              <br />
              Lihat saham mana yang <span className="spectral">ikut bergerak</span>
            </h1>
            <p className="max-w-[600px] text-[17px] leading-relaxed text-white/70">
              Tempel tautan atau isi berita. Kami cari saham di Bursa Efek Indonesia yang berkaitan, lalu bandingkan geraknya dengan pasar
              selama 6 hari bursa.
            </p>
          </div>
          <div className="hidden pt-5 xl:block">
            <BoardCaption label={board.label} caption={board.caption} />
          </div>
        </div>

        <CorrelationBoard hot={board.hot} setHot={board.setHot} />

        <div className="max-w-[760px]">
          <AnalyzeForm />
        </div>
        <div className="hidden flex-wrap gap-6 font-mono text-[11px] tracking-wide text-white/50 xl:flex">
          <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-5 bg-amber" />
            TERKAIT
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-1 w-5 bg-amber" />
            GERAK TIDAK BIASA
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-5 border-t-2 border-dashed border-teal" />
            KAITAN LEMAH
          </span>
        </div>
      </div>
    </section>
  );
}
