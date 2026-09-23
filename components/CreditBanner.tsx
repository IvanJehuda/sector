import { getDb } from '@/lib/db/client';
import { budgetState } from '@/lib/sectors/budget';
import { creditBudget } from '@/lib/sectors/from-env';
import { dbLedger } from '@/lib/sectors/stores';

async function credits() {
  const used = await dbLedger(await getDb()).total();
  const budget = creditBudget();
  return { used, budget, left: Math.max(0, budget - used), state: budgetState(used, budget) };
}

/** Small quota readout for the nav bar. */
export async function CreditPill() {
  const { left, budget, state } = await credits();
  const dot = state === 'ok' ? 'bg-up' : state === 'warn' ? 'bg-warn' : 'bg-down';
  return (
    <span className="flex items-center gap-2 border border-line-strong px-3 py-2 font-mono text-[11px] tracking-wide sm:text-xs">
      <span className={`inline-block size-1.5 ${dot}`} aria-hidden="true" />
      <span className="hidden text-white/60 sm:inline">KUOTA DATA TERSISA</span>
      <span>
        {left.toLocaleString('id-ID')} <span className="hidden text-white/50 sm:inline">dari {budget.toLocaleString('id-ID')}</span>
      </span>
    </span>
  );
}

/** Warning shown only when the Sectors quota runs low. */
export async function CreditBanner() {
  const { left, budget, state } = await credits();
  if (state === 'ok') return null;
  const pctLeft = budget > 0 ? Math.round((left / budget) * 100) : 0;
  return (
    <p
      role="alert"
      className={`flex gap-3 border px-4 py-3 text-sm leading-relaxed ${
        state === 'warn' ? 'border-warn/45 bg-warn/10' : 'border-down/50 bg-down/10'
      }`}
    >
      <span className={state === 'warn' ? 'text-warn' : 'text-down'} aria-hidden="true">
        !
      </span>
      {state === 'warn'
        ? `Kuota data tinggal ${pctLeft}%. Pengambilan berita otomatis dihentikan sementara. Analisis dari tautan atau teks tetap bisa dipakai.`
        : 'Kuota data hampir habis. Analisis baru hanya memakai data yang sudah tersimpan, jadi hasilnya bisa kurang lengkap.'}
    </p>
  );
}
