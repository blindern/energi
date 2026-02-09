import { SpanStatusCode } from "@opentelemetry/api";
import { Temporal } from "@js-temporal/polyfill";
import { DATA_FILE } from "../config.ts";
import { datesInRange } from "../dates.ts";
import { logger } from "../logger.ts";
import { generateReportDataAndStore } from "../report/report.ts";
import { withSpan } from "../tracing.ts";
import { DataStore } from "./data-store.ts";
import {
  getCompleteHourlyTemperatureDates,
  loadDailyTemperatureIfNeeded,
  loadFjernvarmeIfNeeded,
  loadHourlyTemperatureIfNeeded,
  loadNordpoolIfNeeded,
  loadStroemIfNeeded,
} from "./loader.ts";

async function handleFailure(
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  await withSpan(label, async (span) => {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await fn();
        return;
      } catch (e) {
        logger.warn(
          { err: e, attempt, maxAttempts },
          `${label}: attempt failed`,
        );
      }
    }
    logger.error(`${label}: gave up after ${maxAttempts} attempts`);
    span.setStatus({ code: SpanStatusCode.ERROR, message: "max attempts" });
  });
}

const dataStore = new DataStore(DATA_FILE);

async function iteration() {
  const now = Temporal.Now.zonedDateTimeISO("Europe/Oslo");

  const firstDate = Temporal.Now.plainDateISO("Europe/Oslo").subtract({
    days: 40,
  });
  const lastDate = Temporal.Now.plainDateISO("Europe/Oslo");

  const previousDays = datesInRange(firstDate, lastDate);

  const data = await withSpan("load-data", () => dataStore.load());

  const completeTemperatureDates = withSpan(
    "compute-complete-temperature-dates",
    () => getCompleteHourlyTemperatureDates(data),
  );

  for (const date of previousDays) {
    await handleFailure("nordpool", () => loadNordpoolIfNeeded(data, date));
    await handleFailure("hourly-temperature", () =>
      loadHourlyTemperatureIfNeeded(data, date, completeTemperatureDates),
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

  await withSpan("save-data", () => dataStore.save(data));

  await withSpan("generate-report", () => generateReportDataAndStore(data));
}

while (true) {
  logger.info("Running iteration");
  await withSpan("iteration", () => iteration());

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
