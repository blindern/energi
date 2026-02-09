import { Temporal } from "@js-temporal/polyfill";

export interface DayWithMean {
  day: Temporal.PlainDate;
  mean: number;
}

export interface HourTemperature {
  date: Temporal.PlainDate;
  hour: number;
  temperature: number;
}

export async function getDailyData(year: number): Promise<DayWithMean[]> {
  const response = await fetch(
    `https://www.yr.no/api/v0/locations/5-18700/observations/year/${year}`
  );

  if (!response.ok) {
    throw new Error(`Unexpected response: ${response.status} ${response.statusText} from ${response.url}`);
  }

  const responseJson = (await response.json()) as any;

  const result: DayWithMean[] = [];

  for (const month of responseJson.historical.months) {
    for (const day of month.days) {
      if (day.temperature.mean == null) {
        // No data yet.
        continue;
      }

      result.push({
        day: Temporal.PlainDate.from(day.time.slice(0, 10)),
        mean: day.temperature.mean,
      });
    }
  }

  return result;
}

export async function getHourlyData(
  day: Temporal.PlainDate
): Promise<HourTemperature[]> {
  const response = await fetch(
    `https://www.yr.no/api/v0/locations/5-18700/observations/${day}`
  );

  if (!response.ok) {
    throw new Error(`Unexpected response: ${response.status} ${response.statusText} from ${response.url}`);
  }

  const responseJson = (await response.json()) as any;

  const result: HourTemperature[] = [];

  if (!responseJson.historical) {
    return result;
  }

  for (const day of responseJson.historical.days) {
    for (const hour of day.hours) {
      if (hour.temperature.value == null) {
        // No data yet.
        continue;
      }

      result.push({
        date: Temporal.PlainDate.from(hour.time.slice(0, 10)),
        hour: Number(hour.time.slice(11, 13)),
        temperature: hour.temperature.value,
      });
    }
  }

  return result;
}
