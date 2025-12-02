import { Temporal } from "@js-temporal/polyfill";
import { Fragment, useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { trendlineTemperatureLowerThan } from "@blindern/energi-extractor/src/report/constants.js";
import {
  UsagePrice,
  pricesConfig,
} from "@blindern/energi-extractor/src/report/prices.js";
import { generateReportData } from "@blindern/energi-extractor/src/report/report.js";

function roundTwoDec(value: number) {
  return Math.round(value * 100) / 100;
}

// Tall fra regnskap. Årlig kostnad / sum årlig forbruk.
const averagePrices = {
  // Kilde: Oversikt strømkostnader Blindern.xlsx
  2018: 1.0888,
  2019: 1.053,
  2020: 0.7569,
  2021: 1.4354,
  // Beregnet av Henrik utifra fakturaer.
  2022: 2504408 / 1660446,
  2023: 2427069 / 1690617,
};

const monthNames: Record<number, string> = {
  1: "jan",
  2: "feb",
  3: "mar",
  4: "apr",
  5: "mai",
  6: "jun",
  7: "jul",
  8: "aug",
  9: "sep",
  10: "okt",
  11: "nov",
  12: "des",
};

const monthNamesLong: Record<number, string> = {
  1: "Januar",
  2: "Februar",
  3: "Mars",
  4: "April",
  5: "Mai",
  6: "Juni",
  7: "Juli",
  8: "August",
  9: "September",
  10: "Oktober",
  11: "November",
  12: "Desember",
};

// https://www.heavy.ai/blog/12-color-palettes-for-telling-better-stories-with-your-data
const colors = [
  "#e60049",
  "#0bb4ff",
  "#50e991",
  "#e6d800",
  "#9b19f5",
  "#ffa300",
  "#dc0ab4",
  "#b3d4ff",
  "#00bfa0",
];
type ReportData = Awaited<ReturnType<typeof generateReportData>>;

function deriveTempTickCount(data: number[]): number[] {
  const min = Math.min(...data);
  const max = Math.max(...data);

  const last = Math.ceil(max);

  let item = Math.min(0, Math.floor(min));
  const result = [];

  do {
    result.push(item);
    item++;
  } while (item <= last);

  return result;
}

function addEndItem<T extends { name: string }>(items: T[]): T[] {
  return items.concat([{ ...items.at(-1)!, name: "" }]);
}

// Make the graph show the last point as a step as well,
// for data in the middle of the graph.
function expandLast<
  T extends ReportData["daily"]["rows"][0] | ReportData["hourly"]["rows"][0]
>(items: T[]): T[] {
  let prev = null;
  const result: T[] = [];

  for (const row of items) {
    const newRow: T = {
      ...row,
      fjernvarme: row.fjernvarme == null ? prev?.fjernvarme : row.fjernvarme,
      stroem: row.stroem == null ? prev?.stroem : row.stroem,
      temperature:
        row.temperature == null ? prev?.temperature : row.temperature,
      price: row.price == null && prev != null ? prev.price : row.price,
    };

    result.push(newRow);
    prev = row;
  }

  return result;
}

function Hourly({ reportData }: { reportData: ReportData }) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={expandLast(addEndItem(reportData.hourly.rows))}>
        <CartesianGrid stroke="#dddddd" />
        <Area
          type="stepAfter"
          dataKey="fjernvarme"
          name="Fjernvarme"
          stroke="#ff0000"
          fill="#ff0000"
          fillOpacity={0.3}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Area
          type="stepAfter"
          dataKey="stroem"
          name="Strøm"
          stroke="#6aa84f"
          fill="#6aa84f"
          fillOpacity={0.3}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Line
          type="stepAfter"
          dataKey="temperature"
          name="Utetemperatur Blindern"
          stroke="#336EFF"
          yAxisId="temp"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Line
          type="stepAfter"
          dataKey="price"
          name="Estimert kostnad"
          stroke="#555555"
          yAxisId="price"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        {reportData.hourly.rows
          .slice(1)
          .filter((it) => it.name.endsWith("kl 00"))
          .map((it) => (
            <ReferenceLine
              key={`date-${it.name}`}
              x={it.name}
              stroke="#555555"
            />
          ))}
        {reportData.hourly.rows
          .filter((it) => it.name.endsWith("kl 13"))
          .map((it) => (
            <ReferenceDot
              key={`date-text-${it.name}`}
              x={it.name}
              y={-0.05}
              label={it.name.split(" ")[0]!}
              fillOpacity={0}
              strokeWidth={0}
              ifOverflow="visible"
              yAxisId="label"
            />
          ))}
        <XAxis
          dataKey="name"
          ticks={reportData.hourly.rows.slice(-3).map((it) => it.name)}
          angle={-90}
          height={50}
          interval={0}
          tickMargin={20}
          fontSize={8}
        />
        <YAxis unit=" kWh" tickCount={10} />
        <YAxis
          yAxisId="temp"
          unit=" &#8451;"
          orientation="right"
          interval={0}
          ticks={deriveTempTickCount(
            reportData.hourly.rows.map((it) => it.temperature ?? 0)
          )}
          width={40}
        />
        <YAxis yAxisId="price" unit=" kr" orientation="right" tickCount={15} />
        <YAxis yAxisId="label" hide domain={[0, 1]} />
        <Tooltip />
        <Legend verticalAlign="top" height={30} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Daily({
  graphData,
  summary,
}: {
  graphData: ReportData["daily"]["rows"];
  summary?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={summary ? 300 : 450}>
      <ComposedChart
        data={summary ? graphData : expandLast(addEndItem(graphData))}
      >
        <CartesianGrid stroke="#dddddd" />
        <Area
          type={summary ? "basis" : "stepAfter"}
          dataKey="fjernvarme"
          name="Fjernvarme"
          stroke="#ff0000"
          fill="#ff0000"
          fillOpacity={0.3}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        <Area
          type={summary ? "basis" : "stepAfter"}
          dataKey="stroem"
          name="Strøm"
          stroke="#6aa84f"
          fill="#6aa84f"
          fillOpacity={0.3}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        <Line
          type={summary ? "basis" : "stepAfter"}
          dataKey="temperature"
          name="Utetemperatur Blindern"
          stroke="#336EFF"
          yAxisId="temp"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        <Line
          type={summary ? "basis" : "stepAfter"}
          dataKey="price"
          name="Estimert kostnad"
          stroke="#555555"
          yAxisId="price"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        {graphData
          .slice(1)
          .filter((it) => it.date.endsWith("-01"))
          .map((it) => (
            <ReferenceLine
              key={`month-${it.name}`}
              x={it.name}
              stroke="#555555"
            />
          ))}
        {graphData
          .filter((it) => it.date.endsWith("-15"))
          .map((it) => (
            <ReferenceDot
              key={`month-text-${it.name}`}
              x={it.name}
              y={-0.05}
              label={monthNames[Number(it.date.slice(5, 7))]!}
              fillOpacity={0}
              strokeWidth={0}
              ifOverflow="visible"
              yAxisId="label"
            />
          ))}
        <XAxis
          dataKey="name"
          angle={-90}
          height={40}
          interval={0}
          tickMargin={15}
          ticks={graphData
            .filter((it) => it.fjernvarme != null && it.stroem != null)
            .slice(-1)
            .map((it) => it.name)}
          fontSize={7}
        />
        <YAxis unit=" kWh" tickCount={15} />
        <YAxis
          yAxisId="temp"
          unit=" &#8451;"
          orientation="right"
          interval={0}
          ticks={deriveTempTickCount(
            graphData.map((it) => it.temperature ?? 0)
          )}
          domain={["dataMin", "dataMax"]}
          width={40}
        />
        <YAxis yAxisId="price" unit=" kr" orientation="right" tickCount={15} />
        <YAxis yAxisId="label" hide domain={[0, 1]} />
        <Tooltip />
        <Legend verticalAlign="top" height={20} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function MonthlyData({
  graphData,
  label,
  field,
}: {
  graphData: ReportData["monthly"]["rows"];
  label: string;
  field: keyof ReportData["monthly"]["rows"][0]["years"][""] | "priceByKwh";
}) {
  const years = [
    ...new Set(graphData.flatMap((it) => Object.keys(it.years))),
  ].sort();

  return (
    <div className="monthly-item">
      <h3>{label}</h3>
      <ResponsiveContainer width={500} height={450}>
        <ComposedChart data={graphData}>
          <CartesianGrid stroke="#dddddd" />
          {years.map((year, idx) => (
            <Line
              type="monotone"
              dataKey={
                field === "priceByKwh"
                  ? (it) =>
                      Math.round(
                        (it.years[year].price / it.years[year].forbrukSum) * 100
                      )
                  : `years.${year}.${field}`
              }
              name={year}
              stroke={colors[idx % colors.length]}
              isAnimationActive={false}
              dot={false}
              legendType="plainline"
              strokeWidth={1.2}
            />
          ))}
          <XAxis dataKey={(it) => monthNames[Number(it.month)]} />
          {field === "temperature" ? (
            <YAxis
              unit=" &#8451;"
              interval={0}
              ticks={deriveTempTickCount(
                graphData.flatMap((it) =>
                  Object.values(it.years).map((it) => it.temperature ?? 0)
                )
              )}
              domain={["dataMin", "dataMax"]}
              width={100}
            />
          ) : field === "fjernvarme" ||
            field === "stroem" ||
            field === "forbrukSum" ? (
            <YAxis unit=" kWh" tickCount={15} width={100} />
          ) : field === "price" ? (
            <YAxis unit=" kr" tickCount={15} width={100} />
          ) : field === "spotprice" || field === "priceByKwh" ? (
            <YAxis unit=" øre" tickCount={15} width={100} />
          ) : null}
          <Tooltip />
          {field === "priceByKwh" &&
            Object.entries(averagePrices).map(([year, price]) => (
              <ReferenceLine
                y={price * 100}
                stroke="#555"
                strokeWidth={1}
                strokeDasharray="3 4"
                label={year}
              />
            ))}
          <Legend verticalAlign="top" height={20} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function Monthly({ graphData }: { graphData: ReportData["monthly"]["rows"] }) {
  return (
    <>
      <MonthlyData graphData={graphData} label="Kostnad" field="price" />
      <MonthlyData
        graphData={graphData}
        label="Forbruk alt"
        field="forbrukSum"
      />
      <MonthlyData
        graphData={graphData}
        label="Gjennomsnittlig reell pris pr kWh"
        field="priceByKwh"
      />
      <MonthlyData
        graphData={graphData}
        label="Gjennomsnittlig spotpris"
        field="spotprice"
      />
      <MonthlyData
        graphData={graphData}
        label="Gjennomsnittlig utetemperatur Blindern"
        field="temperature"
      />
      <MonthlyData
        graphData={graphData}
        label="Forbruk fjernvarme"
        field="fjernvarme"
      />
      <MonthlyData graphData={graphData} label="Forbruk strøm" field="stroem" />
    </>
  );
}

function Yearly({ tableData }: { tableData: ReportData["table"]["yearly"] }) {
  return (
    <ResponsiveContainer width="100%" height={450}>
      <ComposedChart
        data={tableData
          // Only fjernvarme before 2015, so let's exclude that.
          // Temperature from 2015 which is interesting to compare against.
          .filter((it) => it.name >= "2015")
          .map((it) => ({
            ...it,
            // Don't have strøm usage before 2018, so avoid showing 0 for that.
            usageStroem:
              it.stroem.usageKwh === 0 ? null : roundTwoDec(it.stroem.usageKwh),
            usageFjernvarme: roundTwoDec(it.fjernvarme.usageKwh),
            usageSum:
              it.stroem.usageKwh === 0
                ? null
                : roundTwoDec(it.stroem.usageKwh + it.fjernvarme.usageKwh),
            sum: sumOverride[it.name] ?? (it.sum === 0 ? null : it.sum),
            temperature:
              it.temperature != null ? roundTwoDec(it.temperature) : null,
          }))}
      >
        <CartesianGrid stroke="#dddddd" />
        <Area
          type="linear"
          dataKey="usageSum"
          name="Forbruk alt"
          stroke="#888888"
          strokeOpacity={0.3}
          fill="#888888"
          fillOpacity={0.3}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        <Area
          type="linear"
          dataKey="usageFjernvarme"
          name="Fjernvarme"
          stroke="#ff0000"
          fill="#ff0000"
          fillOpacity={0.3}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        <Area
          type="linear"
          dataKey="usageStroem"
          name="Strøm"
          stroke="#6aa84f"
          fill="#6aa84f"
          fillOpacity={0.3}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        <Line
          type="linear"
          dataKey="temperature"
          name="Utetemperatur Blindern"
          stroke="#336EFF"
          yAxisId="temp"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        <Line
          type="linear"
          dataKey="sum"
          name="Estimert kostnad"
          stroke="#555555"
          yAxisId="price"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        <XAxis
          dataKey="name"
          angle={-90}
          height={40}
          interval={0}
          tickMargin={15}
          fontSize={7}
        />
        <YAxis unit=" kWh" tickCount={15} />
        <YAxis
          yAxisId="temp"
          unit=" &#8451;"
          orientation="right"
          interval={0}
          ticks={deriveTempTickCount(
            tableData.map((it) => it.temperature ?? 0)
          )}
          domain={["dataMin", "dataMax"]}
          width={40}
        />
        <YAxis yAxisId="price" unit=" kr" orientation="right" tickCount={15} />
        <YAxis yAxisId="label" hide domain={[0, 1]} />
        <Tooltip />
        <Legend verticalAlign="top" height={20} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function HourlyPrice({ reportData }: { reportData: ReportData }) {
  const now = Temporal.Now.zonedDateTimeISO("Europe/Oslo");
  const nowDate = now.toPlainDate().toString();

  const hourStartRow = reportData.prices.rows.find(
    (it) => it.date == nowDate && it.hour == now.hour
  );

  const nextHour = now.add({ hours: 1 });
  const nextHourDate = nextHour.toPlainDate().toString();
  const hourEndRow = reportData.prices.rows.find(
    (it) => it.date == nextHourDate && it.hour == nextHour.hour
  );

  const stroemPriceThisHour = hourStartRow?.priceStroemKwh;

  return (
    <ResponsiveContainer width="100%" height={300} className="price-graph">
      <ComposedChart data={addEndItem(reportData.prices.rows)}>
        <CartesianGrid stroke="#dddddd" />
        <Area
          type="stepAfter"
          dataKey="priceFjernvarmeKwh"
          name="Fjernvarme"
          stroke="#ff0000"
          fill="#ff0000"
          fillOpacity={0.05}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Area
          type="stepAfter"
          dataKey="priceStroemKwh"
          name="Strøm"
          stroke="#6aa84f"
          fill="#6aa84f"
          fillOpacity={0.1}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Line
          type="stepAfter"
          dataKey="nordpoolKwh"
          name="Nord Pool (spotpris)"
          stroke="#888"
          opacity={0.5}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1}
        />
        {stroemPriceThisHour && hourStartRow && hourEndRow && (
          <ReferenceArea
            x1={hourStartRow.name}
            x2={hourEndRow.name}
            y1={0}
            y2={stroemPriceThisHour}
            fill="#6aa84f"
            fillOpacity={1}
            label="NÅ"
            ifOverflow="extendDomain"
          />
        )}
        <ReferenceLine y={0} stroke="#555" strokeWidth={1} />
        {Object.entries(averagePrices).map(([year, price]) => (
          <ReferenceLine
            y={price}
            stroke="#555"
            strokeWidth={1}
            strokeDasharray="3 4"
            label={year}
          />
        ))}
        {reportData.prices.rows
          .filter((it) => it.name.endsWith("kl 13"))
          .map((it) => (
            <ReferenceDot
              key={`date-text-${it.name}`}
              x={it.name}
              y={-0.05}
              label={it.name.split(" kl")[0]!}
              fillOpacity={0}
              strokeWidth={0}
              ifOverflow="visible"
              yAxisId="label"
            />
          ))}
        {reportData.prices.rows
          .slice(1)
          .filter((it) => it.name.endsWith("kl 00"))
          .map((it) => (
            <ReferenceLine
              key={`date-${it.name}`}
              x={it.name}
              stroke="#555555"
            />
          ))}
        <XAxis dataKey="name" tick={false} axisLine={false} />
        <YAxis unit=" kr" tickCount={15} />
        <YAxis yAxisId="label" hide domain={[0, 1]} />
        <Tooltip />
        <Legend verticalAlign="top" height={20} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function EnergyTemperature({ etData }: { etData: ReportData["et"] }) {
  const [showScatterDetails, setShowScatterDetails] = useState(false);

  const finalData = etData.rows.filter(
    (it) => it.temperature !== undefined && it.temperature < 20
  );

  const result = [
    {
      items: finalData.slice(0, -10).filter((it) => it.date < "2024-07"),
      color: "#AAAAAA",
      fillOpacity: 0.4,
    },
    {
      items: finalData
        .slice(0, -10)
        .filter((it) => it.date >= "2024-07" && it.date < "2025"),
      color: "#6aa84f",
      fillOpacity: 0.4,
    },
    {
      items: finalData
        .slice(0, -10)
        .filter((it) => it.date >= "2025-01-01" && it.date < "2025-07-01"),
      color: "#336EFF",
      fillOpacity: 0.4,
    },
    {
      items: finalData.slice(0, -10).filter((it) => it.date >= "2025-07-01"),
      color: "#FF6600",
      fillOpacity: 0.7,
    },
    {
      items: finalData.slice(-10, -1),
      color: "#000000",
      fillOpacity: 1,
    },
    { items: finalData.slice(-1), color: "#FF0000", fillOpacity: 1 },
  ];

  const result2 = result
    .filter((it) => it.items.length > 0)
    .map((it) => {
      const firstDate = it.items[0]!.date;
      const lastDate = it.items.at(-1)!.date;

      const name =
        firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`;

      return {
        ...it,
        name,
      };
    });

  function trendData(data: ReportData["et"]["linearAll"]) {
    return [
      {
        temperature: -10,
        power: data.yStart + data.slope * -10,
      },
      {
        temperature: trendlineTemperatureLowerThan,
        power: data.yStart + data.slope * trendlineTemperatureLowerThan,
      },
    ];
  }

  const ChartType = showScatterDetails ? ScatterChart : ComposedChart;

  return (
    <>
      <ResponsiveContainer width="100%" height={400} className="et-graph">
        <ChartType>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="temperature"
            name="Temperatur"
            label={{ dy: 5, value: "Utetemperatur Blindern" }}
            height={35}
            interval={0}
            ticks={deriveTempTickCount(
              finalData.map((it) => it.temperature ?? 0)
            )}
            domain={["dataMin", 10]}
            fontSize={10}
          />
          <YAxis
            type="number"
            dataKey="power"
            name="Forbruk kWh"
            unit=" kWh"
            tickCount={12}
            width={70}
          />
          <ZAxis type="category" dataKey="date" name="Dato" range={[20, 20]} />
          {showScatterDetails && <Tooltip />}
          {result2.map((it, idx) => (
            <Scatter
              key={idx}
              name={it.name}
              data={it.items}
              fill={it.color}
              fillOpacity={it.fillOpacity}
              isAnimationActive={false}
            />
          ))}
          <Line
            data={trendData(etData.linearH21V24)}
            dataKey="power"
            stroke="#AAAAAA"
            strokeOpacity={0.5}
            name="H21V24"
            isAnimationActive={false}
          />
          <Line
            data={trendData(etData.linearH24)}
            dataKey="power"
            stroke="#6aa84f"
            strokeOpacity={0.5}
            name="H24"
            isAnimationActive={false}
          />
          <Line
            data={trendData(etData.linearV25)}
            dataKey="power"
            stroke="#336EFF"
            strokeOpacity={0.5}
            name="V25"
            isAnimationActive={false}
          />
          <Line
            data={trendData(etData.linearH25)}
            dataKey="power"
            stroke="#ff6600"
            strokeOpacity={0.8}
            strokeWidth={2}
            name="H25"
            isAnimationActive={false}
          />
          <Legend verticalAlign="top" height={40} />
        </ChartType>
      </ResponsiveContainer>
      <ul>
        <li>
          Høst 2021 - vår 2024: forbruk = f(temperatur) ={" "}
          {roundTwoDec(etData.linearH21V24.slope)} * temperatur +{" "}
          {Math.round(etData.linearH21V24.yStart)}
        </li>
        <li>
          Høst 2024: forbruk = f(temperatur) ={" "}
          {roundTwoDec(etData.linearH24.slope)} * temperatur +{" "}
          {Math.round(etData.linearH24.yStart)}
        </li>
        <li>
          Vår 2025: forbruk = f(temperatur) ={" "}
          {roundTwoDec(etData.linearV25.slope)} * temperatur +{" "}
          {Math.round(etData.linearV25.yStart)}
        </li>
        <li>
          Høst 2025: forbruk = f(temperatur) ={" "}
          {roundTwoDec(etData.linearH25.slope)} * temperatur +{" "}
          {Math.round(etData.linearH25.yStart)}
        </li>
      </ul>
      <p>
        <label>
          <input
            type="checkbox"
            checked={showScatterDetails}
            onClick={() => setShowScatterDetails(!showScatterDetails)}
          />{" "}
          Bytt modus for å kunne peke på punktene
        </label>
      </p>
      <p>
        Lineær regresjon tar utgangspunkt i dager med temperatur kaldere enn{" "}
        {trendlineTemperatureLowerThan} grader.
      </p>
    </>
  );
}

function PrettyNumber({ children }: { children: number }) {
  return <>{children.toLocaleString("nb")}</>;
}

function sum(items: Record<string, number>) {
  return Object.values(items).reduce((acc, cur) => acc + cur, 0);
}

function sumall(usage: UsagePrice) {
  return sum(usage.static) + sum(usage.variableByKwh);
}

function PriceDetails({
  type,
  item,
  datapointsCount,
}: {
  type: "stroem" | "fjernvarme";
  item: UsagePrice;
  datapointsCount: number;
}) {
  const [show, setShow] = useState(false);
  const stroemkostnad = item.variableByKwh["Strøm: Kraft"];

  const sum = sumall(item);

  return (
    <div
      className="pricedetails"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {Math.round(sum)}
      {show && (
        <div className="item">
          <p>Priser medregnet MVA</p>
          <p>Fastpriser</p>
          <ul>
            {Object.entries(item.static).map(([key, val]) => {
              const mva =
                pricesConfig.static[key as keyof typeof pricesConfig.static]
                  ?.mva;
              return (
                <li key={key}>
                  {key}: {roundTwoDec(val)}
                  {!!mva && ` (eks mva: ${roundTwoDec(val / (1 + mva))})`}
                </li>
              );
            })}
          </ul>
          <p>Variable priser</p>
          <ul>
            {Object.entries(item.variableByKwh).map(([key, val]) => {
              const mva =
                pricesConfig.variableByKwh[
                  key as keyof typeof pricesConfig.variableByKwh
                ]?.mva;
              return (
                <li key={key}>
                  {key}: {roundTwoDec(val)}
                  {!!mva && ` (eks mva: ${roundTwoDec(val / (1 + mva))})`}
                </li>
              );
            })}
          </ul>
          {stroemkostnad != null && (
            <p>
              Snitt kraftpris:{" "}
              {roundTwoDec((stroemkostnad / item.usageKwh) * 100)} øre / kWh
              {` (eks mva: ${roundTwoDec(
                ((stroemkostnad / item.usageKwh) * 100) / 1.25
              )} øre / kWh)`}
            </p>
          )}
          <p>
            Snitt per kWh: {roundTwoDec((sum / item.usageKwh) * 100)} øre / kWh
          </p>
          {type === "fjernvarme" && (
            <p>
              Snitt per kWh eks mva (for fakturakontroll):{" "}
              {roundTwoDec(
                (((sum - (item.static["Fastledd"] ?? 0)) / item.usageKwh) *
                  100) /
                  1.25
              )}{" "}
              øre / kWh
            </p>
          )}
          <p>Datapunkter: {datapointsCount}</p>
        </div>
      )}
    </div>
  );
}

// Source: Oversikt strømkostnader Blindern.xlsx
const sumOverride: Record<string, number> = {
  "2016": 1033000,
  "2017": 1425000,
  "2018": 1571000,
  "2019": 1414000,
  "2020": 928000,
  "2021": 2456000,
};

function TableData({
  item,
  title,
  isDaily,
  skipOverride,
}: {
  item: ReportData["table"]["yearly"];
  title: string;
  isDaily?: boolean;
  skipOverride?: boolean;
}) {
  const header = (
    <tr>
      <th>{title}</th>
      <th>Temperatur</th>
      <th>Spotpris</th>
      <th>Forbruk strøm</th>
      <th>Forbruk fjernvarme</th>
      <th>Forbruk alt</th>
      <th>Strømstøtte</th>
      <th>Kostnad strøm</th>
      <th>Kostnad fjernvarme</th>
      <th>Kostnad alt</th>
      <th>øre/kWh</th>
    </tr>
  );

  return (
    <table className="usagetable">
      <thead>{header}</thead>
      {item.length > 20 && <tfoot>{header}</tfoot>}
      <tbody>
        {item.map((it) => (
          <tr key={it.name}>
            <td>{it.name}</td>
            <td>{it.temperature == null ? "" : roundTwoDec(it.temperature)}</td>
            <td>
              {it.spotprice == null ? "" : roundTwoDec(it.spotprice * 100)}
            </td>
            <td>
              {Math.round(it.stroem.usageKwh)}
              {isDaily && it.stroemDatapointsCount !== 48 && (
                <div className="incomplete-data">
                  {it.stroemDatapointsCount} datapunkter
                </div>
              )}
            </td>
            <td>
              {Math.round(it.fjernvarme.usageKwh)}
              {isDaily && it.fjernvarmeDatapointsCount !== 24 && (
                <div className="incomplete-data">
                  {it.fjernvarmeDatapointsCount} datapunkter
                </div>
              )}
            </td>
            <td>{Math.round(it.stroem.usageKwh + it.fjernvarme.usageKwh)}</td>
            <td>
              {Math.round(
                (it.stroem.variableByKwh["Strømstøtte"] ?? 0) +
                  (it.fjernvarme.variableByKwh["Strømstøtte"] ?? 0) +
                  (it.stroem.variableByKwh["Norgespris"] ?? 0) +
                  (it.fjernvarme.variableByKwh["Norgespris"] ?? 0)
              ) || 0}
            </td>
            <td>
              <PriceDetails
                type="stroem"
                item={it.stroem}
                datapointsCount={it.stroemDatapointsCount}
              />
            </td>
            <td>
              <PriceDetails
                type="fjernvarme"
                item={it.fjernvarme}
                datapointsCount={it.fjernvarmeDatapointsCount}
              />
            </td>
            <td>
              {(skipOverride ? undefined : sumOverride[it.name]) ??
                Math.round(sumall(it.stroem) + sumall(it.fjernvarme))}
            </td>
            <td>
              {it.stroem.usageKwh + it.fjernvarme.usageKwh > 0 && (
                <>
                  {Math.round(
                    ((sumall(it.stroem) + sumall(it.fjernvarme)) /
                      (it.stroem.usageKwh + it.fjernvarme.usageKwh)) *
                      100
                  )}
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Presentation({
  reportData,
  presentationMode,
}: {
  reportData: ReportData;
  presentationMode: boolean;
}) {
  const currentMonthCost =
    (reportData.cost.currentMonth.cost.fjernvarmeSum ?? 0) +
    (reportData.cost.currentMonth.cost.stroemSum ?? 0);

  const previousMonthCost =
    (reportData.cost.previousMonth.cost.fjernvarmeSum ?? 0) +
    (reportData.cost.previousMonth.cost.stroemSum ?? 0);

  const now = Temporal.Now.zonedDateTimeISO("Europe/Oslo");
  const nowDate = now.toPlainDate().toString();

  const todayRows = reportData.prices.rows.filter((it) => it.date == nowDate);

  const todayPrices = todayRows.flatMap((it) => [
    it.priceFjernvarmeKwh,
    it.priceStroemKwh,
  ]);
  const sumTodayPrices = todayPrices.reduce((acc, cur) => acc + cur, 0);
  const averagePriceToday = sumTodayPrices / todayPrices.length;

  const averagePricesToBeUsed = {
    2018: averagePrices[2018],
    2019: averagePrices[2019],
    2020: averagePrices[2020],
    2021: averagePrices[2021],
    2022: averagePrices[2022],
    2023: averagePrices[2023],
  };
  const averagePreviousYears =
    Object.values(averagePricesToBeUsed).reduce((acc, cur) => acc + cur, 0) /
    Object.values(averagePricesToBeUsed).length;
  const priceDifference =
    (averagePriceToday - averagePreviousYears) / averagePreviousYears;

  return (
    <div className="presentation">
      <h1>Energiforbruk på Blindern Studenterhjem</h1>
      <div className="presentation-key-numbers">
        <div className="presentation-key-number">
          <h2>Gjennomsnittlig kostnad i dag</h2>
          <div className="presentation-key-number-value">
            <PrettyNumber>{Math.round(averagePriceToday * 100)}</PrettyNumber>{" "}
            øre/kWh
          </div>
          <div className="presentation-key-number-desc">
            Inkluderer også strømstøtte
          </div>
        </div>
        <div className="presentation-key-number">
          <h2>Hva koster energien i dag i forhold til tidligere?</h2>
          <div
            className="presentation-key-number-value"
            style={priceDifference > 0 ? { color: "#FF0000" } : {}}
          >
            {Math.round((1 + priceDifference) * 100)} %
          </div>
          <div className="presentation-key-number-desc">
            Sammenliknet mot snittpris i 2018-2023
          </div>
        </div>
        <div className="presentation-key-number">
          <h2>
            Kostnad så langt i{" "}
            {monthNamesLong[
              Number(reportData.cost.currentMonth.yearMonth.slice(5))
            ]!.toLowerCase()}
          </h2>
          <div className="presentation-key-number-value">
            kr <PrettyNumber>{Math.round(currentMonthCost)}</PrettyNumber>
          </div>
          <div className="presentation-key-number-desc">
            {
              monthNamesLong[
                Number(reportData.cost.previousMonth.yearMonth.slice(5))
              ]
            }
            : kr <PrettyNumber>{Math.round(previousMonthCost)}</PrettyNumber>
          </div>
        </div>
      </div>
      <div className="presentation-daily">
        <h2>Daglig forbruk siste 45 dager</h2>
        <div className="presentation-daily-graph">
          <Daily
            graphData={reportData.daily.rows
              .filter((it) => it.date < nowDate)
              .slice(-45)}
            summary
          />
        </div>
      </div>
      <div className="presentation-show-more">
        {presentationMode ? (
          <>
            Se mer data på{" "}
            <a href="https://foreningenbs.no/energi">foreningenbs.no/energi</a>
          </>
        ) : (
          <>Scroll ned for mer data</>
        )}
      </div>
    </div>
  );
}

function FormatPlainMonthDay({ value }: { value: Temporal.PlainMonthDay }) {
  const isoDay = value.day;
  const isoMonth = Number(value.monthCode.slice(1, 3));
  return (
    <>
      {isoDay}. {monthNamesLong[isoMonth]!.toLowerCase()}
    </>
  );
}

function App() {
  const [reportData, setReportData] = useState<ReportData>();
  useEffect(() => {
    fetch("report.json")
      .then((it) => it.json())
      .then((resultJson) => {
        setReportData(resultJson as ReportData);
      })
      .catch((e) => {
        console.error("Failed to load data", e);
      });
  }, []);

  if (!reportData) {
    return <p>Henter data...</p>;
  }

  const presentationMode = window.location.href.includes("?presentation");

  return (
    <div>
      <Presentation
        reportData={reportData}
        presentationMode={presentationMode}
      />
      {!presentationMode && (
        <div className="more-data">
          <p>
            Fjernvarme benyttes til oppvarming av varmt vann samt oppvarming via
            radiatorer. Strøm benyttes til alt annet, inkludert varmekabler på
            bad, vaskemaskiner, tørketromler, kjøkkenmaskiner mv. Pris for
            fjernvarme er flat hele måneden (utifra månedlig spotpris), men pris
            for strøm følger spotpris per time. Estimert kostnad inkluderer mva,
            nettleie, strømstøtte m.v.
          </p>
          <p>
            Merk at prismodellen mangler enkelte detaljer, slik at endelig
            regnskapsmessig kostnad vil avvike noe.
          </p>
          <h2>Forbruk time for time siste 7 dager</h2>
          <Hourly reportData={reportData} />
          <h2>Daglig forbruk vs. utetemperatur (siden 1. juli 2021)</h2>
          <EnergyTemperature etData={reportData.et} />
          <h2>
            Daglig forbruk vs. utetemperatur (siden 1. juli 2021) - kun
            fjernvarme
          </h2>
          <EnergyTemperature etData={reportData.etFjernvarme} />
          <h2>Estimert pris per kWh</h2>
          <p>
            Endelig pris påvirkes blant annet av månedens gjennomsnittlige
            spotpris. Estimatet er mer unøyaktig i starten av måneden enn
            slutten.
            {reportData.spotprices.currentMonth.spotprice && (
              <>
                {" "}
                Gjennomsnittlig spotpris inkl mva fra Nord Pool så langt denne
                måneden:{" "}
                {roundTwoDec(reportData.spotprices.currentMonth.spotprice)}{" "}
                øre/kWh.
                {reportData.spotprices.previousMonth.spotprice && (
                  <>
                    {" "}
                    Forrige måned:{" "}
                    {roundTwoDec(
                      reportData.spotprices.previousMonth.spotprice
                    )}{" "}
                    øre/kWh.
                  </>
                )}
              </>
            )}
          </p>
          <HourlyPrice reportData={reportData} />
          {[...new Set(reportData.daily.rows.map((it) => it.date.slice(0, 4)))]
            .sort()
            .reverse()
            .map((year) => (
              <Fragment key={year}>
                <h2>Daglig forbruk {year}</h2>
                <Daily
                  graphData={reportData.daily.rows.filter((it) =>
                    it.date.startsWith(String(year))
                  )}
                />
              </Fragment>
            ))}
          <h2>Sammenlikning måned for måned på tvers av år</h2>
          <p>
            Vær obs på at inneværende måned vil ha manglende tall og vil vise
            feil verdi.
          </p>
          <Monthly graphData={reportData.monthly.rows} />
          <h2>Årlig forbruk</h2>
          <Yearly tableData={reportData.table.yearly} />
          <h2>
            Detaljerte årstall (hvert år frem til og med{" "}
            <FormatPlainMonthDay
              value={Temporal.PlainMonthDay.from(
                reportData.table.yearlyToThisDate.untilDayIncl
              )}
            />
            )
          </h2>
          Tall før 2022 kan være mangelfulle.
          <TableData
            title="År"
            item={reportData.table.yearlyToThisDate.data}
            skipOverride
          />
          <h2>Detaljerte årstall (hele år)</h2>
          Tall før 2022 kan være mangelfulle.
          <TableData title="År" item={reportData.table.yearly} />
          <h2>Detaljerte månedstall</h2>
          <TableData title="Måned" item={reportData.table.monthly} />
          <h2>Detaljerte dagstall siste dager</h2>
          <TableData title="Dato" item={reportData.table.lastDays} isDaily />
          <p className="github-link">
            Laget av Henrik Steen
            <br />
            <a href="https://github.com/blindern/energi">
              github.com/blindern/energi
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
