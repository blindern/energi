import { Temporal } from "@js-temporal/polyfill";
import fetch from "node-fetch";
import { HourUsage } from "./common.js";

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
    console.log(response);
    throw new Error("Unexpected response");
  }

  const responseJson = (await response.json()) as any;
  const accessToken = responseJson.accessToken;

  if (accessToken == null) {
    console.log(response);
    console.log(responseJson);
    throw new Error("Missing accessToken in response");
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
    console.log(response);
    throw new Error("Unexpected response");
  }

  if (response.status == 204) {
    return [];
  }

  const responseJson = (await response.json()) as any;
  const fileContents = responseJson.fileContents;

  if (fileContents == null) {
    console.log(response);
    console.log(responseJson);
    throw new Error("Unexpected response");
  }

  const csvData = Buffer.from(fileContents, "base64").toString();

  return parseCsvData(csvData);
}

function parseCsvData(csvData: string): HourUsage[] {
  if (csvData === "") {
    return [];
  }

  const lines = csvData.split("\n");

  const firstLine = lines[0]!.split(";");
  if (firstLine[0] !== "Tid" || firstLine[1] !== "Forbruk [kWh]") {
    console.log(csvData);
    throw new Error("Unexpected csv data");
  }

  const result: HourUsage[] = [];

  for (const line of lines.slice(1)) {
    if (line.trim() === "") {
      continue;
    }

    const parts = line.split(";");
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
