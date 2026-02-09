import { Temporal } from "@js-temporal/polyfill";
import type { HourUsage } from "./extract/common.ts";

export function generateHourUsageCsvRows(
  meterName: string,
  usageList: HourUsage[]
): string {
  return (
    usageList
      .map(
        (it) =>
          `${formatHourForCsv(
            it.date,
            it.hour
          )}\t${meterName}\t${formatNumberForCsv(it.usage)}`
      )
      .join("\n") + "\n"
  );
}

function padZero(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateDayFirst(date: Temporal.PlainDate): string {
  return `${padZero(date.day)}.${padZero(date.month)}.${padZero(date.year)}`;
}

export function formatHourForCsv(
  date: Temporal.PlainDate,
  hour: number
): string {
  return `${formatDateDayFirst(date)} kl. ${padZero(hour)}.00`;
}

export function formatNumberForCsv(value: number): string {
  return String(value).replace(".", ",");
}
