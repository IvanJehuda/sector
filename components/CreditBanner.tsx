import { getDb } from '@/lib/db/client';
import { budgetState } from '@/lib/sectors/budget';
import { creditBudget } from '@/lib/sectors/from-env';
import { dbLedger } from '@/lib/sectors/stores';

export async function CreditBanner() {
  const used = await dbLedger(await getDb()).total();
  const budget = creditBudget();
  const state = budgetState(used, budget);
  if (state === 'ok') {
    return <p className="text-sm text-gray-500">Kredit Sectors terpakai: {used} / {budget}</p>;
  }
  return (
    <p role="alert" className={`rounded-md p-3 text-sm ${state === 'warn' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'}`}>
      {state === 'warn'
        ? `Kredit Sectors sudah ${used}/${budget} (≥80%). Penerima berita otomatis dihentikan.`
        : `Kredit Sectors sudah ${used}/${budget} (≥90%). Hanya data cache yang dipakai.`}
    </p>
  );
}
