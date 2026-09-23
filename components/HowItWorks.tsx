const STEPS = [
  { title: 'Baca beritanya', body: 'AI membaca berita dan mencatat perusahaan, grup usaha, indeks, atau bidang usaha yang disebut.' },
  { title: 'Bandingkan dengan pasar', body: 'Gerak harga tiap saham dikurangi gerak IHSG selama 6 hari bursa, dengan data dari Sectors.' },
  { title: 'Tunjukkan buktinya', body: 'Tiap saham diberi label bukti kuat, sedang, atau lemah, lengkap dengan alasannya.' },
];

export function HowItWorks() {
  return (
    <section id="cara-kerja" aria-labelledby="cara-kerja-judul" className="border-b border-line">
      <h2 id="cara-kerja-judul" className="sr-only">
        Cara kerja
      </h2>
      <ol className="grid md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="glowcard relative flex flex-col gap-2.5 overflow-hidden border-line px-4 pt-9 pb-16 sm:px-10 md:border-r md:last:border-r-0 max-md:border-b">
            <div className="fx pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute -bottom-3/5 -left-1/5 h-[140%] w-[140%] bg-[radial-gradient(closest-side,rgb(245_165_36/0.28),rgb(43_217_197/0.14)_55%,transparent_80%)]" />
            </div>
            <span className="relative font-mono text-xs text-white/50">0{i + 1}</span>
            <h3 className="relative text-xl">{s.title}</h3>
            <p className="relative text-sm leading-relaxed text-white/60">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
