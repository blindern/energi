import { Temporal } from "@js-temporal/polyfill";
import type { HourUsage } from "./common.ts";

export async function getAccessToken(
  username: string,
  password: string
): Promise<string> {
  const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

  const response = await fetch("https://api.celsio.no/minside/login/auth0/", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unexpected response: ${response.status} ${response.statusText} from ${response.url}`);
  }

  const responseJson = (await response.json()) as any;
  const accessToken = responseJson.accessToken;

  if (accessToken == null) {
    throw new Error(`Missing accessToken in response. Keys: ${Object.keys(responseJson).join(", ")}`);
  }

  return accessToken;
}

export async function getHourlyData({
  accessToken,
  anleggNummer,
  kundeId,
  firstDate,
  lastDate,
}: {
  accessToken: string;
  anleggNummer: string;
  kundeId: string;
  firstDate: Temporal.PlainDate;
  lastDate: Temporal.PlainDate;
}): Promise<HourUsage[]> {
  const fromTime = firstDate.toString() + " 00:00:00";
  const toTime = lastDate.toString() + " 23:00:00";

  const url = `https://api.celsio.no/minside/forbruk/automatic/export/hourly?anleggNummer=${anleggNummer}&kundeId=${kundeId}&fromTime=${encodeURIComponent(
    fromTime
  )}&toTime=${encodeURIComponent(toTime)}`;

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unexpected response: ${response.status} ${response.statusText} from ${url}`);
  }

  if (response.status == 204) {
    return [];
  }

  const responseJson = (await response.json()) as any;
  const fileContents = responseJson.fileContents;

  if (fileContents == null) {
    throw new Error(`Missing fileContents in response. Keys: ${Object.keys(responseJson).join(", ")}`);
  }

  const csvData = Buffer.from(fileContents, "base64").toString();

  return parseCsvData(csvData);
}

function parseCsvData(csvData: string): HourUsage[] {
  if (csvData === "") {
    return [];
  }

  // Remove UTF-8 BOM.
  if (csvData.charCodeAt(0) === 0xFEFF) {
    csvData = csvData.slice(1);
  }

  const lines = csvData.split("\n");

  const firstLine = lines[0]!.split(";");
  if (firstLine[0] !== "Tid" || firstLine[1] !== "Forbruk [kWh]") {
    throw new Error(`Unexpected csv header: ${firstLine.join(";").slice(0, 200)}`);
  }

  const result: HourUsage[] = [];

  for (const line of lines.slice(1)) {
    if (line.trim() === "") {
      continue;
    }

    const parts = line.split(";");
    if (parts[1] === "") {
      // This case was seen on 2023-10-29 during the DST change.
      // It has 25 records and the 25th was:
      // 2023102902;
      // While the third row had the value for two hours:
      // 2023102902;380
      continue;
    }

    result.push({
      date: Temporal.PlainDate.from({
        year: Number(parts[0]!.slice(0, 4)),
        month: Number(parts[0]!.slice(4, 6)),
        day: Number(parts[0]!.slice(6, 8)),
      }),
      hour: Number(parts[0]!.slice(8, 10)),
      usage: Number(parts[1]),
    });
  }

  return result;
}
