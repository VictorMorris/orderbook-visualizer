// Thin-space thousands grouping keeps digit columns aligned in a mono font
// without a comma stealing a character cell.
const THIN = ' ';

// 1234567.5 → "1 234 567.50"
export function fmtPrice(p: number, dp = 2): string {
  const [int, frac] = p.toFixed(dp).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, THIN) + (frac ? '.' + frac : '');
}

// Pass dp for a column that must not change width row to row; omit it for
// one-off readouts where magnitude varies wildly (BTC prints run to 1e-5).
export function fmtSize(s: number, dp?: number): string {
  // Caller-fixed precision: same dp every row, so the column can't jitter.
  if (dp !== undefined) return s >= 1000 ? (s / 1000).toFixed(1) + 'k' : s.toFixed(dp);
  // Auto precision: fewer decimals as magnitude grows, keeping ~4 significant
  // digits so 0.00012 and 4200 are both readable.
  if (s >= 1000) return (s / 1000).toFixed(1) + 'k';
  if (s >= 100) return s.toFixed(1);
  if (s >= 1) return s.toFixed(3);
  return s.toFixed(5);
}


export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}
