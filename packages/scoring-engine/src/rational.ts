export type RationalInput = Rational | string | number | bigint;

function absolute(value: bigint) {
  return value < 0n ? -value : value;
}

function greatestCommonDivisor(left: bigint, right: bigint) {
  let a = absolute(left);
  let b = absolute(right);
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a || 1n;
}

function powerOfTen(exponent: number) {
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new Error("Decimal places must be a nonnegative integer.");
  }
  return 10n ** BigInt(exponent);
}

export class Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;

  constructor(numerator: bigint, denominator: bigint = 1n) {
    if (denominator === 0n) throw new Error("A rational denominator cannot be zero.");
    const sign = denominator < 0n ? -1n : 1n;
    const divisor = greatestCommonDivisor(numerator, denominator);
    this.numerator = (numerator * sign) / divisor;
    this.denominator = absolute(denominator) / divisor;
  }

  static from(value: RationalInput): Rational {
    if (value instanceof Rational) return value;
    if (typeof value === "bigint") return new Rational(value);
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) {
        throw new Error(
          "Non-integer numeric inputs are not accepted. Pass decimals as strings to preserve exactness.",
        );
      }
      return new Rational(BigInt(value));
    }

    const input = value.trim();
    if (!input) throw new Error("An empty value is not a valid rational number.");
    if (input.includes("/")) {
      const pieces = input.split("/");
      if (pieces.length !== 2 || !/^[+-]?\d+$/.test(pieces[0]) || !/^\d+$/.test(pieces[1])) {
        throw new Error(`Invalid rational value: ${value}`);
      }
      return new Rational(BigInt(pieces[0]), BigInt(pieces[1]));
    }

    const match = input.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
    if (!match) throw new Error(`Invalid decimal value: ${value}`);
    const sign = match[1] === "-" ? -1n : 1n;
    const whole = match[2];
    const fraction = match[3] ?? "";
    const denominator = powerOfTen(fraction.length);
    return new Rational(sign * BigInt(`${whole}${fraction}`), denominator);
  }

  add(other: RationalInput) {
    const right = Rational.from(other);
    return new Rational(
      this.numerator * right.denominator + right.numerator * this.denominator,
      this.denominator * right.denominator,
    );
  }

  subtract(other: RationalInput) {
    const right = Rational.from(other);
    return new Rational(
      this.numerator * right.denominator - right.numerator * this.denominator,
      this.denominator * right.denominator,
    );
  }

  multiply(other: RationalInput) {
    const right = Rational.from(other);
    return new Rational(
      this.numerator * right.numerator,
      this.denominator * right.denominator,
    );
  }

  divide(other: RationalInput) {
    const right = Rational.from(other);
    if (right.numerator === 0n) throw new Error("Division by zero is not allowed.");
    return new Rational(
      this.numerator * right.denominator,
      this.denominator * right.numerator,
    );
  }

  negate() {
    return new Rational(-this.numerator, this.denominator);
  }

  abs() {
    return this.numerator < 0n ? this.negate() : this;
  }

  compare(other: RationalInput) {
    const right = Rational.from(other);
    const difference =
      this.numerator * right.denominator - right.numerator * this.denominator;
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  }

  equals(other: RationalInput) {
    return this.compare(other) === 0;
  }

  isZero() {
    return this.numerator === 0n;
  }

  toFraction() {
    return `${this.numerator}/${this.denominator}`;
  }

  toDecimal(places = 50, trimTrailingZeros = true) {
    const scale = powerOfTen(places);
    const negative = this.numerator < 0n;
    const unsigned = absolute(this.numerator);
    let scaled = (unsigned * scale) / this.denominator;
    const remainder = (unsigned * scale) % this.denominator;
    if (remainder * 2n >= this.denominator) scaled += 1n;

    const whole = scaled / scale;
    let fraction = (scaled % scale).toString().padStart(places, "0");
    if (trimTrailingZeros) fraction = fraction.replace(/0+$/, "");
    const prefix = negative && (whole !== 0n || fraction.length > 0) ? "-" : "";
    return fraction ? `${prefix}${whole}.${fraction}` : `${prefix}${whole}`;
  }

  toJSON() {
    return this.toFraction();
  }
}

export const ZERO = new Rational(0n);
export const ONE_HUNDRED = new Rational(100n);

export function rationalMax(left: RationalInput, right: RationalInput) {
  const a = Rational.from(left);
  const b = Rational.from(right);
  return a.compare(b) >= 0 ? a : b;
}

export function rationalMin(left: RationalInput, right: RationalInput) {
  const a = Rational.from(left);
  const b = Rational.from(right);
  return a.compare(b) <= 0 ? a : b;
}

export function sumRationals(values: Iterable<RationalInput>) {
  let total = ZERO;
  for (const value of values) total = total.add(value);
  return total;
}

export function formatScore(value: RationalInput) {
  return Rational.from(value).toDecimal(2, false);
}
