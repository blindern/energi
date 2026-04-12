import { Temporal } from "@js-temporal/polyfill";
import {
  ELVIA_CONTRACT_LIST,
  ELVIA_EMAIL,
  ELVIA_PASSWORD,
} from "../config.ts";
import { isDateInRange } from "../dates.ts";
import type { HourUsage } from "../extract/common.ts";
import {
  getMeterValues,
  loginToElvia,
  parseMeterValues,
} from "../extract/stroem.ts";
import { generateHourUsageCsvRows } from "../format.ts";

if (process.argv.length < 4) {
  process.stderr.write("Syntax: program <first-date> <last-date>");
  process.exit(1);
}

const firstDate = Temporal.PlainDate.from(process.argv[2]!);
const lastDate = Temporal.PlainDate.from(process.argv[3]!);

const session = await loginToElvia({
  email: ELVIA_EMAIL,
  password: ELVIA_PASSWORD,
});

const result: Record<string, HourUsage[]> = {};

for (const contract of ELVIA_CONTRACT_LIST) {
  if (contract.flag === "nofetch") {
    continue;
  }

  const meterValues = await getMeterValues({
    contractId: contract.contractId,
    firstDate,
    lastDate,
    session,
  });

  result[contract.meterId] = parseMeterValues(meterValues).filter((it) =>
    isDateInRange(firstDate, lastDate, it.date)
  );
}

const csv = Object.entries(result)
  .map(([meterName, meterData]) =>
    generateHourUsageCsvRows(meterName, meterData)
  )
  .join("");

process.stdout.write(csv);
