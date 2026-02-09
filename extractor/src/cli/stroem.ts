import { Temporal } from "@js-temporal/polyfill";
import * as R from "ramda";
import {
  ELVIA_CONTRACT_LIST,
  ELVIA_CUSTOMER_ID,
  ELVIA_EMAIL,
  ELVIA_PASSWORD,
} from "../config.ts";
import { isDateInRange } from "../dates.ts";
import type { HourUsage } from "../extract/common.ts";
import {
  getAccessTokenFromCredentials,
  getMeterValues,
  parseMeterValues,
} from "../extract/stroem.ts";
import { generateHourUsageCsvRows } from "../format.ts";

if (process.argv.length < 4) {
  process.stderr.write("Syntax: program <first-date> <last-date>");
  process.exit(1);
}

const firstDate = Temporal.PlainDate.from(process.argv[2]!);
const lastDate = Temporal.PlainDate.from(process.argv[3]!);

const accessToken = await getAccessTokenFromCredentials({
  email: ELVIA_EMAIL,
  password: ELVIA_PASSWORD,
});

const result: Record<string, HourUsage[]> = {};
const years = R.range(firstDate.year, lastDate.year + 1);

for (const contract of ELVIA_CONTRACT_LIST) {
  const usages: HourUsage[] = [];

  if (contract.flag === "nofetch") {
    continue;
  }

  for (const year of years) {
    const meterValues = await getMeterValues({
      customerId: ELVIA_CUSTOMER_ID,
      contractId: contract.contractId,
      year: year,
      accessToken,
    });

    usages.push(
      ...parseMeterValues(meterValues).filter((it) =>
        isDateInRange(firstDate, lastDate, it.date)
      )
    );
  }

  result[contract.meterId] = usages;
}

const csv = Object.entries(result)
  .map(([meterName, meterData]) =>
    generateHourUsageCsvRows(meterName, meterData)
  )
  .join("");

process.stdout.write(csv);
