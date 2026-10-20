/**
 * Fixed-point decimal helpers for mass percentages.
 * Internal unit: 1 micro-percent (1e-6 %) as BigInt — exact, no binary float drift.
 */
export const PCT_SCALE = 1_000_000n;
export const HUNDRED_PCT = 100n * PCT_SCALE;
const PCT_RE = /^(\d{1,3})(?:\.(\d{1,6}))?$/;
const GRAMS_RE = /^(\d{1,6})(?:\.(\d{1,3}))?$/;

export function isPctString(v: unknown): v is string {
  return typeof v === 'string' && PCT_RE.test(v);
}

/** Parse "12.5" / "12.500000" into micro-percent. Throws on bad format. */
export function parsePct(v: string): bigint {
  const m = PCT_RE.exec(v);
  if (!m) throw new Error(`Invalid percentage "${v}"`);
  const frac = (m[2] ?? '').padEnd(6, '0');
  return BigInt(m[1]) * PCT_SCALE + BigInt(frac);
}

export function formatPct(micro: bigint): string {
  const neg = micro < 0n;
  const a = neg ? -micro : micro;
  const s = `${a / PCT_SCALE}.${(a % PCT_SCALE).toString().padStart(6, '0')}`;
  return neg ? `-${s}` : s;
}

/** Round micro-percent to `dp` decimals (half away from zero) and format. */
export function formatPctDp(micro: bigint, dp: number): string {
  const step = 10n ** BigInt(6 - dp);
  const neg = micro < 0n;
  const a = neg ? -micro : micro;
  const r = ((a + step / 2n) / step) * step;
  const whole = r / PCT_SCALE;
  const frac = (r % PCT_SCALE).toString().padStart(6, '0').slice(0, dp);
  const s = dp > 0 ? `${whole}.${frac}` : `${whole}`;
  return neg && r !== 0n ? `-${s}` : s;
}

export function isGramsString(v: unknown): v is string {
  return typeof v === 'string' && GRAMS_RE.test(v);
}

/** grams in milli-grams */
export function parseGramsMilli(v: string): bigint {
  const m = GRAMS_RE.exec(v);
  if (!m) throw new Error(`Invalid batch size "${v}"`);
  return BigInt(m[1]) * 1000n + BigInt((m[2] ?? '').padEnd(3, '0'));
}

/** mass (g, 4 dp string) of a line: pct% of batch. */
export function lineGrams(pctMicro: bigint, batchMilli: bigint): string {
  // pctMicro [1e-6 %] * batchMilli [1e-3 g] / 100 => 1e-9 g ; round to 1e-4 g
  const nano = pctMicro * batchMilli; // still needs /100
  const unit = 100n * 100_000n; // /100 and nano->1e-4 g
  const r = (nano + unit / 2n) / unit;
  return `${r / 10_000n}.${(r % 10_000n).toString().padStart(4, '0')}`;
}

/** Share of `part` in `total` as percent string with 2 dp. */
export function shareOf(part: bigint, total: bigint): string {
  if (total === 0n) return '0.00';
  const bp = (part * 10_000n * 2n + total) / (total * 2n); // basis points, rounded
  return `${bp / 100n}.${(bp % 100n).toString().padStart(2, '0')}`;
}
