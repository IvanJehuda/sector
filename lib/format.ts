export function formatPct(x: number): string {
  const s = (x * 100).toFixed(1).replace('.', ',');
  return `${x > 0 ? '+' : ''}${s}%`;
}

export function formatIdrBillion(x: number): string {
  return `Rp ${(Math.abs(x) / 1e9).toFixed(1).replace('.', ',')} miliar`;
}
