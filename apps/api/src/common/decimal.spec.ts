import { formatPct, formatPctDp, lineGrams, parseGramsMilli, parsePct, shareOf } from './decimal';

describe('decimal (fixed-point % w/w)', () => {
  it('parses and formats exactly at 6 dp', () => {
    expect(formatPct(parsePct('12.5'))).toBe('12.500000');
    expect(formatPct(parsePct('0.000001'))).toBe('0.000001');
    expect(formatPct(parsePct('100'))).toBe('100.000000');
  });
  it('has no binary-float drift (0.1 + 0.2)', () => {
    expect(formatPct(parsePct('0.1') + parsePct('0.2'))).toBe('0.300000');
  });
  it('rejects negatives, too many decimals and garbage', () => {
    for (const bad of ['-1', '1.0000001', 'abc', '', '1e2', '1,5']) expect(() => parsePct(bad)).toThrow();
  });
  it('rounds display values half away from zero', () => {
    expect(formatPctDp(parsePct('33.335'), 2)).toBe('33.34');
    expect(formatPctDp(parsePct('33.334999'), 2)).toBe('33.33');
  });
  it('computes grams of a batch', () => {
    expect(lineGrams(parsePct('12.5'), parseGramsMilli('250'))).toBe('31.2500');
    expect(lineGrams(parsePct('33.333333'), parseGramsMilli('10'))).toBe('3.3333');
  });
  it('computes shares with 2 dp', () => {
    expect(shareOf(1n, 3n)).toBe('33.33');
    expect(shareOf(0n, 0n)).toBe('0.00');
  });
});
