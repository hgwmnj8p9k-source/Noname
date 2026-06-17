import { describe, expect, it } from 'vitest';
import { Fixed, fixed } from './money.js';

describe('Fixed', () => {
  it('parses and stringifies decimals without float drift', () => {
    expect(fixed('0.1').add(fixed('0.2')).toString()).toBe('0.3');
    expect(fixed(0.1).add(fixed(0.2)).toString()).toBe('0.3');
  });

  it('handles very small memecoin prices', () => {
    const p = fixed('0.000000004212');
    expect(p.toString()).toBe('0.000000004212');
    expect(p.mul(1_000_000_000).toString()).toBe('4.212');
  });

  it('multiplies and divides consistently', () => {
    const qty = fixed('1500.5');
    const price = fixed('0.0034');
    const notional = qty.mul(price);
    expect(notional.toString()).toBe('5.1017');
    expect(notional.div(price).toString()).toBe('1500.5');
  });

  it('supports comparisons and sign helpers', () => {
    expect(fixed(5).gt(fixed(3))).toBe(true);
    expect(fixed(-2).isNegative()).toBe(true);
    expect(fixed(-2).abs().toString()).toBe('2');
    expect(fixed(3).min(fixed(7)).toString()).toBe('3');
    expect(fixed(3).max(fixed(7)).toString()).toBe('7');
  });

  it('throws on divide by zero and bad input', () => {
    expect(() => fixed(1).div(fixed(0))).toThrow();
    expect(() => Fixed.from('abc')).toThrow();
    expect(() => Fixed.from(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('serializes to a string in JSON', () => {
    expect(JSON.stringify({ pnl: fixed('12.34') })).toBe('{"pnl":"12.34"}');
  });
});
