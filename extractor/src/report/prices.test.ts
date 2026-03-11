import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, test } from "vitest";
import { fjernvarmeRabatt, getSubsidizedKwh } from "./prices.ts";

test("fjernvarmeRabatt", () => {
  const month09 = Temporal.PlainYearMonth.from("2022-09");
  const month12 = Temporal.PlainYearMonth.from("2022-12");

  expect(fjernvarmeRabatt(month09, 0.3, 0)).toBeCloseTo(-0.015);
  expect(fjernvarmeRabatt(month09, 2.5, 1.2)).toBeCloseTo(-0.065);
  expect(fjernvarmeRabatt(month09, 5, 3)).toBeCloseTo(-0.1);

  expect(fjernvarmeRabatt(month12, 0.3, 0)).toBeCloseTo(-0.015);
  expect(fjernvarmeRabatt(month12, 2.5, 1.2)).toBeCloseTo(-0.10875);
  expect(fjernvarmeRabatt(month12, 5, 3)).toBeCloseTo(-0.31875);
});

describe("getSubsidizedKwh", () => {
  test("fully within cap", () => {
    expect(getSubsidizedKwh(100, 5000, 0)).toBe(100);
    expect(getSubsidizedKwh(100, 5000, 4000)).toBe(100);
  });

  test("straddles cap boundary - pro-rated", () => {
    expect(getSubsidizedKwh(200, 5000, 4900)).toBe(100);
    expect(getSubsidizedKwh(500, 4500, 4400)).toBe(100);
  });

  test("fully beyond cap", () => {
    expect(getSubsidizedKwh(100, 5000, 5000)).toBe(0);
    expect(getSubsidizedKwh(100, 5000, 6000)).toBe(0);
  });

  test("exact cap boundary", () => {
    expect(getSubsidizedKwh(100, 5000, 4900)).toBe(100);
    expect(getSubsidizedKwh(100, 5000, 5000)).toBe(0);
  });
});
