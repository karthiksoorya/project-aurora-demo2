import { stableUuid } from '../../common/ids';
import { INGREDIENTS, ingredientIdBySlug } from '../../fixtures/ingredients';
import type { DraftItem } from '../../domain/types';
import { computeFormula, normalize } from './formula-engine';

const cat = (id: string) => INGREDIENTS.find((i) => i.id === id);
const line = (slug: string, massPct: string, position: number): DraftItem => ({
  lineId: stableUuid(`t:${slug}:${position}`),
  ingredientId: ingredientIdBySlug(slug),
  massPct,
  position,
});

describe('formula engine', () => {
  it('totals exactly and reports completeness', () => {
    const items = [
      line('bergamot-eo', '33.333333', 0),
      line('hedione', '33.333333', 1),
      line('ambroxan', '33.333334', 2),
    ];
    const r = computeFormula(items, cat, '100.000');
    expect(r.totalPct).toBe('100.000000');
    expect(r.completeness).toBe('complete');
  });

  it('flags incomplete and over totals without changing quantities', () => {
    const items = [line('bergamot-eo', '40', 0), line('hedione', '50', 1)];
    const r = computeFormula(items, cat, '100.000');
    expect(r.completeness).toBe('incomplete');
    expect(r.remainingPct).toBe('10.000000');
    expect(items.map((i) => i.massPct)).toEqual(['40', '50']); // no implicit normalisation
    expect(r.issues.map((i) => i.code)).toContain('TOTAL_BELOW_100');
    const over = computeFormula([line('bergamot-eo', '70', 0), line('hedione', '40', 1)], cat, '100.000');
    expect(over.completeness).toBe('over');
    expect(over.issues.find((i) => i.code === 'TOTAL_ABOVE_100')?.severity).toBe('error');
  });

  it('computes accord balance per primary family and pyramid by role', () => {
    const r = computeFormula(
      [line('bergamot-eo', '30', 0), line('lemon-eo', '10', 1), line('hedione', '60', 2)],
      cat,
      '100.000',
    );
    expect(r.accords).toEqual([
      { family: 'floral', massPct: '60.000000', sharePct: '60.00' },
      { family: 'citrus', massPct: '40.000000', sharePct: '40.00' },
    ]);
    expect(r.pyramid.top.massPct).toBe('40.000000');
    expect(r.pyramid.heart.massPct).toBe('60.000000');
  });

  it('warns on zero quantities and duplicate ingredients', () => {
    const r = computeFormula([line('bergamot-eo', '0', 0), line('bergamot-eo', '100', 1)], cat, '100.000');
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['ZERO_QUANTITY', 'DUPLICATE_INGREDIENT']));
  });

  it('normalises explicitly to exactly 100 % with largest remainder', () => {
    const items = [line('bergamot-eo', '1', 0), line('hedione', '1', 1), line('ambroxan', '1', 2)];
    const n = normalize(items);
    expect(n.map((i) => i.massPct)).toEqual(['33.333334', '33.333333', '33.333333']);
    expect(computeFormula(n, cat, '100.000').totalPct).toBe('100.000000');
    expect(() => normalize([line('hedione', '0', 0)])).toThrow();
  });
});
