/**
 * Fixed-point decimal arithmetic.
 *
 * Memecoin prices range from ~1e-12 to thousands of USD, and PnL accounting
 * must not accumulate floating-point error. All monetary and quantity math in
 * the platform goes through this type, which stores values as a scaled BigInt
 * with {@link Fixed.DECIMALS} decimal places.
 */
const DECIMALS = 12;
const SCALE = 10n ** BigInt(DECIMALS);

export class Fixed {
  /** The value multiplied by 10^DECIMALS, as an integer. */
  readonly raw: bigint;

  private constructor(raw: bigint) {
    this.raw = raw;
  }

  static readonly DECIMALS = DECIMALS;
  static readonly ZERO = new Fixed(0n);
  static readonly ONE = new Fixed(SCALE);

  static fromRaw(raw: bigint): Fixed {
    return new Fixed(raw);
  }

  /** Construct from a number or decimal string without binary float drift. */
  static from(value: number | string | Fixed): Fixed {
    if (value instanceof Fixed) return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error(`Fixed.from: non-finite number ${value}`);
      // Route through a string with enough precision to avoid float artifacts.
      return Fixed.from(value.toFixed(DECIMALS));
    }
    const trimmed = value.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      throw new Error(`Fixed.from: invalid decimal string "${value}"`);
    }
    const negative = trimmed.startsWith('-');
    const unsigned = negative ? trimmed.slice(1) : trimmed;
    const [intPart = '0', fracPart = ''] = unsigned.split('.');
    const frac = (fracPart + '0'.repeat(DECIMALS)).slice(0, DECIMALS);
    const raw = BigInt(intPart) * SCALE + BigInt(frac);
    return new Fixed(negative ? -raw : raw);
  }

  add(other: Fixed): Fixed {
    return new Fixed(this.raw + other.raw);
  }

  sub(other: Fixed): Fixed {
    return new Fixed(this.raw - other.raw);
  }

  /** Multiply two fixed-point values (rescaling the product). */
  mul(other: Fixed | number): Fixed {
    const o = Fixed.from(other);
    return new Fixed((this.raw * o.raw) / SCALE);
  }

  /** Divide two fixed-point values. Throws on divide-by-zero. */
  div(other: Fixed | number): Fixed {
    const o = Fixed.from(other);
    if (o.raw === 0n) throw new Error('Fixed.div: division by zero');
    return new Fixed((this.raw * SCALE) / o.raw);
  }

  abs(): Fixed {
    return this.raw < 0n ? new Fixed(-this.raw) : this;
  }

  neg(): Fixed {
    return new Fixed(-this.raw);
  }

  min(other: Fixed): Fixed {
    return this.raw <= other.raw ? this : other;
  }

  max(other: Fixed): Fixed {
    return this.raw >= other.raw ? this : other;
  }

  eq(other: Fixed): boolean {
    return this.raw === other.raw;
  }

  lt(other: Fixed): boolean {
    return this.raw < other.raw;
  }

  lte(other: Fixed): boolean {
    return this.raw <= other.raw;
  }

  gt(other: Fixed): boolean {
    return this.raw > other.raw;
  }

  gte(other: Fixed): boolean {
    return this.raw >= other.raw;
  }

  isZero(): boolean {
    return this.raw === 0n;
  }

  isNegative(): boolean {
    return this.raw < 0n;
  }

  /** Lossy conversion to a JS number, for display and ratio math only. */
  toNumber(): number {
    return Number(this.raw) / Number(SCALE);
  }

  /** Exact decimal string representation. */
  toString(): string {
    const negative = this.raw < 0n;
    const abs = negative ? -this.raw : this.raw;
    const intPart = abs / SCALE;
    const fracPart = (abs % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '');
    const body = fracPart ? `${intPart}.${fracPart}` : `${intPart}`;
    return negative ? `-${body}` : body;
  }

  toJSON(): string {
    return this.toString();
  }
}

/** Convenience constructor. */
export function fixed(value: number | string | Fixed): Fixed {
  return Fixed.from(value);
}
