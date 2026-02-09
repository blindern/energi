import { getDailyData } from "../extract/temperatur.ts";
import { formatNumberForCsv } from "../format.ts";

const data = await getDailyData(2022);

const result =
  data.map((it) => `${it.day}\t${formatNumberForCsv(it.mean)}`).join("\n") +
  "\n";

process.stdout.write(result);
