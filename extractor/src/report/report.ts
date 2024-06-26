import { Temporal } from "@js-temporal/polyfill";
import * as fs from "fs/promises";
import * as R from "ramda";
import { createTrend } from "trendline";
import { REPORT_FILE } from "../config.js";
import { datesInRange } from "../dates.js";
import {
  Data,
  DataPowerUsageHour,
  DataTemperatureDay,
} from "../service/data-store.js";
import {
  dayNames,
  hoursInADay,
  trendlineTemperatureLowerThan,
} from "./constants.js";
import {
  averageSpotprice,
  averageTemperature,
  nullForZero,
  roundTwoDec,
  zeroForNaN,
} from "./helpers.js";
import { IndexedData, dateHourIndexer, indexData } from "./indexed-data.js";
import {
  UsagePrice,
  calculateFjernvarmeHourlyPrice,
  calculateHourlyPrice,
  calculateStroemHourlyPrice,
  flattenPrices,
  sumPrice,
} from "./prices.js";

// The official types are not correct.
declare module "trendline" {
  export function createTrend<X extends string, Y extends string>(
    data: Array<{
      [K in X | Y]: number | undefined;
    }>,
    xKey: X,
    yKey: Y
  ): {
    slope: number;
    yStart: number;
    calcY: (x: number) => number;
  };
}

export function generateMonthlyReport(
  data: Data,
  indexedData: IndexedData,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
) {
  const dates = datesInRange(firstDate, lastDate).map((it) => it.toString());

  const years = Array.from(new Set(dates.map((it) => it.slice(0, 4))));
  const months = Array.from(new Set(dates.map((it) => it.slice(5, 7))));

  const datesByYearMonths = R.groupBy((date: string) => date.slice(0, 7))(
    dates
  );

  const byYearMonthGroup = R.groupBy(({ date }: DataPowerUsageHour) =>
    date.slice(0, 7)
  );
  const sumHourUsages = (items: DataPowerUsageHour[]) =>
    roundTwoDec(R.sum(items.map((it) => it.usage)));

  const temperatures: Record<string, number | undefined> = R.mapObjIndexed(
    (items: DataTemperatureDay[]) =>
      roundTwoDec(R.sum(items.map((it) => it.meanTemperature)) / items.length),
    R.groupBy(({ date }: DataTemperatureDay) => date.slice(0, 7))(
      (data.dailyTemperature ?? []).filter((it) => dates.includes(it.date))
    )
  );

  const stroem: Record<string, number | undefined> = R.mapObjIndexed(
    sumHourUsages,
    byYearMonthGroup(
      Object.entries(data.powerUsage ?? {})
        .filter(([key, _]) => key !== "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  const fjernvarme: Record<string, number | undefined> = R.mapObjIndexed(
    sumHourUsages,
    byYearMonthGroup(
      Object.entries(data.powerUsage ?? {})
        .filter(([key, _]) => key === "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  return months.map((month) => {
    type YearMonthData = {
      stroem: number | undefined;
      fjernvarme: number | undefined;
      forbrukSum: number | null;
      temperature: number | undefined;
      price: number | null;
      spotprice: number | null;
    };

    const obj = {
      month,
      name: month,
      years: {} as Record<string, YearMonthData>,
    };

    for (const year of years) {
      let priceStroem = 0;
      let priceFjernvarme = 0;

      const yearMonth = `${year}-${month}`;

      for (const date of datesByYearMonths[yearMonth] ?? []) {
        for (const hour of hoursInADay) {
          const index = dateHourIndexer({ date, hour });
          priceStroem += zeroForNaN(
            sumPrice(
              calculateStroemHourlyPrice({
                data,
                indexedData,
                date,
                hour,
                usageKwh: indexedData.stroemByHour[index] ?? NaN,
              })
            )
          );
          priceFjernvarme += zeroForNaN(
            sumPrice(
              calculateFjernvarmeHourlyPrice({
                data,
                indexedData,
                date,
                hour,
                usageKwh: indexedData.fjernvarmeByHour[index] ?? NaN,
              })
            )
          );
        }
      }

      obj.years[year] = {
        stroem: stroem[yearMonth],
        fjernvarme: fjernvarme[yearMonth],
        forbrukSum: nullForZero(
          (stroem[yearMonth] ?? 0) + (fjernvarme[yearMonth] ?? 0)
        ),
        temperature: temperatures[yearMonth],
        price: nullForZero(roundTwoDec(priceStroem + priceFjernvarme)),
        spotprice: nullForZero(
          zeroForNaN(indexedData.spotpriceByMonth[yearMonth] ?? NaN) * 100
        ),
      };
    }

    return obj;
  });
}

export function generateDailyReport(
  data: Data,
  indexedData: IndexedData,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
) {
  const dates = datesInRange(firstDate, lastDate).map((it) => it.toString());

  const byDateGroup = R.groupBy(({ date }: DataPowerUsageHour) => date);
  const sumHourUsages = (items: DataPowerUsageHour[]) =>
    roundTwoDec(R.sum(items.map((it) => it.usage)));

  const byDate = R.indexBy(({ date }: DataTemperatureDay) => date);

  const temperatures: Record<string, number | undefined> = R.mapObjIndexed(
    (it) => it.meanTemperature,
    byDate(
      (data.dailyTemperature ?? []).filter((it) => dates.includes(it.date))
    )
  );

  const stroem: Record<string, number | undefined> = R.mapObjIndexed(
    sumHourUsages,
    byDateGroup(
      Object.entries(data.powerUsage ?? {})
        .filter(([key, _]) => key !== "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  const fjernvarme: Record<string, number | undefined> = R.mapObjIndexed(
    sumHourUsages,
    byDateGroup(
      Object.entries(data.powerUsage ?? {})
        .filter(([key, _]) => key === "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  return dates.map((date) => {
    const date1 = Temporal.PlainDate.from(date);
    const name = `${date1.day}.${date1.month}.${date1.year}`;

    let priceStroem = 0;
    let priceFjernvarme = 0;

    for (const hour of hoursInADay) {
      const index = dateHourIndexer({ date, hour });
      priceStroem += sumPrice(
        calculateStroemHourlyPrice({
          data,
          indexedData,
          date,
          hour,
          usageKwh: indexedData.stroemByHour[index] ?? NaN,
        })
      );
      priceFjernvarme += sumPrice(
        calculateFjernvarmeHourlyPrice({
          data,
          indexedData,
          date,
          hour,
          usageKwh: indexedData.fjernvarmeByHour[index] ?? NaN,
        })
      );
    }

    return {
      date,
      name,
      stroem: stroem[date],
      fjernvarme: fjernvarme[date],
      temperature: temperatures[date],
      price: roundTwoDec(priceStroem + priceFjernvarme),
    };
  });
}

export function generateHourlyReport(
  data: Data,
  indexedData: IndexedData,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate,
  lastTime: Temporal.PlainDateTime
) {
  const dates = datesInRange(firstDate, lastDate).map((it) => it.toString());

  return dates
    .map((date) => {
      const date1 = Temporal.PlainDate.from(date);
      const dateStr = dayNames[date1.dayOfWeek];
      return hoursInADay
        .filter(
          (hour) =>
            Temporal.PlainDateTime.compare(
              date1.toPlainDateTime({ hour }),
              lastTime
            ) < 0
        )
        .map((hour) => {
          const index = dateHourIndexer({ date, hour });
          const stroem = indexedData.stroemByHour[index];
          const fjernvarme = indexedData.fjernvarmeByHour[index];
          return {
            date,
            hour,
            name: `${dateStr} kl ${String(hour).padStart(2, "0")}`,
            stroem: indexedData.stroemByHour[index],
            fjernvarme: indexedData.fjernvarmeByHour[index],
            temperature: indexedData.temperatureByHour[index],
            price:
              stroem == null || fjernvarme == null
                ? NaN
                : roundTwoDec(
                    calculateHourlyPrice({
                      data,
                      indexedData,
                      date,
                      hour,
                      stroem,
                      fjernvarme,
                    })
                  ),
          };
        });
    })
    .flat();
}

export function generateEnergyTemperatureReport(
  data: Data,
  indexedData: IndexedData,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
) {
  const dates = datesInRange(firstDate, lastDate).map((it) => it.toString());

  const byDateGroup = R.groupBy(({ date }: DataPowerUsageHour) => date);
  const sumHourUsages = (items: DataPowerUsageHour[]) =>
    roundTwoDec(R.sum(items.map((it) => it.usage)));

  const byDate = R.indexBy(({ date }: DataTemperatureDay) => date);

  const temperatures = R.mapObjIndexed(
    (it) => it.meanTemperature,
    byDate(
      (data.dailyTemperature ?? []).filter((it) => dates.includes(it.date))
    )
  );

  const power = R.mapObjIndexed(
    sumHourUsages,
    byDateGroup(
      Object.entries(data.powerUsage ?? {})
        .map(([_, values]) => values)
        .flat()
    )
  );

  return dates
    .filter((date) => {
      // Skip dates with incomplete data.
      const index = dateHourIndexer({ date, hour: 23 });
      return (
        indexedData.stroemByHour[index] != null &&
        indexedData.fjernvarmeByHour[index] != null
      );
    })
    .map((date, index) => {
      const date1 = Temporal.PlainDate.from(date);
      const name = `${date1.day}.${date1.month}`;

      return {
        date,
        name,
        power: power[date],
        temperature: temperatures[date],
        index,
      };
    });
}

export function generateEnergyTemperatureReportFjernvarme(
  data: Data,
  indexedData: IndexedData,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
) {
  const dates = datesInRange(firstDate, lastDate).map((it) => it.toString());

  const byDateGroup = R.groupBy(({ date }: DataPowerUsageHour) => date);
  const sumHourUsages = (items: DataPowerUsageHour[]) =>
    roundTwoDec(R.sum(items.map((it) => it.usage)));

  const byDate = R.indexBy(({ date }: DataTemperatureDay) => date);

  const temperatures = R.mapObjIndexed(
    (it) => it.meanTemperature,
    byDate(
      (data.dailyTemperature ?? []).filter((it) => dates.includes(it.date))
    )
  );

  const power = R.mapObjIndexed(
    sumHourUsages,
    byDateGroup((data.powerUsage ?? {})["Fjernvarme"] ?? [])
  );

  return dates
    .filter((date) => {
      // Skip dates with incomplete data.
      const index = dateHourIndexer({ date, hour: 23 });
      return indexedData.fjernvarmeByHour[index] != null;
    })
    .map((date, index) => {
      const date1 = Temporal.PlainDate.from(date);
      const name = `${date1.day}.${date1.month}`;

      return {
        date,
        name,
        power: power[date],
        temperature: temperatures[date],
        index,
      };
    });
}

function undefinedForZero(value: number | undefined) {
  if (value === 0) return undefined;
  return value;
}

function generatePriceReport(
  data: Data,
  indexedData: IndexedData,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
) {
  const dates = datesInRange(firstDate, lastDate).map((it) => it.toString());

  return dates
    .map((date) => {
      const date1 = Temporal.PlainDate.from(date);
      const dateStr = `${dayNames[date1.dayOfWeek]} ${date1.day}.${
        date1.month
      }`;

      return hoursInADay.map((hour) => {
        const index = dateHourIndexer({ date, hour });

        // The fallback value doesn't have that much impact, so keeping a static value.
        // (This is relevant for future data.)
        const stroemUsage =
          undefinedForZero(indexedData.stroemByHour[index]) ?? 50;
        const fjernvarmeUsage =
          undefinedForZero(indexedData.fjernvarmeByHour[index]) ?? 80;

        const priceStroem = sumPrice(
          calculateStroemHourlyPrice({
            data,
            indexedData,
            date,
            hour,
            usageKwh: stroemUsage,
          })
        );

        const priceFjernvarme = sumPrice(
          calculateFjernvarmeHourlyPrice({
            data,
            indexedData,
            date,
            hour,
            usageKwh: fjernvarmeUsage,
          })
        );

        const nordpoolKwh = indexedData.spotpriceByHour[index];

        return {
          date,
          hour,
          name: `${dateStr} kl ${String(hour).padStart(2, "0")}`,
          priceStroemKwh: roundTwoDec(priceStroem / stroemUsage),
          priceFjernvarmeKwh: roundTwoDec(priceFjernvarme / fjernvarmeUsage),
          nordpoolKwh: roundTwoDec(nordpoolKwh == null ? NaN : nordpoolKwh),
        };
      });
    })
    .flat();
}

function generateCostReport(
  data: Data,
  indexedData: IndexedData,
  dates: Temporal.PlainDate[]
) {
  const stroemItems = dates
    .flatMap((dateObj) => {
      const date = dateObj.toString();
      return hoursInADay.map((hour) => {
        const index = dateHourIndexer({ date, hour });
        return calculateStroemHourlyPrice({
          data,
          indexedData,
          date,
          hour,
          usageKwh: indexedData.stroemByHour[index] ?? NaN,
        });
      });
    })
    .filter((it): it is UsagePrice => it != null && !isNaN(it.usageKwh));

  const fjernvarmeItems = dates
    .flatMap((dateObj) => {
      const date = dateObj.toString();
      return hoursInADay.map((hour) => {
        const index = dateHourIndexer({ date, hour });
        return calculateFjernvarmeHourlyPrice({
          data,
          indexedData,
          date,
          hour,
          usageKwh: indexedData.fjernvarmeByHour[index] ?? NaN,
        });
      });
    })
    .filter((it): it is UsagePrice => it != null && !isNaN(it.usageKwh));

  const stroem = flattenPrices(stroemItems);
  const fjernvarme = flattenPrices(fjernvarmeItems);

  return {
    stroem,
    stroemSum: nullForZero(sumPrice(stroem)),
    stroemDatapointsCount: stroemItems.length,
    fjernvarme,
    fjernvarmeSum: nullForZero(sumPrice(fjernvarme)),
    fjernvarmeDatapointsCount: fjernvarmeItems.length,
    sum: nullForZero(sumPrice(stroem) + sumPrice(fjernvarme)),
  };
}

function generateTableData(
  data: Data,
  indexedData: IndexedData,
  name: string,
  bucketDates: Temporal.PlainDate[]
) {
  return {
    name,
    spotprice: averageSpotprice(indexedData, bucketDates),
    temperature: averageTemperature(indexedData, bucketDates),
    ...generateCostReport(data, indexedData, bucketDates),
  };
}

function comparePlainMonthDay(
  one: Temporal.PlainMonthDay,
  two: Temporal.PlainMonthDay
) {
  if (one.monthCode == two.monthCode) {
    return one.day - two.day;
  }
  return one.monthCode.localeCompare(two.monthCode);
}

function generateYearlyTableReport(
  data: Data,
  indexedData: IndexedData,
  options?: {
    untilDayIncl?: Temporal.PlainMonthDay | undefined;
  }
) {
  const firstDate = Temporal.PlainDate.from("2013-01-01");
  const { untilDayIncl } = options ?? {};

  let dates = datesInRange(firstDate, indexedData.lastDate);

  if (untilDayIncl) {
    dates = dates.filter(
      (it) => comparePlainMonthDay(it.toPlainMonthDay(), untilDayIncl) <= 0
    );
  }

  const byYear = R.groupBy((value: Temporal.PlainDate) =>
    value.year.toString()
  );

  return Object.values(
    R.mapObjIndexed(
      (bucketDates, year) =>
        generateTableData(data, indexedData, String(year), bucketDates!),
      byYear(dates)
    )
  );
}

function generateMonthlyTableReport(data: Data, indexedData: IndexedData) {
  const firstDate = Temporal.PlainDate.from("2013-01-01");

  const dates = datesInRange(firstDate, indexedData.lastDate);
  const byMonth = R.groupBy((value: Temporal.PlainDate) =>
    value.toPlainYearMonth().toString()
  );

  return Object.values(
    R.mapObjIndexed(
      (bucketDates, month) =>
        generateTableData(data, indexedData, String(month), bucketDates!),
      byMonth(dates)
    )
  );
}

function generateLastDaysTableReport(data: Data, indexedData: IndexedData) {
  const firstDate = Temporal.PlainDate.from("2021-01-01");

  const dates = datesInRange(firstDate, indexedData.lastDate).slice(-60);

  return dates.map((date) =>
    generateTableData(data, indexedData, date.toString(), [date])
  );
}

function createEt(data: ReturnType<typeof generateEnergyTemperatureReport>) {
  return {
    rows: data,
    linearAll: createTrend(
      data.filter(
        (it) =>
          it.temperature != null &&
          it.power != null &&
          it.temperature < trendlineTemperatureLowerThan
      ),
      "temperature",
      "power"
    ),
    linearH21V23: createTrend(
      data
        .filter(
          (it) =>
            it.temperature != null &&
            it.power != null &&
            it.temperature < trendlineTemperatureLowerThan
        )
        .filter((it) => it.date >= "2021-07" && it.date < "2023-07"),
      "temperature",
      "power"
    ),
    linearH23: createTrend(
      data
        .filter(
          (it) =>
            it.temperature != null &&
            it.power != null &&
            it.temperature < trendlineTemperatureLowerThan
        )
        .filter((it) => it.date >= "2023-07" && it.date < "2024"),
      "temperature",
      "power"
    ),
    linearV24: createTrend(
      data
        .filter(
          (it) =>
            it.temperature != null &&
            it.power != null &&
            it.temperature < trendlineTemperatureLowerThan
        )
        .filter((it) => it.date >= "2024-01" && it.date < "2024-07"),
      "temperature",
      "power"
    ),
    linearH24: createTrend(
      data
        .filter(
          (it) =>
            it.temperature != null &&
            it.power != null &&
            it.temperature < trendlineTemperatureLowerThan
        )
        .filter((it) => it.date >= "2024-07"),
      "temperature",
      "power"
    ),
  };
}

export async function generateReportData(data: Data) {
  const indexedData = indexData(data);

  const haveSpotpriceTomorrow =
    indexedData.spotpriceByHour[
      dateHourIndexer({
        date: Temporal.Now.plainDateISO("Europe/Oslo")
          .add({ days: 1 })
          .toString(),
        hour: 0,
      })
    ] !== undefined;

  const now = Temporal.Now.zonedDateTimeISO("Europe/Oslo");
  const untilDayIncl = now.toPlainMonthDay();

  const currentMonth = now.toPlainYearMonth();
  const previousMonth = currentMonth.subtract({ months: 1 });

  const currentMonthDates = datesInRange(
    currentMonth.toPlainDate({ day: 1 }),
    now.toPlainDate()
  );

  const previousMonthDates = datesInRange(
    previousMonth.toPlainDate({ day: 1 }),
    previousMonth
      .toPlainDate({ day: 1 })
      .add({ months: 1 })
      .subtract({ days: 1 })
  );

  const energyTemperatureReport = generateEnergyTemperatureReport(
    data,
    indexedData,
    Temporal.PlainDate.from("2021-07-01"),
    Temporal.Now.plainDateISO("Europe/Oslo").subtract({
      days: 1,
    })
  );

  const energyTemperatureReportFjernvarme =
    generateEnergyTemperatureReportFjernvarme(
      data,
      indexedData,
      Temporal.PlainDate.from("2021-07-01"),
      Temporal.Now.plainDateISO("Europe/Oslo").subtract({
        days: 1,
      })
    );

  const result = {
    monthly: {
      rows: generateMonthlyReport(
        data,
        indexedData,
        Temporal.PlainDate.from("2018-01-01"),
        Temporal.Now.plainDateISO("Europe/Oslo").with({
          month: 12,
          day: 31,
        })
      ),
    },
    daily: {
      rows: generateDailyReport(
        data,
        indexedData,
        Temporal.PlainDate.from("2021-01-01"),
        Temporal.Now.plainDateISO("Europe/Oslo").with({
          month: 12,
          day: 31,
        })
      ),
    },
    hourly: {
      rows: generateHourlyReport(
        data,
        indexedData,
        Temporal.Now.plainDateISO("Europe/Oslo").subtract({
          days: 6,
        }),
        Temporal.Now.plainDateISO("Europe/Oslo"),
        Temporal.Now.plainDateTimeISO("Europe/Oslo")
      ),
    },
    et: createEt(energyTemperatureReport),
    etFjernvarme: createEt(energyTemperatureReportFjernvarme),
    prices: {
      rows: generatePriceReport(
        data,
        indexedData,
        Temporal.Now.plainDateISO("Europe/Oslo").subtract({
          days: haveSpotpriceTomorrow ? 9 : 10,
        }),
        Temporal.Now.plainDateISO("Europe/Oslo").add({
          days: haveSpotpriceTomorrow ? 1 : 0,
        })
      ),
    },
    spotprices: {
      currentMonth: {
        yearMonth: currentMonth.toString(),
        spotprice:
          (indexedData.spotpriceByMonth[currentMonth.toString()] ?? NaN) * 100,
      },
      previousMonth: {
        yearMonth: previousMonth.toString(),
        spotprice:
          (indexedData.spotpriceByMonth[previousMonth.toString()] ?? NaN) * 100,
      },
    },
    cost: {
      currentMonth: {
        yearMonth: currentMonth.toString(),
        cost: generateCostReport(data, indexedData, currentMonthDates),
      },
      previousMonth: {
        yearMonth: previousMonth.toString(),
        cost: generateCostReport(data, indexedData, previousMonthDates),
      },
    },
    table: {
      yearlyToThisDate: {
        untilDayIncl: now.toPlainMonthDay().toString(),
        data: generateYearlyTableReport(data, indexedData, {
          untilDayIncl,
        }),
      },
      yearly: generateYearlyTableReport(data, indexedData),
      monthly: generateMonthlyTableReport(data, indexedData),
      lastDays: generateLastDaysTableReport(data, indexedData),
    },
  };

  return result;
}

export async function generateReportDataAndStore(data: Data) {
  const result = await generateReportData(data);

  await fs.writeFile(REPORT_FILE, JSON.stringify(result, undefined, "  "));
}
