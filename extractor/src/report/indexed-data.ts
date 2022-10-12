import * as R from "ramda";
import {
  Data,
  DataNordpoolPriceHour,
  DataPowerUsageHour,
  DataTemperatureHour,
} from "../service/data-store.js";

export interface IndexedData {
  stroemByHour: Record<string, number | undefined>;
  fjernvarmeByHour: Record<string, number | undefined>;
  spotpriceByHour: Record<string, number | undefined>;
  spotpriceByMonth: Record<string, number | undefined>;
  temperatureByHour: Record<string, number | undefined>;
}

export const dateHourIndexer = ({
  date,
  hour,
}: {
  date: string;
  hour: number;
}) => `${date}-${hour}`;

export const yearMonthIndexer = ({ date }: { date: string }) =>
  date.slice(0, 7);

export function indexData(data: Data): IndexedData {
  const stroemByHour = R.mapObjIndexed(
    (it) => R.sum(it.map((x) => x.usage)),
    R.groupBy<DataPowerUsageHour>(
      dateHourIndexer,
      Object.entries(data.powerUsage ?? {})
        .filter(([key, _]) => key !== "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  const fjernvarmeByHour = R.mapObjIndexed(
    (it) => it.usage,
    R.indexBy<DataPowerUsageHour>(
      dateHourIndexer,
      Object.entries(data.powerUsage ?? {})
        .filter(([key, _]) => key === "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  // Nordpool prices is NOK/MWh.

  const spotpriceByHour = R.mapObjIndexed(
    (it) => (it.price / 1000) * 1.25,
    R.indexBy<DataNordpoolPriceHour>(dateHourIndexer)(data.nordpool ?? [])
  );

  const spotpriceByMonth = R.mapObjIndexed(
    (it) => R.sum(it.map((x) => (x.price / 1000) * 1.25)) / it.length,
    R.groupBy<DataNordpoolPriceHour>(yearMonthIndexer, data.nordpool ?? [])
  );

  const temperatureByHour = R.mapObjIndexed(
    (it) => it.temperature,
    R.indexBy<DataTemperatureHour>(dateHourIndexer)(
      data.hourlyTemperature ?? []
    )
  );

  return {
    stroemByHour,
    fjernvarmeByHour,
    spotpriceByHour,
    spotpriceByMonth,
    temperatureByHour,
  };
}