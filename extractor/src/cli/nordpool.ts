import { Temporal } from "@js-temporal/polyfill";
import { getNordpoolData } from "../extract/nordpool.ts";
import { formatHourForCsv, formatNumberForCsv } from "../format.ts";

if (process.argv.length < 3) {
  process.stderr.write("Syntax: program <date>");
  process.exit(1);
}

const dateStr = process.argv[2]!;
const data = await getNordpoolData(Temporal.PlainDate.from(dateStr));

process.stdout.write(
  data
    .map(
      (it) =>
        `${formatHourForCsv(it.date, it.hour)}\t${formatNumberForCsv(it.price)}`
    )
    .join("\n") + "\n"
);
