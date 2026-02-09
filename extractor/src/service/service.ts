import { Temporal } from "@js-temporal/polyfill";
import { DATA_FILE } from "../config.js";
import { datesInRange } from "../dates.js";
import { logger } from "../logger.js";
import { generateReportDataAndStore } from "../report/report.js";
import { DataStore } from "./data-store.js";
import {
  loadDailyTemperatureIfNeeded,
  loadFjernvarmeIfNeeded,
  loadHourlyTemperatureIfNeeded,
  loadNordpoolIfNeeded,
  loadStroemIfNeeded,
} from "./loader.js";

async function handleFailure(
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn();
      return;
    } catch (e) {
      logger.warn({ err: e, attempt, maxAttempts }, `${label}: attempt failed`);
    }
  }
  logger.error(`${label}: gave up after ${maxAttempts} attempts`);
}

const dataStore = new DataStore(DATA_FILE);

async function iteration() {
  const now = Temporal.Now.zonedDateTimeISO("Europe/Oslo");

  const firstDate = Temporal.Now.plainDateISO("Europe/Oslo").subtract({
    days: 40,
  });
  const lastDate = Temporal.Now.plainDateISO("Europe/Oslo");

  const previousDays = datesInRange(firstDate, lastDate);

  const data = await dataStore.load();

  for (const date of previousDays) {
    await handleFailure("nordpool", () => loadNordpoolIfNeeded(data, date));
    await handleFailure("hourly-temperature", () =>
      loadHourlyTemperatureIfNeeded(data, date),
    );
  }

  // Spot prices tomorrow.
  if (now.hour >= 13) {
    await handleFailure("nordpool-tomorrow", () =>
      loadNordpoolIfNeeded(data, lastDate.add({ days: 1 })),
    );
  }

  await handleFailure("daily-temperature", () =>
    loadDailyTemperatureIfNeeded(data, previousDays[0]!, previousDays.at(-2)!),
  );

  await handleFailure("stroem", () =>
    loadStroemIfNeeded(data, previousDays[0]!, previousDays.at(-1)!),
  );

  await handleFailure("fjernvarme", () =>
    loadFjernvarmeIfNeeded(data, previousDays[0]!, previousDays.at(-1)!),
  );

  await dataStore.save(data);

  await generateReportDataAndStore(data);
}

while (true) {
  logger.info("Running iteration");
  await iteration();

  const now = Temporal.Now.zonedDateTimeISO("Europe/Oslo");

  const minuteToRefresh = 30;

  const nextIteration = now
    .round({
      smallestUnit: "hour",
      roundingMode: "floor",
    })
    .with({
      minute: minuteToRefresh,
    })
    .add({
      hours: now.minute >= minuteToRefresh ? 1 : 0,
    });

  const delaySeconds = now.until(nextIteration).total("seconds");
  logger.info({ delaySeconds }, `Sleeping until ${nextIteration.toString()}`);

  await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
}
