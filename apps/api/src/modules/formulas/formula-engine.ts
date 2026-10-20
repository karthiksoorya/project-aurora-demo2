import {
  HUNDRED_PCT,
  formatPct,
  formatPctDp,
  lineGrams,
  parseGramsMilli,
  parsePct,
  shareOf,
} from '../../common/decimal';
import type { DraftItem, Family, Ingredient, NoteRole } from '../../domain/types';

/**
 * Deterministic formula calculations (spec §4, §7).
 * Units: mass fraction, % (w/w). Precision: 6 decimal places, exact integer arithmetic.
 * Normalisation is NEVER applied implicitly — only via the explicit `normalize()` operation.
 */

export type Completeness = 'complete' | 'incomplete' | 'over' | 'empty';

export interface FormulaIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  lineId?: string;
}

export interface FormulaComputation {
  unit: 'mass_pct_w_w';
  precisionDp: 6;
  totalPct: string;
  totalPctDisplay: string;
  remainingPct: string;
  completeness: Completeness;
  lineCount: number;
  issues: FormulaIssue[];
  accords: { family: Family; massPct: string; sharePct: string }[];
  pyramid: Record<NoteRole, { massPct: string; ingredientIds: string[] }>;
  gramsByLine: Record<string, string>;
  method: string;
}

export function completenessOf(total: bigint, lines: number): Completeness {
  if (lines === 0) return 'empty';
  if (total === HUNDRED_PCT) return 'complete';
  return total < HUNDRED_PCT ? 'incomplete' : 'over';
}

export function computeFormula(
  items: DraftItem[],
  catalog: (id: string) => Ingredient | undefined,
  batchSizeG: string,
): FormulaComputation {
  const issues: FormulaIssue[] = [];
  let total = 0n;
  const fam = new Map<Family, bigint>();
  const pyr: Record<NoteRole, { sum: bigint; ids: string[] }> = {
    top: { sum: 0n, ids: [] },
    heart: { sum: 0n, ids: [] },
    base: { sum: 0n, ids: [] },
  };
  const seen = new Map<string, string>();
  const batch = parseGramsMilli(batchSizeG);
  const gramsByLine: Record<string, string> = {};

  for (const it of items) {
    const v = parsePct(it.massPct);
    total += v;
    gramsByLine[it.lineId] = lineGrams(v, batch);
    const ing = catalog(it.ingredientId);
    if (!ing) {
      issues.push({
        severity: 'error',
        code: 'UNKNOWN_INGREDIENT',
        message: 'Ingredient not in catalog',
        lineId: it.lineId,
      });
      continue;
    }
    if (v === 0n)
      issues.push({
        severity: 'warning',
        code: 'ZERO_QUANTITY',
        message: `${ing.name} has 0 % — remove it or set a quantity`,
        lineId: it.lineId,
      });
    if (seen.has(it.ingredientId))
      issues.push({
        severity: 'warning',
        code: 'DUPLICATE_INGREDIENT',
        message: `${ing.name} appears on more than one line`,
        lineId: it.lineId,
      });
    seen.set(it.ingredientId, it.lineId);
    fam.set(ing.family, (fam.get(ing.family) ?? 0n) + v);
    pyr[ing.role].sum += v;
    if (!pyr[ing.role].ids.includes(ing.id)) pyr[ing.role].ids.push(ing.id);
  }

  const completeness = completenessOf(total, items.length);
  if (completeness === 'incomplete')
    issues.push({
      severity: 'warning',
      code: 'TOTAL_BELOW_100',
      message: `Total is ${formatPctDp(total, 2)} % — ${formatPctDp(HUNDRED_PCT - total, 2)} % unassigned`,
    });
  if (completeness === 'over')
    issues.push({
      severity: 'error',
      code: 'TOTAL_ABOVE_100',
      message: `Total is ${formatPctDp(total, 2)} % — exceeds 100 % by ${formatPctDp(total - HUNDRED_PCT, 2)} %`,
    });
  if (completeness === 'empty')
    issues.push({ severity: 'info', code: 'EMPTY', message: 'Formula has no ingredients yet' });

  const accords = [...fam.entries()]
    .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] > a[1] ? 1 : -1))
    .map(([family, sum]) => ({ family, massPct: formatPct(sum), sharePct: shareOf(sum, total) }));

  return {
    unit: 'mass_pct_w_w',
    precisionDp: 6,
    totalPct: formatPct(total),
    totalPctDisplay: formatPctDp(total, 2),
    remainingPct: formatPct(HUNDRED_PCT - total),
    completeness,
    lineCount: items.length,
    issues,
    accords,
    pyramid: {
      top: { massPct: formatPct(pyr.top.sum), ingredientIds: pyr.top.ids },
      heart: { massPct: formatPct(pyr.heart.sum), ingredientIds: pyr.heart.ids },
      base: { massPct: formatPct(pyr.base.sum), ingredientIds: pyr.base.ids },
    },
    gramsByLine,
    method:
      'Accord balance = sum of % (w/w) per primary family tag; share = family sum / formula total. Pyramid groups lines by conventional role tag. Not a sensory or performance prediction.',
  };
}

/**
 * Explicit normalisation to exactly 100.000000 % using the largest-remainder method
 * (deterministic tie-break by position). Only invoked by a user action.
 */
export function normalize(items: DraftItem[]): DraftItem[] {
  const vals = items.map((i) => parsePct(i.massPct));
  const total = vals.reduce((a, b) => a + b, 0n);
  if (total === 0n) throw new Error('Cannot normalise an empty or all-zero formula');
  const scaled = vals.map((v) => v * HUNDRED_PCT);
  const floors = scaled.map((s) => s / total);
  const rema = scaled.map((s, i) => ({ i, r: s % total }));
  let left = HUNDRED_PCT - floors.reduce((a, b) => a + b, 0n);
  rema.sort((a, b) => (b.r === a.r ? items[a.i].position - items[b.i].position : b.r > a.r ? 1 : -1));
  for (const { i } of rema) {
    if (left <= 0n) break;
    floors[i] += 1n;
    left -= 1n;
  }
  return items.map((it, i) => ({ ...it, massPct: formatPct(floors[i]) }));
}
