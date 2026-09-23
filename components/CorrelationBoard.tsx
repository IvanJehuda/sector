'use client';

import { useState } from 'react';

type Card = {
  symbol: string;
  link: string;
  label: string;
  value: string;
  tone: 'down' | 'up' | 'flat';
  unusual: boolean;
  weak?: boolean;
  caption: string;
  /** Position inside the 1120×500 board (xl and up). */
  x: number;
  y: number;
  tilt: number;
};

// Illustrative example for the landing page, not live data.
const CARDS: Card[] = [
  {
    symbol: 'BBRI', link: 'Disebut di berita', label: 'BBRI · DISEBUT DI BERITA', value: '−4,1%', tone: 'down', unusual: true,
    caption: 'BBRI disebut di berita. Dalam 6 hari bursa, harganya turun 4,1% lebih dalam dari pasar. Untuk BBRI, gerak sebesar ini tidak biasa.',
    x: 560, y: 30, tilt: 2,
  },
  {
    symbol: 'BMRI', link: 'Satu indeks BUMN', label: 'BMRI · SATU INDEKS BUMN', value: '−3,1%', tone: 'down', unusual: true,
    caption: 'BMRI tidak disebut, tapi satu indeks BUMN dengan BBRI. Harganya turun 3,1% lebih dalam dari pasar, juga tidak biasa.',
    x: 840, y: 106, tilt: -2.5,
  },
  {
    symbol: 'BBNI', link: 'Bidang usaha sama', label: 'BBNI · BIDANG USAHA SAMA', value: '−1,2%', tone: 'flat', unusual: false,
    caption: 'BBNI hanya satu bidang usaha dengan bank yang disebut. Selisihnya dengan pasar masih wajar.',
    x: 580, y: 270, tilt: -1,
  },
  {
    symbol: 'BRIS', link: 'Satu grup usaha', label: 'BRIS · SATU GRUP USAHA', value: '+1,5%', tone: 'up', unusual: false, weak: true,
    caption: 'BRIS satu grup usaha dengan BRI, tapi harganya naik 1,5% di atas pasar. Kaitannya lemah.',
    x: 870, y: 330, tilt: 3,
  },
];

const PIN = { x: 388, y: 183 };
const INTRO = 'Satu berita bisa berkaitan dengan banyak saham. Arahkan kursor ke kartu untuk melihat alasannya.';
const TONE = { down: 'text-down', up: 'text-up', flat: 'text-fg' };

function CardBody({ c }: { c: Card }) {
  return (
    <>
      <span className="font-mono text-lg font-medium">{c.symbol}</span>
      <span className="text-[13px] text-white/55">{c.link}</span>
      <span className={`text-[44px] leading-none font-light tracking-tight ${TONE[c.tone]}`}>{c.value}</span>
      <span className="font-mono text-[11px] text-white/50">
        dari pasar · {c.unusual ? <b className="font-medium text-amber">tidak biasa</b> : 'masih wajar'}
      </span>
    </>
  );
}

function Clipping({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2.5 border border-white/15 bg-surface p-6 shadow-[0_20px_40px_rgb(0_0_0/0.45)] ${className}`}>
      <span className="font-mono text-[11px] tracking-widest text-white/55">CONTOH BERITA · 2 MARET 2026</span>
      <p className="text-2xl leading-tight tracking-tight">Dividen BUMN perbankan dinaikkan ke 70% laba</p>
      <p className="text-sm leading-relaxed text-white/60">
        Kementerian BUMN meminta bank pelat merah menyetor porsi laba lebih besar mulai tahun buku 2026…
      </p>
      <span className="mt-1 self-start border border-amber/60 px-2 py-0.5 font-mono text-[11px] tracking-wider text-amber">DATA CONTOH</span>
    </div>
  );
}

export function useBoardCaption() {
  const [hot, setHot] = useState<number | null>(null);
  const card = hot === null ? null : CARDS[hot];
  return { hot, setHot, label: card?.label ?? 'CONTOH', caption: card?.caption ?? INTRO };
}

export function BoardCaption({ label, caption }: { label: string; caption: string }) {
  return (
    <div className="flex flex-col gap-2.5" aria-live="polite">
      <span className="font-mono text-[11px] tracking-widest text-amber">{label}</span>
      <p className="min-h-[72px] leading-relaxed text-white/75">{caption}</p>
    </div>
  );
}

export function CorrelationBoard({ hot, setHot }: { hot: number | null; setHot: (i: number | null) => void }) {
  return (
    <>
      {/* xl and up: pinned board with strings */}
      <div className="relative hidden h-[500px] xl:block">
        <svg width="1120" height="500" viewBox="0 0 1120 500" className="pointer-events-none absolute inset-0" aria-hidden="true">
          {CARDS.map((c, i) => {
            const to = { x: c.x + 100, y: c.y };
            const base = c.unusual ? 3 : 1.5;
            const active = hot === i;
            const color = c.weak ? '#2bd9c5' : '#f5a524';
            return (
              <g key={c.symbol}>
                {active && <line x1={PIN.x} y1={PIN.y} x2={to.x} y2={to.y} stroke={color} strokeOpacity={0.25} strokeWidth={14} strokeLinecap="round" />}
                <line
                  x1={PIN.x}
                  y1={PIN.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={color}
                  strokeWidth={active ? base + 2.5 : base}
                  strokeOpacity={hot === null || active ? 1 : 0.25}
                  strokeLinecap="round"
                  strokeDasharray={c.weak ? '6 6' : undefined}
                  style={{ transition: 'stroke-width .2s, stroke-opacity .2s' }}
                />
              </g>
            );
          })}
        </svg>
        <div className="absolute top-[60px] left-[30px] w-[360px] -rotate-2 transition-transform duration-300 hover:rotate-0">
          <Clipping />
          <span className="absolute top-[118px] -right-[9px] size-[18px] rounded-full bg-amber shadow-[0_0_18px_rgb(245_165_36/0.8)]" aria-hidden="true" />
        </div>
        {CARDS.map((c, i) => (
          <button
            key={c.symbol}
            type="button"
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot(null)}
            onFocus={() => setHot(i)}
            onBlur={() => setHot(null)}
            aria-label={`${c.symbol}: ${c.caption}`}
            className={`pin-card absolute flex w-[200px] cursor-pointer flex-col gap-1 border bg-card p-[18px] text-left shadow-[0_12px_26px_rgb(0_0_0/0.4)] ${
              c.weak ? 'border-dashed border-teal/45' : 'border-white/15'
            }`}
            style={{ left: c.x, top: c.y, transform: `rotate(${c.tilt}deg)` }}
          >
            <span className="absolute -top-[9px] left-[91px] size-[18px] rounded-full bg-fg shadow-[0_2px_0_rgb(0_0_0/0.5)]" aria-hidden="true" />
            <CardBody c={c} />
          </button>
        ))}
      </div>

      {/* below xl: stacked */}
      <div className="flex flex-col gap-4 xl:hidden">
        <Clipping />
        <div className="grid grid-cols-2 gap-3">
          {CARDS.map((c) => (
            <div key={c.symbol} className={`flex flex-col gap-1 border bg-card p-4 ${c.weak ? 'border-dashed border-teal/45' : 'border-white/15'}`}>
              <CardBody c={c} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
