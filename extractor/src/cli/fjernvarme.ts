import { Temporal } from "@js-temporal/polyfill";
import {
  FJERNVARME_ANLEGG_NUMMER,
  FJERNVARME_KUNDE_ID,
  FJERNVARME_PASSWORD,
  FJERNVARME_USERNAME,
} from "../config.ts";
import { getAccessToken, getHourlyData } from "../extract/fjernvarme.ts";
import { generateHourUsageCsvRows } from "../format.ts";

const accessToken = await getAccessToken(
  FJERNVARME_USERNAME,
  FJERNVARME_PASSWORD
);

if (process.argv.length < 4) {
  process.stderr.write("Syntax: program <first-date> <last-date>");
  process.exit(1);
}

const firstDate = process.argv[2]!;
const lastDate = process.argv[3]!;

const usage = await getHourlyData({
  accessToken,
  anleggNummer: FJERNVARME_ANLEGG_NUMMER,
  kundeId: FJERNVARME_KUNDE_ID,
  firstDate: Temporal.PlainDate.from(firstDate),
  lastDate: Temporal.PlainDate.from(lastDate),
});

const result = generateHourUsageCsvRows("Fjernvarme", usage);

process.stdout.write(result);
