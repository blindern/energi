import data2 from "../../extraction/report.json";

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

function Hourly() {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={data2.hourly.rows}>
        <CartesianGrid stroke="#dddddd" />
        <Area
          type="step"
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
          type="step"
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
          type="step"
          dataKey="temperature"
          name="Utetemperatur Blindern"
          stroke="#0000ff"
          yAxisId="temp"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Line
          type="step"
          dataKey="price"
          name="Estimert kostnad"
          stroke="#555555"
          yAxisId="price"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <XAxis
          dataKey="name"
          angle={-90}
          height={100}
          interval={1}
          dy={25}
          dx={-3}
        />
        <YAxis unit=" kWh" tickCount={10} />
        <YAxis
          yAxisId="temp"
          unit=" &#8451;"
          orientation="right"
          interval={0}
          ticks={deriveTempTickCount(
            data2.hourly.rows.map((it) => it.temperature ?? 0)
          )}
          width={40}
        />
        <YAxis yAxisId="price" unit=" kr" orientation="right" tickCount={15} />
        <Legend verticalAlign="top" height={30} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Daily() {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={data2.daily.rows}>
        <CartesianGrid stroke="#dddddd" />
        <Area
          type="step"
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
          type="step"
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
          type="step"
          dataKey="temperature"
          name="Utetemperatur Blindern"
          stroke="#0000ff"
          yAxisId="temp"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Line
          type="step"
          dataKey="price"
          name="Estimert kostnad"
          stroke="#555555"
          yAxisId="price"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <XAxis
          dataKey="name"
          angle={-90}
          height={40}
          interval={0}
          dy={20}
          dx={-3}
        />
        <YAxis unit="kWh" tickCount={15} />
        <YAxis
          yAxisId="temp"
          unit=" &#8451;"
          orientation="right"
          interval={0}
          ticks={deriveTempTickCount(
            data2.daily.rows.map((it) => it.temperature ?? 0)
          )}
          width={40}
        />
        <YAxis yAxisId="price" unit=" kr" orientation="right" tickCount={15} />
        <Legend verticalAlign="top" height={30} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function HourlyPrice() {
  const now = new Date();
  const hourStart = `${now.getDate()}.${
    now.getMonth() + 1
  } kl ${now.getHours()}`;

  const nextHour = new Date(now.getTime());
  nextHour.setHours(now.getHours() + 1);
  const hourEnd = `${nextHour.getDate()}.${
    nextHour.getMonth() + 1
  } kl ${nextHour.getHours()}`;

  const stroemPriceThisHour = data2.prices.rows.find(
    (it) => it.name == hourStart
  )?.priceStroemKwh;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={data2.prices.rows}>
        <CartesianGrid stroke="#dddddd" />
        <Line
          type="step"
          dataKey="priceFjernvarmeKwh"
          name="Estimert pris fjernvarme per kWh"
          stroke="#ff0000"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Line
          type="stepAfter"
          dataKey="priceStroemKwh"
          name="Estimert pris strøm per kWh"
          stroke="#6aa84f"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        {stroemPriceThisHour && (
          <ReferenceArea
            x1={hourStart}
            x2={hourEnd}
            y1={0}
            y2={stroemPriceThisHour}
            stroke="#000000"
            strokeOpacity={1}
            fill="#6aa84f"
            label="Inneværende time"
            ifOverflow="extendDomain"
          />
        )}
        <ReferenceLine y={0} stroke="black" strokeWidth={3} strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          angle={-90}
          height={40}
          interval={0}
          dy={20}
          dx={-3}
          fontSize={8}
        />
        <YAxis unit=" kr" tickCount={15} />
        <Legend verticalAlign="top" height={30} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function EnergyTemperature() {
  const finalData = data2.et.rows.filter(
    (it) => it.temperature !== undefined && it.temperature < 20
  );

  const result = [
    {
      items: finalData
        .slice(0, -10)
        .filter((it) => !it.date.startsWith("2022")),
      color: "#888888",
      fillOpacity: 0.4,
    },
    {
      items: finalData
        .slice(0, -10)
        .filter((it) => it.date >= "2022-01-01" && it.date < "2022-07-01"),
      color: "#8884d8",
      fillOpacity: 0.3,
    },
    {
      items: finalData.slice(0, -10).filter((it) => it.date >= "2022-07-01"),
      color: "#6aa84f",
      fillOpacity: 0.8,
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
      const firstDate = it.items[0].date;
      const lastDate = it.items.at(-1)!.date;

      const name =
        firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`;

      return {
        ...it,
        name,
      };
    });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart>
        <CartesianGrid />
        <XAxis
          type="number"
          dataKey="temperature"
          name="Temperatur"
          label={{ dy: 5, value: "Utetemperatur Blindern" }}
          height={40}
          interval={0}
          ticks={deriveTempTickCount(
            finalData.map((it) => it.temperature ?? 0)
          )}
          domain={["dataMin", 10]}
        />
        <YAxis
          type="number"
          dataKey="power"
          name="Forbruk kWh"
          unit=" kWh"
          tickCount={12}
        />
        <ZAxis type="category" dataKey="date" name="Dato" range={[20, 20]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
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
        <Legend verticalAlign="top" height={25} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function App() {
  return (
    <div>
      <h1>Energiforbruk på Blindern Studenterhjem</h1>
      <h2>Timeforbruk siste dagene</h2>
      <Hourly />
      <div className="two-columns">
        <div>
          <h2>Dagsforbruk siste dagene</h2>
          <Daily />
        </div>
        <div>
          <h2>Estimert pris per kWh (inkludert alle avgifter og strømstøtte)</h2>
          <HourlyPrice />
        </div>
        <div>
          <h2>Sammenheng mellom forbruk og temperatur</h2>
          <EnergyTemperature />
        </div>
      </div>
      <footer>
        <p>
          Fjernvarme benyttes til oppvarming av varmt vann samt oppvarming via
          radiatorer. Strøm benyttes til alt annet, inkludert varmekabler på
          bad.
        </p>
        <p>
          Estimert kostnad inneværende måned avhenger av hva hele månedens
          gjennomsnittlige spotpris blir. Beregningene benytter tilgjengelig
          spotpris så langt i måneden. Kostnad for fjernvarme påvirkes ikke av
          timepris, men kostnad for strøm følger spotpris per time. Estimert
          kostnad inkluderer mva, nettleie, strømstøtte m.v.
        </p>
        <p>
          <a href="https://foreningenbs.no/energi">
            https://foreningenbs.no/energi
          </a>
          <br />
          <a href="https://github.com/blindern/energi">
            https://github.com/blindern/energi
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
