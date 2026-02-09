import { Temporal } from "@js-temporal/polyfill";
import * as crypto from "crypto";
import { HourUsage } from "./common.js";

interface Consumption {
  value: number;
  isVerified: boolean;
  status: string; // e.g. OK
}

interface MeterValuesResponse {
  years: {
    months: {
      days: {
        hours: {
          id: string; // e.g. 2022010100
          production: any; // null?
          consumption?: Consumption;
          level: string; // e.g. Unknown
        }[];
        isWeekendOrHoliday: true;
        id: string; // e.g. 20220101
        production: any; // null?
        consumption: Consumption;
      }[];
      maxHourId: string; // e.g. 2022012613
      maxHours: {
        hours: {
          id: string; // e.g. 2022013113
          production: any; // null?
          consumption: Consumption;
        }[];
        average: number;
        consumptionUnitOfMeasure: string; // e.g. kWh
      };
      id: string; // e.g. 202201
      production: any; // null?
      consumption: Consumption;
    }[];
    daylightSavingTimeStart: string; // e.g. 2022103002
    daylightSavingTimeEnd: string; // e.g. 2022032702
    maxHourId: string; // e.g. 2022020310
    id: string; // e.g. 2022
    production: any; // null?
    consumption: Consumption;
  }[];
  customerId: string;
  contractId: string;
}

function cookiesHeader(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function parseSetCookie(values: string[]): Record<string, string> {
  return Object.fromEntries(
    values.flatMap((setCookie) => {
      const parts = setCookie.split(";").map((it) => it.trim());
      const namedParts = Object.fromEntries(
        parts.map((part) => part.split("=", 2))
      );

      if (
        namedParts.expires == null ||
        new Date(namedParts.expires).getTime() > new Date().getTime()
      ) {
        return [parts[0]!.split("=", 2)];
      } else {
        return [];
      }
    })
  );
}

function deriveCookies(response: Response, initial?: Record<string, string>) {
  const additionalCookies = parseSetCookie(
    response.headers.getSetCookie() ?? []
  );

  const updatedCookies = {
    ...(initial ?? {}),
    ...additionalCookies,
  };

  return updatedCookies;
}

function serializeQueryString(form: Record<string, string>): string {
  return Object.entries(form)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");
}

async function getInitialLoginState(): Promise<{
  cookies: Record<string, string>;
  csrfToken: string;
}> {
  const response = await fetch("https://elvid.elvia.io/Login", {
    method: "GET",
    redirect: "manual",
  });

  if (!response.ok) {
    throw new Error(`Unexpected response: ${response.status} ${response.statusText} from ${response.url}`);
  }

  const cookies = parseSetCookie(response.headers.getSetCookie() ?? []);
  const textContent = await response.text();

  const csrfTokenMatch = textContent.match(
    /name="__RequestVerificationToken" type="hidden" value="([^"]+)"/
  );
  if (!csrfTokenMatch) {
    throw new Error(`Failed to find csrf token in response from ${response.url}`);
  }

  return {
    cookies,
    csrfToken: csrfTokenMatch[1]!,
  };
}

async function getValidLoginState({
  initialCookies,
  csrfToken,
  email,
  password,
}: {
  initialCookies: Record<string, string>;
  csrfToken: string;
  email: string;
  password: string;
}): Promise<{
  cookies: Record<string, string>;
}> {
  const form = {
    ReturnUrl: "",
    Email: email,
    Password: password,
    button: "login",
    __RequestVerificationToken: csrfToken,
    RememberLogin: "false",
  };

  const response = await fetch("https://elvid.elvia.io/Login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookiesHeader(initialCookies),
    },
    body: serializeQueryString(form),
    redirect: "manual",
  });

  if (response.status !== 302) {
    throw new Error(`Expected 302 redirect, got ${response.status} from ${response.url}`);
  }

  return {
    cookies: deriveCookies(response, initialCookies),
  };
}

async function getAuthorizeCode({
  loggedInCookies: initialCookies,
}: {
  loggedInCookies: Record<string, string>;
}): Promise<{
  codeVerifier: string;
  code: string;
}> {
  const state = String(new Date().getTime());

  const codeVerifier = crypto.randomUUID() + crypto.randomUUID() + crypto.randomUUID();
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const queryParams = {
    client_id: "45df5938-75fa-4e76-abc8-9498cae9dfad",
    redirect_uri: "https://www.elvia.no/auth/signin",
    response_type: "code",
    scope:
      "openid profile email kunde.kundeportalapi elvid.delegation-token-create.useraccess",
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    response_mode: "query",
  };

  const response = await fetch(
    `https://elvid.elvia.io/connect/authorize/callback?${serializeQueryString(
      queryParams
    )}`,
    {
      method: "GET",
      headers: {
        cookie: cookiesHeader(initialCookies),
      },
      redirect: "manual",
    }
  );

  if (response.status !== 302) {
    throw new Error(`Expected 302 redirect, got ${response.status} from ${response.url}`);
  }

  const location = response.headers.get("location");
  if (location == null) {
    throw new Error("Missing location header from authorize callback");
  }

  const queryStringPos = location.indexOf("?");
  if (queryStringPos === -1) {
    throw new Error(`Missing query string in redirect location: ${location.slice(0, 200)}`);
  }

  const parts = Object.fromEntries(
    location
      .slice(queryStringPos + 1)
      .split("&")
      .map((part) => part.split("=", 2).map((it) => decodeURIComponent(it)))
  );

  return {
    code: parts["code"] as string,
    codeVerifier,
  };
}

async function getTokenFromCode({
  code,
  codeVerifier,
}: {
  code: string;
  codeVerifier: string;
}): Promise<{
  accessToken: string;
}> {
  const form = {
    grant_type: "authorization_code",
    redirect_uri: "https://www.elvia.no/auth/signin",
    code: code,
    code_verifier: codeVerifier,
    client_id: "45df5938-75fa-4e76-abc8-9498cae9dfad",
  };

  const response = await fetch("https://elvid.elvia.io/connect/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: serializeQueryString(form),
  });

  if (!response.ok) {
    throw new Error(`Unexpected response: ${response.status} ${response.statusText} from ${response.url}`);
  }

  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`Unexpected content type: ${response.headers.get("content-type")} from ${response.url}`);
  }

  const responseJson = (await response.json()) as any;
  const accessToken = responseJson.access_token as string;

  return {
    accessToken,
  };
}

export async function getAccessTokenFromCredentials({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<string> {
  const { cookies: initialCookies, csrfToken } = await getInitialLoginState();
  const { cookies: loggedInCookies } = await getValidLoginState({
    initialCookies,
    csrfToken,
    email,
    password,
  });
  const { code, codeVerifier } = await getAuthorizeCode({ loggedInCookies });
  const { accessToken } = await getTokenFromCode({ code, codeVerifier });
  return accessToken;
}

export async function getMeterValues({
  customerId,
  contractId,
  year,
  accessToken,
}: {
  customerId: string;
  contractId: string;
  year: number;
  accessToken: string;
}): Promise<MeterValuesResponse> {
  const queryParams = {
    year: String(year),
    includeUnverifiedValues: "true",
    includeEmptyValues: "true",
  };

  const url = `https://kunde.elvia.io/portal/customer/${encodeURIComponent(
    customerId
  )}/contract/${encodeURIComponent(
    contractId
  )}/metervalue?${serializeQueryString(queryParams)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unexpected response: ${response.status} ${response.statusText} from ${url}`);
  }

  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`Unexpected content type: ${response.headers.get("content-type")} from ${url}`);
  }

  const responseJson = (await response.json()) as MeterValuesResponse;

  return responseJson;
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
