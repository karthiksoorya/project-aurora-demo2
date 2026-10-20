import { HUNDRED_PCT, formatPct, parsePct } from '../../common/decimal';
import { sha256Canonical } from '../../common/hash';
import { stableUuid } from '../../common/ids';
import type { CheckStatus, FormulaVersion, Ingredient, ValidationFinding } from '../../domain/types';
import type { RuleSetDef } from '../../fixtures/rule-sets';

const RANK: Record<CheckStatus, number> = { pass: 0, warning: 1, not_assessed: 2, fail: 3 };
export const worst = (a: CheckStatus, b: CheckStatus) => (RANK[a] >= RANK[b] ? a : b);

/**
 * Pure, deterministic evaluation of a saved snapshot. Same inputs => identical findings (finding IDs are
 * derived from run seed + rule + line, so they are reproducible). No network, no model, no guessing.
 */
export function evaluate(
  version: FormulaVersion,
  ruleSets: RuleSetDef[],
  catalog: (id: string) => Ingredient | undefined,
  seed: string,
): { findings: ValidationFinding[]; status: CheckStatus; summary: Record<CheckStatus, number> } {
  const f: ValidationFinding[] = [];
  const s = version.snapshot;
  const id = (rule: string, extra = '') => stableUuid(`${seed}:${rule}:${extra}`);
  const push = (x: Omit<ValidationFinding, 'id'> & { key?: string }) => {
    const { key, ...rest } = x;
    f.push({ id: id(rest.ruleId, key ?? ''), ...rest });
  };

  for (const rs of ruleSets) {
    if (rs.kind === 'formula') {
      const total = s.items.reduce((a, i) => a + parsePct(i.massPct), 0n);
      push({
        ruleId: 'FC-001',
        scope: 'formula',
        category: 'formula_check',
        status: total === HUNDRED_PCT ? 'pass' : 'fail',
        message:
          total === HUNDRED_PCT
            ? 'Formula total is exactly 100.000000 % (w/w)'
            : `Formula total is ${formatPct(total)} % — a complete formula (100 %) is required for assessment`,
        evidence: {
          basis: 'Sum of snapshot massPct values (exact decimal arithmetic)',
          inputs: { totalPct: formatPct(total), lines: s.items.length },
        },
      });
      const zero = s.items.filter((i) => parsePct(i.massPct) === 0n);
      push({
        ruleId: 'FC-002',
        scope: 'formula',
        category: 'formula_check',
        status: zero.length ? 'warning' : 'pass',
        message: zero.length
          ? `${zero.length} line(s) have 0 %: ${zero.map((z) => z.ingredientName).join(', ')}`
          : 'No zero-quantity lines',
        evidence: { basis: 'massPct = 0 on any line', inputs: { lines: zero.map((z) => z.lineId) } },
      });
      const seen = new Map<string, number>();
      for (const i of s.items) seen.set(i.ingredientId, (seen.get(i.ingredientId) ?? 0) + 1);
      const dups = [...seen.entries()]
        .filter(([, n]) => n > 1)
        .map(([k]) => s.items.find((i) => i.ingredientId === k)!.ingredientName);
      push({
        ruleId: 'FC-003',
        scope: 'formula',
        category: 'formula_check',
        status: dups.length ? 'warning' : 'pass',
        message: dups.length
          ? `Ingredient on more than one line: ${dups.join(', ')}`
          : 'Each ingredient appears on one line',
        evidence: { basis: 'Count of lines per ingredientId' },
      });
      const unknown = s.items.filter((i) => !catalog(i.ingredientId));
      push({
        ruleId: 'FC-004',
        scope: 'formula',
        category: 'formula_check',
        status: unknown.length ? 'fail' : 'pass',
        message: unknown.length
          ? `${unknown.length} line(s) reference ingredients missing from the catalog`
          : 'All lines reference catalog ingredients',
        evidence: { basis: 'Lookup of ingredientId in catalog', inputs: { catalogVersion: s.catalogVersion } },
      });
      const hashOk = sha256Canonical(s) === version.snapshotHash;
      push({
        ruleId: 'FC-005',
        scope: 'formula',
        category: 'formula_check',
        status: hashOk ? 'pass' : 'fail',
        message: hashOk
          ? 'Snapshot integrity verified (SHA-256)'
          : 'Snapshot hash mismatch — record may have been altered',
        evidence: { basis: 'sha256 of canonical snapshot JSON', inputs: { snapshotHash: version.snapshotHash } },
      });
      // data completeness per ingredient: which inputs a regulatory assessment would need are missing
      for (const it of s.items) {
        const ing = catalog(it.ingredientId);
        if (!ing) continue;
        const missing = ing.properties.filter((p) => p.status === 'missing').map((p) => p.label);
        const unverified = ing.properties.filter((p) => p.status === 'unverified').map((p) => p.label);
        push({
          key: it.lineId,
          ruleId: 'DC-001',
          scope: 'ingredient',
          category: 'data_completeness',
          ingredientId: it.ingredientId,
          lineId: it.lineId,
          status: missing.length || unverified.length ? 'warning' : 'pass',
          message: missing.length
            ? `${ing.name}: ${missing.length} data field(s) unavailable, ${unverified.length} unverified`
            : `${ing.name}: all catalog fields sourced`,
          evidence: {
            basis: 'Per-field verification status in the catalog',
            missingInputs: missing,
            inputs: { unverified },
          },
        });
      }
    } else {
      // regulatory / allergen rule sets: no dataset configured => explicitly not assessed
      for (const it of s.items) {
        push({
          key: it.lineId,
          ruleId: rs.kind === 'regulatory' ? 'REG-NA' : 'ALG-NA',
          scope: 'ingredient',
          category: rs.kind === 'regulatory' ? 'regulatory' : 'allergen',
          ingredientId: it.ingredientId,
          lineId: it.lineId,
          status: 'not_assessed',
          message: `${it.ingredientName}: ${rs.title} not assessed — no verified dataset configured`,
          evidence: { basis: `${rs.title}, ${rs.edition}`, missingInputs: rs.missingInputs, source: rs.id },
        });
      }
    }
  }

  const summary: Record<CheckStatus, number> = { pass: 0, warning: 0, fail: 0, not_assessed: 0 };
  let status: CheckStatus = 'pass';
  for (const x of f) {
    summary[x.status]++;
    status = worst(status, x.status);
  }
  return { findings: f, status, summary };
}
