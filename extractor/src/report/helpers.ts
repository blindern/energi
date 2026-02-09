import { Temporal } from "@js-temporal/polyfill";
import * as R from "ramda";
import { hoursInADay } from "./constants.ts";
import { dateHourIndexer, type IndexedData } from "./indexed-data.ts";

export function roundTwoDec(value: number) {
  return Math.round(value * 100) / 100;
}

export function averageSpotprice(
  indexedData: IndexedData,
  dates: Temporal.PlainDate[]
) {
  const items = dates.flatMap((date) => {
    return hoursInADay.flatMap((hour) => {
      const index = dateHourIndexer({ date: date.toString(), hour });
      const value = indexedData.spotpriceByHour[index];
      return value !== undefined ? [value] : [];
    });
  });

  if (items.length == 0) {
    return undefined;
  }

  return R.sum(items) / items.length;
}

export function averageTemperature(
  indexedData: IndexedData,
  dates: Temporal.PlainDate[]
) {
  // For unknown reasons Yr are missing date temperatures for 31st December.
  // For earlier dates in 2021 we have not collected hourly temperatures.

  // Try hourly temperature first then fallback to daily temperature.

  const temps = dates.flatMap((date) => {
    const hourTemps = hoursInADay.flatMap((hour) => {
      const index = dateHourIndexer({ date: date.toString(), hour });
      const temp = indexedData.temperatureByHour[index];

      return temp !== undefined ? [temp] : [];
    });

    if (hourTemps.length == 0) {
      // Fallback to daily. Must yield 24 hours for proper average.
      const temp = indexedData.temperatureByDate[date.toString()];
      return temp !== undefined ? R.repeat(temp, 24) : [];
    }

    return hourTemps;
  });

  if (temps.length == 0) {
    return undefined;
  }

  return R.sum(temps) / temps.length;
}

export function zeroForNaN(value: number) {
  return isNaN(value) ? 0 : value;
}

export function nullForZero(value: number) {
  return value === 0 ? null : value;
}
