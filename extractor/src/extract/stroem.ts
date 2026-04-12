import { Temporal } from "@js-temporal/polyfill";
import type { HourUsage } from "./common.ts";

interface Consumption {
  value: number;
  isVerified: boolean;
  status: string; // e.g. OK
}

interface Money {
  total: number;
  totalExTaxes: number;
  totalExVat: number;
}

interface SpotPrice {
  total: number;
  totalExTaxes: number;
  taxes: number;
}

interface Cost {
  energy: Money;
  fixed: Money;
  sum: Money;
}

interface DistributionPricePoint {
  pricePointName: string; // e.g. Dag
  price: {
    monetaryUnitOfMeasure: string; // e.g. øre/kWh
    currency: string; // e.g. NOK
    total: number;
    totalExTaxes: number;
    totalExVat: number;
  };
  percentage: number;
  consumption: number;
  consumptionUnitOfMeasure: string; // e.g. kWh
}

interface Distribution {
  totalMeterValueAveragePriceDistribution: {
    monetaryUnitOfMeasure: string; // e.g. øre/kWh
    currency: string; // e.g. NOK
    total: number;
    totalExTaxes: number;
    totalExVat: number;
  };
  day: DistributionPricePoint;
  night: DistributionPricePoint;
}

interface MeterValuesResponse {
  years: {
    months: {
      days: {
        hours: {
          id: string; // e.g. 2026041000
          production: null;
          consumption?: Consumption;
          level: string; // e.g. Cheap
          cost: Cost;
          compensationTotal: number;
          powerSupplierCost: Money;
          spotPrice: SpotPrice;
          monthNorwayPriceConsumption: number;
          norwayPriceThresholdExceeded: boolean;
          compensationConsumptionLimitExceeded: boolean;
        }[];
        isWeekendOrHoliday: boolean;
        id: string; // e.g. 20260410
        production: null;
        consumption: Consumption;
        cost: Cost;
        distribution: Distribution;
        isPeriodCompleted: boolean;
        compensationTotal: number;
        powerSupplierCost: Money;
        spotPrice: SpotPrice;
        compensationType: string; // e.g. NorwayPrice
        monthNorwayPriceConsumption: number;
        norwayPriceThresholdExceeded: boolean;
        compensationConsumptionLimitExceeded: boolean;
      }[];
      maxHours: {
        hours: {
          id: string; // e.g. 2026041013
          production: null;
          consumption: Consumption;
        }[];
        average: number;
        consumptionUnitOfMeasure: string; // e.g. kWh
      };
      id: string; // e.g. 202604
      production: null;
      consumption: Consumption;
      cost: Cost;
      distribution: Distribution;
      isPeriodCompleted: boolean;
      fixedPriceLevels: {
        id: string;
        valueMin: number;
        valueMax: number;
        nextIdDown: string | null;
        nextIdUp: string | null;
        valueUnitOfMeasure: string; // e.g. kWh/h
        monthlyTotal: number;
        monthlyTotalExVat: number;
        monthlyExTaxes: number;
        monthlyTaxes: number;
        monthlyUnitOfMeasure: string; // e.g. kr/måned
        levelInfo: string; // e.g. Power consumption: 0-2 kWh/h
        currency: string; // e.g. NOK
        monetaryUnitOfMeasure: string; // e.g. kr/time
        level: number;
        isActive: boolean;
      }[];
      compensationTotal: number;
      compensation: {
        vat: number;
        compensationDegree: number;
        total: number;
        averageSpotPrice: SpotPrice;
        priceThreshold: number;
        maxConsumption: number;
      };
      powerSupplierCost: Money;
      spotPrice: SpotPrice;
      compensationType: string; // e.g. NorwayPrice
      norwayPriceThresholdExceeded: boolean;
      compensationConsumptionLimitExceeded: boolean;
    }[];
    daylightSavingTimeStart: string; // e.g. 2026102502
    daylightSavingTimeEnd: string; // e.g. 2026032902
    id: string; // e.g. 2026
    production: null;
    consumption: Consumption;
    cost: Cost;
    distribution: Distribution;
    isPeriodCompleted: boolean;
    powerSupplierCost: Money;
    compensationTotal: number;
    spotPrice: SpotPrice;
    compensationType: string; // e.g. NorwayPrice
  }[];
  customerId: string | null;
  contractId: string;
  unit: {
    consumption: { value: string }; // e.g. kWh
    production: { value: string }; // e.g. kWh
    cost: { total: string; totalExVat: string; totalExTaxes: string }; // e.g. kr
    distribution: { total: string; totalExVat: string; totalExTaxes: string };
    fixedPriceLevels: {
      valueMin: string; // e.g. kWh/h
      valueMax: string;
      monthlyTotal: string; // e.g. kr/måned
      monthlyTotalExVat: string;
      monthlyExTaxes: string;
      monthlyTaxes: string;
    };
    compensation: {
      total: string; // e.g. kr
      priceThreshold: string; // e.g. øre/kWh
      maxConsumption: string; // e.g. kWh
      averageSpotPrice: { total: string; totalExVat: string; totalExTaxes: string };
    };
  };
}

export type ElviaSession = Map<string, Record<string, string>>;

function cookieHeader(session: ElviaSession, host: string): string {
  return Object.entries(session.get(host) ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function ingestSetCookie(
  session: ElviaSession,
  host: string,
  response: Response
): void {
  const current = session.get(host) ?? {};
  for (const raw of response.headers.getSetCookie()) {
    const parts = raw.split(";").map((it) => it.trim());
    const eq = parts[0]!.indexOf("=");
    if (eq === -1) continue;
    const name = parts[0]!.slice(0, eq);
    const value = parts[0]!.slice(eq + 1);
    const expires = parts.find((p) => /^expires=/i.test(p));
    if (expires && new Date(expires.slice(8)).getTime() < Date.now()) {
      delete current[name];
      continue;
    }
    current[name] = value;
  }
  session.set(host, current);
}

async function hop(
  session: ElviaSession,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const { host } = new URL(url);
  const headers = new Headers(init.headers);
  const cookie = cookieHeader(session, host);
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(url, { ...init, headers, redirect: "manual" });
  ingestSetCookie(session, host, response);
  return response;
}

async function followRedirects(
  session: ElviaSession,
  startUrl: string,
  init: RequestInit = {},
  maxHops = 12
): Promise<{ finalUrl: string; response: Response }> {
  let url = startUrl;
  for (let i = 0; i < maxHops; i++) {
    const response = await hop(session, url, i === 0 ? init : {});
    const location = response.headers.get("location");
    if (!location) return { finalUrl: url, response };
    url = new URL(location, url).toString();
  }
  throw new Error(`Exceeded max redirects starting from ${startUrl}`);
}

function serializeQueryString(form: Record<string, string>): string {
  return Object.entries(form)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");
}

export async function loginToElvia({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<ElviaSession> {
  const session: ElviaSession = new Map();

  const initial = await followRedirects(
    session,
    "https://minside.elvia.no/bff/login"
  );
  const loginPageHtml = await initial.response.text();

  const csrfMatch = loginPageHtml.match(
    /name="__RequestVerificationToken"[^>]*value="([^"]+)"/
  );
  if (!csrfMatch) {
    throw new Error(
      `Failed to find CSRF token in login page at ${initial.finalUrl}`
    );
  }

  const returnUrl =
    new URL(initial.finalUrl).searchParams.get("ReturnUrl") ?? "";
  const formBody = serializeQueryString({
    Email: email,
    Password: password,
    button: "login",
    RememberLogin: "false",
    ReturnUrl: returnUrl,
    __RequestVerificationToken: csrfMatch[1]!,
  });

  const result = await followRedirects(session, initial.finalUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: formBody,
  });

  if (!result.response.ok) {
    throw new Error(
      `Elvia login failed: status=${result.response.status} at ${result.finalUrl}`
    );
  }
  if (!session.get("minside.elvia.no")?.["__Host-kundeminsideweb"]) {
    throw new Error(
      `Elvia login completed without session cookie; final=${result.finalUrl}`
    );
  }

  return session;
}

export async function getMeterValues({
  contractId,
  firstDate,
  lastDate,
  session,
}: {
  contractId: string;
  firstDate: Temporal.PlainDate;
  lastDate: Temporal.PlainDate;
  session: ElviaSession;
}): Promise<MeterValuesResponse> {
  const fromIso = firstDate
    .toZonedDateTime("Europe/Oslo")
    .toString({ timeZoneName: "never" });
  const toIso = lastDate
    .add({ days: 1 })
    .toZonedDateTime("Europe/Oslo")
    .toString({ timeZoneName: "never" });

  const url =
    `https://minside.elvia.no/portal/v2/contract/${encodeURIComponent(contractId)}/metervalue?` +
    serializeQueryString({
      from: fromIso,
      to: toIso,
      includeEmptyValues: "true",
    });

  const response = await hop(session, url, {
    headers: { "x-csrf": "1", accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Unexpected response: ${response.status} ${response.statusText} from ${url}`
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(
      `Unexpected content type: ${response.headers.get("content-type")} from ${url}`
    );
  }

  return (await response.json()) as MeterValuesResponse;
}

export function parseMeterValues(values: MeterValuesResponse): HourUsage[] {
  return values.years.flatMap((year) =>
    year.months.flatMap((month) =>
      month.days.flatMap((day) =>
        day.hours
          .filter((it) => it.consumption != null)
          .flatMap<HourUsage>((hour) => ({
            date: Temporal.PlainDate.from({
              year: Number(hour.id.slice(0, 4)),
              month: Number(hour.id.slice(4, 6)),
              day: Number(hour.id.slice(6, 8)),
            }),
            hour: Number(hour.id.slice(8, 10)),
            usage: hour.consumption!.value,
            verified: hour.consumption!.isVerified,
          }))
      )
    )
  );
}
