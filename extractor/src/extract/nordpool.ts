import { Temporal } from "@js-temporal/polyfill";

export interface HourPrice {
  date: Temporal.PlainDate;
  hour: number;
  price: number;
}

export async function getNordpoolData(
  date: Temporal.PlainDate
): Promise<HourPrice[]> {
  const endDate = date.toString();

  const url = `https://dataportal-api.nordpoolgroup.com/api/DayAheadPriceIndices?date=${endDate}&market=DayAhead&indexNames=NO1&currency=NOK&resolutionInMinutes=60`;

  // TODO: retry 500 errors
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unexpected response: ${response.status} ${response.statusText} from ${response.url}`);
  }

  if (response.status === 204) {
    // No content.
    return [];
  }

  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`Unexpected content type: ${response.headers.get("content-type")} from ${response.url}`);
  }

  const responseJson = (await response.json()) as {
    areaStates: {
      state: string;
      areas: string[];
    }[];
    multiIndexEntries: {
      deliveryStart: string;
      deliveryEnd: string;
      entryPerArea: Record<string, number>;
    }[];
  };

  /*
  Example states:
    "areaStates": [
        {
            "state": "Final",
            "areas": [
                "NO1"
            ]
        }
    ],
  */

  if (
    responseJson.areaStates[0]?.state !== "Final" ||
    responseJson.areaStates[0]?.areas[0] !== "NO1"
  ) {
    throw new Error(`Not final NO1 data: ${JSON.stringify(responseJson.areaStates).slice(0, 200)}`);
  }

  const result: HourPrice[] = [];

  /*
  Example data:
      "multiIndexEntries": [
        {
            "deliveryStart": "2024-12-03T23:00:00Z",
            "deliveryEnd": "2024-12-04T00:00:00Z",
            "entryPerArea": {
                "NO1": 628.03
            }
        },
  */

  for (const entry of responseJson.multiIndexEntries) {
    let timeStart: Temporal.Instant;
    try {
      timeStart = Temporal.Instant.from(entry.deliveryStart);
    } catch {
      throw new Error(`Couldn't parse deliveryStart: ${JSON.stringify(entry).slice(0, 200)}`);
    }

    let timeEnd: Temporal.Instant;
    try {
      timeEnd = Temporal.Instant.from(entry.deliveryEnd);
    } catch {
      throw new Error(`Couldn't parse deliveryEnd: ${JSON.stringify(entry).slice(0, 200)}`);
    }

    if (timeStart.until(timeEnd).total("hours") !== 1) {
      throw new Error(`Expected exactly one hour: ${JSON.stringify(entry).slice(0, 200)}`);
    }

    const price = entry.entryPerArea["NO1"];
    if (price == null) {
      continue;
    }

    const localDateTime = timeStart.toZonedDateTimeISO("Europe/Oslo");

    result.push({
      date: localDateTime.toPlainDate(),
      hour: localDateTime.hour,
      price,
    });
  }

  return result;
}
