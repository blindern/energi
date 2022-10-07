import { Temporal } from "@js-temporal/polyfill";
import * as R from "ramda";
import {
  ELVIA_CONTRACT_LIST,
  ELVIA_CUSTOMER_ID,
  ELVIA_EMAIL,
  ELVIA_PASSWORD,
  FJERNVARME_ANLEGG_NUMMER,
  FJERNVARME_KUNDE_ID,
  FJERNVARME_PASSWORD,
  FJERNVARME_USERNAME,
} from "../config.js";
import { datesInRange, isDateInRange } from "../dates.js";
import { HourUsage } from "../extract/common.js";
import {
  getAccessToken,
  getHourlyData as getFjernvarmeHourlyData,
} from "../extract/fjernvarme.js";
import { getNordpoolData } from "../extract/nordpool.js";
import {
  getAccessTokenFromCredentials,
  getMeterValues,
  parseMeterValues,
} from "../extract/stroem.js";
import {
  getDailyData as getTemperatureDailyData,
  getHourlyData as getTemperatureHourlyData,
} from "../extract/temperatur.js";
import {
  Data,
  DataNordpoolPriceHour,
  DataPowerUsageHour,
  DataTemperatureDay,
  DataTemperatureHour,
} from "./data-store.js";

interface ObjWithDateHour {
  date: string;
  hour: number;
}

function compareDateAndHour(a: ObjWithDateHour, b: ObjWithDateHour): number {
  if (a.date == b.date) {
    if (a.hour === b.hour) {
      return 0;
    } else if (a.hour < b.hour) {
      return -1;
    } else {
      return 1;
    }
  }

  return a.date.localeCompare(b.date);
}

export async function loadNordpoolIfNeeded(
  data: Data,
  date: Temporal.PlainDate
): Promise<void> {
  const dateFormatted = date.toString();

  if (
    (data.nordpool ?? []).find((it) => it.date == dateFormatted) !== undefined
  ) {
    return;
  }

  console.log(`Loading nordpool data for ${date}`);

  const nordpoolData: DataNordpoolPriceHour[] = (
    await getNordpoolData(date)
  ).map((it) => ({
    date: it.date.toString(),
    hour: it.hour,
    price: it.price,
  }));

  data.nordpool = (data.nordpool ?? [])
    .filter((it) => it.date !== dateFormatted)
    .concat(nordpoolData)
    .sort(compareDateAndHour);
}

export async function loadHourlyTemperatureIfNeeded(
  data: Data,
  date: Temporal.PlainDate
): Promise<void> {
  const dateFormatted = date.toString();

  // TODO: handle issue where 0am and 1am is loaded in previous date

  if (
    (data.hourlyTemperature ?? [])
      .filter((it) => it.hour == 23)
      .find((it) => it.date == dateFormatted) !== undefined
  ) {
    return;
  }

  console.log(`Loading hourly temperature data for ${date}`);

  const temperatureData: DataTemperatureHour[] = (
    await getTemperatureHourlyData(date)
  ).map((it) => ({
    date: it.date.toString(),
    hour: it.hour,
    temperature: it.temperature,
  }));

  const hourDates = new Set(
    temperatureData.map((it) => `${it.date}-${it.hour}`)
  );

  data.hourlyTemperature = (data.hourlyTemperature ?? [])
    // Remove duplicates.
    .filter((it) => !hourDates.has(`${it.date}-${it.hour}`))
    .concat(temperatureData)
    .sort(compareDateAndHour);
}

export async function loadDailyTemperatureIfNeeded(
  data: Data,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
): Promise<void> {
  const datesByYear = datesInRange(firstDate, lastDate).reduce<
    Record<string, Temporal.PlainDate[]>
  >((acc, cur) => {
    const yearStr = String(cur.year);
    acc[yearStr] = (acc[yearStr] ?? []).concat([cur]);
    return acc;
  }, {});

  const storedDates = new Set(
    (data.dailyTemperature ?? []).map((it) => it.date)
  );

  for (const [yearStr, dates] of Object.entries(datesByYear)) {
    const year = Number(yearStr);
    const datesFormatted = dates.map((it) => it.toString());

    if (datesFormatted.every((it) => storedDates.has(it))) {
      continue;
    }

    console.log(`Loading daily temperature for ${year}`);

    const dataToStore: DataTemperatureDay[] = (
      await getTemperatureDailyData(year)
    )
      .filter((it) => datesFormatted.includes(it.day.toString()))
      .map((it) => ({
        date: it.day.toString(),
        meanTemperature: it.mean,
      }));

    data.dailyTemperature = (data.dailyTemperature ?? [])
      // Remove old data if any.
      .filter((it) => !datesFormatted.includes(it.date))
      // Add new data.
      .concat(dataToStore)
      // Sort by date.
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

function mergePowerUsageForMeter(
  data: Data,
  meterName: string,
  items: HourUsage[]
): void {
  const datesFormatted = new Set(items.map((it) => it.date.toString()));

  const dataToStore: DataPowerUsageHour[] = items.map((it) => ({
    date: it.date.toString(),
    hour: it.hour,
    usage: it.usage,
  }));

  const meterData = ((data.powerUsage ?? {})[meterName] ?? [])
    // Remove old data if any.
    .filter((it) => !datesFormatted.has(it.date))
    // Add new data.
    .concat(dataToStore)
    // Sort by date and hour.
    .sort(compareDateAndHour);

  data.powerUsage = data.powerUsage ?? {};
  data.powerUsage[meterName] = meterData;
}

export async function loadStroemIfNeeded(
  data: Data,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
): Promise<void> {
  const dates = datesInRange(firstDate, lastDate);
  const datesFormatted = dates.map((it) => it.toString());

  const meterIds = ELVIA_CONTRACT_LIST.map((it) => it.contractId);

  const storedDates = new Set(
    meterIds
      .map((it) => (data.powerUsage ?? {})[it] ?? [])
      .map((usages) => {
        const verifiedMeasures = usages.filter(
          (it) => it.verified == null || it.verified
        );
        const dateWithHours = R.groupBy(
          (it) => it.date.toString(),
          verifiedMeasures
        );
        return Object.entries(dateWithHours)
          .filter(([_, values]) => values.length == 24)
          .map(([date, _]) => date);
      })
      .flat()
  );

  if (datesFormatted.every((it) => storedDates.has(it))) {
    return;
  }

  console.log("Loading data for strøm");

  const accessToken = await getAccessTokenFromCredentials({
    email: ELVIA_EMAIL,
    password: ELVIA_PASSWORD,
  });

  const years = R.range(firstDate.year, lastDate.year + 1);

  for (const contract of ELVIA_CONTRACT_LIST) {
    for (const year of years) {
      const meterValues = await getMeterValues({
        customerId: ELVIA_CUSTOMER_ID,
        contractId: contract.contractId,
        year: year,
        accessToken,
      });

      const parsed = parseMeterValues(meterValues).filter((it) =>
        isDateInRange(firstDate, lastDate, it.date)
      );

      mergePowerUsageForMeter(data, contract.meterId, parsed);
    }
  }
}

export async function loadFjernvarmeIfNeeded(
  data: Data,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
): Promise<void> {
  const dates = datesInRange(firstDate, lastDate);
  const datesFormatted = dates.map((it) => it.toString());
  const fjernvarmeMeterName = "Fjernvarme";

  const storedDates = [
    ...new Set(
      ((data.powerUsage ?? {})[fjernvarmeMeterName] ?? [])
        .filter((it) => it.hour == 23)
        .map((it) => it.date)
    ),
  ];

  if (datesFormatted.every((it) => storedDates.includes(it))) {
    return;
  }

  console.log("Loading data for fjernvarme");

  const accessToken = await getAccessToken(
    FJERNVARME_USERNAME,
    FJERNVARME_PASSWORD
  );

  const usage = await getFjernvarmeHourlyData({
    accessToken,
    anleggNummer: FJERNVARME_ANLEGG_NUMMER,
    kundeId: FJERNVARME_KUNDE_ID,
    firstDate: Temporal.PlainDate.from(firstDate),
    lastDate: Temporal.PlainDate.from(lastDate),
  });

  mergePowerUsageForMeter(data, fjernvarmeMeterName, usage);
}
