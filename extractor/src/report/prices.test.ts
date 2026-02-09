import { Temporal } from "@js-temporal/polyfill";
import { expect, test } from "vitest";
import { fjernvarmeRabatt } from "./prices.ts";

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
