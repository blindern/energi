import { Temporal } from "@js-temporal/polyfill";
import * as R from "ramda";
import type {
  Data,
  DataNordpoolPriceHour,
  DataPowerUsageHour,
  DataTemperatureHour,
} from "../service/data-store.ts";
import {
  stroemFakturaPriceByMonthByMeterName,
  stroemKraftMonthlyAverage,
} from "./prices.ts";

export interface IndexedData {
  lastDate: Temporal.PlainDate;
  stroemByMeterNameByHour: Record<string, Record<string, number>>;
  stroemSpotpriceFactorByMonth: Record<string, number | undefined>;
  stroemFakturaPricePerKwhByMonthByMeterName: Record<
    string,
    Record<string, number | undefined> | undefined
  >;
  fjernvarmeByHour: Record<string, number | undefined>;
  spotpriceByHour: Record<string, number | undefined>;
  spotpriceByMonth: Record<string, number | undefined>;
  temperatureByHour: Record<string, number | undefined>;
  temperatureByDate: Record<string, number | undefined>;
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
  const lastDate = Temporal.PlainDate.from(
    R.reduce(
      R.max,
      "",
      Object.values(data.powerUsage ?? {}).flatMap((it) =>
        it.map((x) => x.date)
      )
    ) as string
  );

  const stroemByMeterNameByHour: Record<string, Record<string, number>> = {};

  for (const [meterName, usageData] of Object.entries(
    data.powerUsage ?? {}
  ).filter(([key, _]) => key !== "Fjernvarme")) {
    // Data for 2017 is only since 2017-10-01, so skip those months.
    for (const dataPoint of usageData.filter((it) => it.date >= "2018")) {
      const hourKey = dateHourIndexer(dataPoint);
      stroemByMeterNameByHour[hourKey] ??= {};
      stroemByMeterNameByHour[hourKey][meterName] ??= 0;
      stroemByMeterNameByHour[hourKey][meterName] += dataPoint.usage;
    }
  }

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
    (it) => R.sum(it!.map((x) => (x.price / 1000) * 1.25)) / it!.length,
    R.groupBy<DataNordpoolPriceHour>(yearMonthIndexer, data.nordpool ?? [])
  );

  const temperatureByHour = R.mapObjIndexed(
    (it) => it.temperature,
    R.indexBy<DataTemperatureHour>(dateHourIndexer)(
      data.hourlyTemperature ?? []
    )
  );

  const temperatureByDate = R.mapObjIndexed(
    R.prop("meanTemperature"),
    R.indexBy(R.prop("date"), data.dailyTemperature ?? [])
  );

  const stroemSpotpriceFactorByMonth = R.mapObjIndexed((it, yearMonth) => {
    const spotprice = spotpriceByMonth[yearMonth];
    return it != null && spotprice != null ? it / spotprice : undefined;
  }, stroemKraftMonthlyAverage);

  const stroemPowerUsage = Object.fromEntries(
    Object.entries(data.powerUsage ?? {}).filter(
      ([key, _]) => key !== "Fjernvarme"
    )
  );

  const stroemUsageByMonthByMeterName = R.mapObjIndexed(
    (usage) =>
      R.mapObjIndexed(
        (it) => R.sum(it!.map((x) => x.usage)),
        R.groupBy<DataPowerUsageHour>(yearMonthIndexer, usage)
      ),
    stroemPowerUsage
  );

  const stroemFakturaPricePerKwhByMonthByMeterName = R.mapObjIndexed(
    (it, meterName) =>
      R.mapObjIndexed(
        (it, yearMonth) =>
          it / stroemUsageByMonthByMeterName[meterName]![yearMonth]!,
        it
      ),
    stroemFakturaPriceByMonthByMeterName
  );

  return {
    lastDate,
    stroemByMeterNameByHour,
    stroemSpotpriceFactorByMonth,
    stroemFakturaPricePerKwhByMonthByMeterName,
    fjernvarmeByHour,
    spotpriceByHour,
    spotpriceByMonth,
    temperatureByHour,
    temperatureByDate,
  };
}
