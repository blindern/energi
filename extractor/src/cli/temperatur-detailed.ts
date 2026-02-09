import { Temporal } from "@js-temporal/polyfill";
import { getHourlyData } from "../extract/temperatur.ts";
import { formatHourForCsv, formatNumberForCsv } from "../format.ts";

if (process.argv.length < 3) {
  process.stderr.write("Syntax: program <date>");
  process.exit(1);
}

const date = process.argv[2]!;

const data = await getHourlyData(Temporal.PlainDate.from(date));

const result =
  data
    .map(
      (it) =>
        `${formatHourForCsv(it.date, it.hour)}\t${formatNumberForCsv(
          it.temperature
        )}`
    )
    .join("\n") + "\n";

process.stdout.write(result);
