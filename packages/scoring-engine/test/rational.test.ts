import assert from "node:assert/strict";
import test from "node:test";
import { Rational, formatScore } from "../src/index.ts";

test("Rational preserves exact decimal and fraction values", () => {
  assert.equal(Rational.from("0.1").add("0.2").toFraction(), "3/10");
  assert.equal(Rational.from("-2/4").toFraction(), "-1/2");
  assert.equal(Rational.from("1.25").multiply("4/5").toFraction(), "1/1");
});

test("Rational rejects unsafe or inexact JavaScript numbers", () => {
  assert.throws(() => Rational.from(0.1), /decimals as strings/);
  assert.throws(() => Rational.from(Number.MAX_SAFE_INTEGER + 1), /decimals as strings/);
});

test("display uses decimal half-up and always shows two places", () => {
  assert.equal(formatScore("57.534"), "57.53");
  assert.equal(formatScore("57.535"), "57.54");
  assert.equal(formatScore("57.5"), "57.50");
  assert.equal(formatScore("-0.005"), "-0.01");
});
