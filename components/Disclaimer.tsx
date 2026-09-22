import { DISCLAIMER } from '@/lib/explain/guard';

export function Disclaimer() {
  return (
    <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      {DISCLAIMER}
    </p>
  );
}
