import { PCT_INPUT_RE } from './project-context.service';

describe('quantity input format', () => {
  it('accepts non-negative decimals with up to 6 dp', () => {
    for (const ok of ['0', '12', '12.5', '100.000000', '0.000001']) expect(PCT_INPUT_RE.test(ok)).toBe(true);
  });
  it('rejects negatives, exponents, commas and >6 dp', () => {
    for (const bad of ['-1', '1e2', '1,5', '1.0000001', '', ' ', 'abc']) expect(PCT_INPUT_RE.test(bad)).toBe(false);
  });
});
