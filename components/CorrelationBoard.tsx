'use client';

import { useEffect, useRef, useState } from 'react';

type Card = {
  symbol: string;
  link: string;
  label: string;
  value: string;
  tone: 'down' | 'up' | 'flat';
  unusual: boolean;
  weak?: boolean;
  caption: string;
  /** Top-left inside the 880×540 design board. */
  x: number;
  y: number;
  tilt: number;
};

// Illustrative example for the landing page, not live data.
const CARDS: Card[] = [
  {
    symbol: 'BBRI', link: 'Disebut di berita', label: 'BBRI · DISEBUT DI BERITA', value: '−4,1%', tone: 'down', unusual: true,
    caption: 'BBRI disebut di berita. Dalam 6 hari bursa, harganya turun 4,1% lebih dalam dari pasar. Untuk BBRI, gerak sebesar ini tidak biasa.',
    x: 470, y: 30, tilt: 2,
  },
  {
    symbol: 'BMRI', link: 'Satu indeks BUMN', label: 'BMRI · SATU INDEKS BUMN', value: '−3,1%', tone: 'down', unusual: true,
    caption: 'BMRI tidak disebut, tapi satu indeks BUMN dengan BBRI. Harganya turun 3,1% lebih dalam dari pasar, juga tidak biasa.',
    x: 680, y: 125, tilt: -2.5,
  },
  {
    symbol: 'BBNI', link: 'Bidang usaha sama', label: 'BBNI · BIDANG USAHA SAMA', value: '−1,2%', tone: 'flat', unusual: false,
    caption: 'BBNI hanya satu bidang usaha dengan bank yang disebut. Selisihnya dengan pasar masih wajar.',
    x: 480, y: 290, tilt: -1,
  },
  {
    symbol: 'BRIS', link: 'Satu grup usaha', label: 'BRIS · SATU GRUP USAHA', value: '+1,5%', tone: 'up', unusual: false, weak: true,
    caption: 'BRIS satu grup usaha dengan BRI, tapi harganya naik 1,5% di atas pasar. Kaitannya lemah.',
    x: 690, y: 370, tilt: 3,
  },
];

const W = 880;
const H = 540;
const CARD_W = 190;
const PIN = { x: 330, y: 270 };
const INTRO = 'Satu berita bisa berkaitan dengan banyak saham. Arahkan kursor ke kartu untuk melihat alasannya.';
const TONE = { down: 'text-down', up: 'text-up', flat: 'text-fg' };
const AUTOPLAY_MS = 3200;

function CardBody({ c }: { c: Card }) {
  return (
    <>
      <span className="font-mono text-lg font-medium">{c.symbol}</span>
      <span className="text-[13px] text-white/55">{c.link}</span>
      <span className={`text-[42px] leading-none font-light tracking-tight ${TONE[c.tone]}`}>{c.value}</span>
      <span className="font-mono text-[11px] text-white/50">
        dari pasar · {c.unusual ? <b className="font-medium text-amber">tidak biasa</b> : 'masih wajar'}
      </span>
    </>
  );
}

function Clipping() {
  return (
    <div className="flex flex-col gap-2.5 border border-white/15 bg-surface p-6 shadow-[0_20px_40px_rgb(0_0_0/0.45)]">
      <span className="font-mono text-[11px] tracking-widest text-white/55">CONTOH BERITA · 2 MARET 2026</span>
      <p className="text-2xl leading-tight tracking-tight">Dividen BUMN perbankan dinaikkan ke 70% laba</p>
      <p className="text-sm leading-relaxed text-white/60">
        Kementerian BUMN meminta bank pelat merah menyetor porsi laba lebih besar mulai tahun buku 2026…
      </p>
      <span className="mt-1 self-start border border-amber/60 px-2 py-0.5 font-mono text-[11px] tracking-wider text-amber">DATA CONTOH</span>
    </div>
  );
}

/** Scale the fixed-size design board to the width it gets. */
function useFitScale(max: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(max, entry.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [max]);
  return { ref, scale };
}

export function CorrelationBoard() {
  const [hover, setHover] = useState<number | null>(null);
  const [auto, setAuto] = useState<number | null>(null);
  const { ref, scale } = useFitScale(1.3);

  // Walk through the cards while nobody is pointing at the board.
  useEffect(() => {
    if (hover !== null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = setTimeout(() => setAuto(0), 1800);
    const id = setInterval(() => setAuto((i) => (i === null ? 0 : (i + 1) % CARDS.length)), AUTOPLAY_MS);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [hover]);

  const hot = hover ?? auto;
  const card = hot === null ? null : CARDS[hot];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2" aria-live="polite">
        <span className="font-mono text-[11px] tracking-widest text-amber">{card?.label ?? 'CONTOH'}</span>
        <p className="min-h-[3.2em] max-w-[560px] leading-relaxed text-white/75">{card?.caption ?? INTRO}</p>
      </div>

      {/* sm and up: pinned board with strings, scaled to fit */}
      <div ref={ref} className="hidden w-full sm:block" style={{ height: H * scale }}>
        <div className="relative origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
            {CARDS.map((c, i) => {
              const to = { x: c.x + CARD_W / 2, y: c.y };
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
                    className={c.weak ? undefined : 'draw'}
                    style={{ transition: 'stroke-width .25s, stroke-opacity .25s', animationDelay: `${0.4 + i * 0.15}s` }}
                  />
                </g>
              );
            })}
          </svg>
          <div className="drop absolute top-[150px] left-0 w-[330px] -rotate-2 transition-transform duration-300 hover:rotate-0">
            <Clipping />
            <span className="absolute top-[111px] -right-[9px] size-[18px] rounded-full bg-amber shadow-[0_0_18px_rgb(245_165_36/0.8)]" aria-hidden="true" />
          </div>
          {CARDS.map((c, i) => (
            <button
              key={c.symbol}
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${c.symbol}: ${c.caption}`}
              className={`pin-card drop absolute flex cursor-pointer flex-col gap-1 border bg-card p-[18px] text-left shadow-[0_12px_26px_rgb(0_0_0/0.4)] ${
                c.weak ? 'border-dashed border-teal/45' : 'border-white/15'
              } ${hot === i ? '!border-amber/60 shadow-[0_24px_44px_rgb(0_0_0/0.55),0_0_0_1px_rgb(245_165_36/0.5)]' : ''}`}
              style={{
                left: c.x,
                top: c.y,
                width: CARD_W,
                transform: hot === i ? 'translateY(-8px)' : `rotate(${c.tilt}deg)`,
                animationDelay: `${0.8 + i * 0.12}s`,
              }}
            >
              <span className="absolute -top-[9px] left-[86px] size-[18px] rounded-full bg-fg shadow-[0_2px_0_rgb(0_0_0/0.5)]" aria-hidden="true" />
              <CardBody c={c} />
            </button>
          ))}
        </div>
      </div>

      {/* phones: stacked */}
      <div className="flex flex-col gap-4 sm:hidden">
        <Clipping />
        <div className="grid grid-cols-2 gap-3">
          {CARDS.map((c) => (
            <div key={c.symbol} className={`flex flex-col gap-1 border bg-card p-4 ${c.weak ? 'border-dashed border-teal/45' : 'border-white/15'}`}>
              <CardBody c={c} />
            </div>
          ))}
        </div>
      </div>

      <div className="hidden flex-wrap gap-6 font-mono text-[11px] tracking-wide text-white/50 sm:flex">
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
  );
}
