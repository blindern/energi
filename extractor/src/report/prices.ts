import { Temporal } from "@js-temporal/polyfill";
import * as R from "ramda";
import { Data } from "../service/data-store.js";
import { roundTwoDec, zeroForNaN } from "./helpers.js";
import {
  dateHourIndexer,
  IndexedData,
  yearMonthIndexer,
} from "./indexed-data.js";

interface PriceConfigItem {
  mva: 0 | 0.25;
}

export const pricesConfig = {
  variableByKwh: {
    "Administrativt påslag": { mva: 0.25 },
    Forbruksavgift: { mva: 0.25 },
    Kraft: { mva: 0.25 },
    Nettleie: { mva: 0.25 },
    "Nettleie: Elavgift": { mva: 0.25 },
    "Nettleie: Energiledd": { mva: 0.25 },
    "Nettleie: Forbruksavgift": { mva: 0.25 },
    Rabatt: { mva: 0.25 },
    "Strøm: Finansielt resultat": { mva: 0 },
    "Strøm: Kraft": { mva: 0.25 },
    "Strøm: Påslag": { mva: 0.25 },
    Strømstøtte: { mva: 0 },
    "Unsupported price model": { mva: 0 },
  },
  static: {
    Fastledd: { mva: 0.25 },
    "Nettleie: Aktiv effekt": { mva: 0.25 },
    "Nettleie: Effektledd": { mva: 0.25 },
    "Nettleie: Energifondet fastavgift": { mva: 0.25 },
    "Nettleie: Fastledd lavspent Næring": { mva: 0.25 },
    "Nettleie: Fastledd": { mva: 0.25 },
    "Strøm: Fastbeløp": { mva: 0.25 },
    "Unsupported price model": { mva: 0 },
  },
} satisfies Record<string, Record<string, PriceConfigItem>>;

export interface UsagePrice {
  usageKwh: number;
  variableByKwh: Partial<
    Record<keyof typeof pricesConfig.variableByKwh, number>
  >;
  static: Partial<Record<keyof typeof pricesConfig.static, number>>;
}

// Fra og med april 2024 er denne fast 50 kr måned og ikke 600 i året delt på antall dager,
// så det er bittelitt avrundingsfeil forbundet med det.
export const stroemFastbeloepAar = 600 * 1.25;
export const stroemPaaslagPerKwh = 0.02 * 1.25;
export const fjernvarmeFastleddAar = 3000 * 1.25;

// https://www.elvia.no/nettleie/alt-om-nettleiepriser/nettleiepriser-og-effekttariff-for-bedrifter-med-arsforbruk-over-100000-kwh/
const nettFastleddMaanedByMonth: Record<string, number | undefined> = {
  "2022-01": 340 * 1.25, // From invoice.
  "2022-02": 340 * 1.25, // From invoice.
  "2022-03": 340 * 1.25, // From invoice.
  "2022-04": 340 * 1.25, // From invoice.
  "2022-05": 340 * 1.25, // From invoice.
  "2022-06": 340 * 1.25, // From invoice.
  "2022-07": 340 * 1.25, // From invoice.
  "2022-08": 340 * 1.25, // From invoice.
  "2022-09": 340 * 1.25, // From invoice.
  "2022-10": 340 * 1.25, // From invoice.
  "2022-11": 340 * 1.25, // From invoice.
  "2022-12": 340 * 1.25, // From invoice.
  "2023-01": 340 * 1.25, // From invoice.
  "2023-02": 500 * 1.25, // From invoice.
  "2023-03": 500 * 1.25, // From invoice.
  // Fra april så er "Energifondet fastavgift" / "Enova påslag" egen linje.
  "2023-04": 433.33 * 1.25, // From invoice.
  "2023-05": 433.33 * 1.25, // From invoice.
  "2023-06": 433.33 * 1.25, // From invoice.
  "2023-07": 433.33 * 1.25, // From invoice.
  "2023-08": 433.33 * 1.25, // From invoice.
  "2023-09": 433.33 * 1.25, // From invoice.
  "2023-10": 433.33 * 1.25, // From invoice.
  "2023-11": 433.33 * 1.25, // From invoice.
  "2023-12": 433.33 * 1.25, // From invoice.
  "2024-01": 433.33 * 1.25, // From invoice.
  "2024-02": 433.33 * 1.25, // From invoice.
  "2024-03": 433.33 * 1.25, // From invoice.
  "2024-04": 433.33 * 1.25, // From invoice.
  "2024-05": 433.33 * 1.25, // From invoice.
  "2024-06": 433.33 * 1.25, // From invoice.
  "2024-07": 433.33 * 1.25, // From invoice.
  "2024-08": 433.33 * 1.25, // From invoice.
  "2024-09": 433.33 * 1.25, // From invoice.
  "2024-10": 433.33 * 1.25, // From invoice.
  "2024-11": 433.33 * 1.25, // Assumption.
  "2024-12": 433.33 * 1.25, // Assumption.
  "2025-01": 433.33 * 1.25, // Assumption.
  "2025-02": 433.33 * 1.25, // Assumption.
  "2025-03": 433.33 * 1.25, // Assumption.
  "2025-04": 433.33 * 1.25, // Assumption.
  "2025-05": 433.33 * 1.25, // Assumption.
  "2025-06": 433.33 * 1.25, // Assumption.
  "2025-07": 433.33 * 1.25, // Assumption.
  "2025-08": 433.33 * 1.25, // Assumption.
  "2025-09": 433.33 * 1.25, // Assumption.
  "2025-10": 433.33 * 1.25, // Assumption.
  "2025-11": 433.33 * 1.25, // Assumption.
  "2025-12": 433.33 * 1.25, // Assumption.
};

// https://www.celsio.no/fjernvarme-og-kjoling/
const fjernvarmeAdministativtPaaslagPerKwh = 0.035 * 1.25;
const fjernvarmeNettleiePerKwhByMonth: Record<string, number | undefined> = {
  "2022-01": 0.2315 * 1.25,
  "2022-02": 0.2315 * 1.25,
  "2022-03": 0.2315 * 1.25,
  "2022-04": 0.2315 * 1.25,
  "2022-05": 0.2315 * 1.25,
  "2022-06": 0.2315 * 1.25,
  "2022-07": 0.2315 * 1.25,
  "2022-08": 0.2315 * 1.25,
  "2022-09": 0.2315 * 1.25,
  "2022-10": 0.2315 * 1.25,
  "2022-11": 0.2315 * 1.25,
  "2022-12": 0.2315 * 1.25,
  "2023-01": 0.2315 * 1.25,
  "2023-02": 0.2315 * 1.25,
  "2023-03": 0.2315 * 1.25,
  "2023-04": 0.2315 * 1.25,
  "2023-05": 0.2315 * 1.25,
  "2023-06": 0.2315 * 1.25,
  "2023-07": 0.2315 * 1.25,
  "2023-08": 0.2315 * 1.25,
  "2023-09": 0.2315 * 1.25,
  // https://celsio.no/fjernvarme/prisjustering-fra-1-oktober
  "2023-10": 0.2569 * 1.25,
  "2023-11": 0.2569 * 1.25,
  "2023-12": 0.2569 * 1.25,
  // Fant ikke info når endringen fra januar skjedde, men regnet
  // meg frem til at det skjedde da.
  "2024-01": 0.2609 * 1.25,
  "2024-02": 0.2609 * 1.25,
  "2024-03": 0.2609 * 1.25,
  "2024-04": 0.2609 * 1.25,
  "2024-05": 0.2609 * 1.25,
  "2024-06": 0.2609 * 1.25,
  "2024-07": 0.2609 * 1.25,
  "2024-08": 0.2609 * 1.25,
  "2024-09": 0.2609 * 1.25,
  "2024-10": 0.2609 * 1.25,
  "2024-11": 0.2609 * 1.25,
  "2024-12": 0.2609 * 1.25,
  // https://www.hafslund.no/no/produkter-og-tjenester/fjernvarme/priser-fjernvarme/prismodell-for-fjernvarme-i-borettslag-og-sameier
  "2025-01": 0.269 * 1.25,
  "2025-02": 0.269 * 1.25,
  "2025-03": 0.269 * 1.25,
  "2025-04": 0.269 * 1.25,
  "2025-05": 0.269 * 1.25,
  "2025-06": 0.269 * 1.25,
  "2025-07": 0.269 * 1.25,
  "2025-08": 0.269 * 1.25,
  "2025-09": 0.269 * 1.25,
  "2025-10": 0.269 * 1.25,
  "2025-11": 0.269 * 1.25,
  "2025-12": 0.269 * 1.25,
};

export function fjernvarmeRabatt(
  month: Temporal.PlainYearMonth,
  spotpriceMonth: number,
  priceSupport: number
) {
  const cutoff2022 = Temporal.PlainYearMonth.from("2022-11");
  const cutoff2023 = Temporal.PlainYearMonth.from("2023-11");
  const cutoff2024 = Temporal.PlainYearMonth.from("2024-01");
  const priceWithSupport = spotpriceMonth - priceSupport;

  if (Temporal.PlainYearMonth.compare(month, cutoff2022) < 0) {
    return -priceWithSupport * 0.05;
  } else if (Temporal.PlainYearMonth.compare(month, cutoff2023) < 0) {
    // 5 % for 0-90 øre (eks mva)
    // 30 % for 90-250 øre (eks mva)
    // 60 % fra 250 øre (eks mva)

    const threshold1 = 0.9 * 1.25;
    const threshold2 = 2.5 * 1.25;

    const step1 = -Math.min(threshold1, priceWithSupport) * 0.05;
    const step2 =
      -Math.max(0, Math.min(threshold2, priceWithSupport) - threshold1) * 0.3;
    const step3 = -Math.max(0, priceWithSupport - threshold2) * 0.6;

    return step1 + step2 + step3;
  } else if (Temporal.PlainYearMonth.compare(month, cutoff2024) < 0) {
    // Fra nettsiden:
    // 1. november 2022 innførte vi i tillegg en ny trinnvis rabattordning for at du skal ha større forutsigbarhet i en tid med svært varierende energipriser. Stiger prisen, stiger også rabattsatsen.
    // Rabattsatsene gjelder etter at fjernvarmestøtten er trukket fra. Ordningen varer ut 2023.
    // Per 2024-05-31 står det at det fortsatt er rabatt på 5 % >50 øre.

    // https://celsio.no/fjernvarme/prisjustering-fra-1-oktober
    // 0 % for 0-50 øre (eks mva)
    // 5 % for 50-90 øre (eks mva)
    // 30 % for 90-250 øre (eks mva)
    // 60 % fra 250 øre (eks mva)

    const threshold0 = 0.5 * 1.25;
    const threshold1 = 0.9 * 1.25;
    const threshold2 = 2.5 * 1.25;

    const step1 =
      -Math.max(0, Math.min(threshold1, priceWithSupport) - threshold0) * 0.05;
    const step2 =
      -Math.max(0, Math.min(threshold2, priceWithSupport) - threshold1) * 0.3;
    const step3 = -Math.max(0, priceWithSupport - threshold2) * 0.6;

    return step1 + step2 + step3;
  } else {
    // 2024-05-31: https://celsio.no/fjernvarme/rabatt-pa-fjernvarme
    // 0 % for 0-50 øre (eks mva)
    // 5 % for 50- øre (eks mva)

    const threshold = 0.5 * 1.25;
    const step = -Math.max(0, priceWithSupport - threshold) * 0.05;

    return step;
  }
}

// øre/kWh lest fra faktura.
// Har ikke klart å regne meg frem til modellen bak dette tallet.
// Ofte er dette rundt 10 % ekstra utover spotprisen.
// Vi får ikke helt samme tall til slutt fordi vi beregner time-for-time,
// men dette gir i det minste et mye nærmere tall.
export const stroemKraftMonthlyAverage: Record<string, number | undefined> = {
  "2022-01": 1.4787 * 1.25,
  "2022-02": 1.267 * 1.25,
  "2022-03": 1.9414 * 1.25,
  "2022-04": 1.8068 * 1.25,
  "2022-05": 1.7191 * 1.25,
  "2022-06": 1.5684 * 1.25,
  "2022-07": 1.7358 * 1.25,
  "2022-08": 3.5868 * 1.25,
  "2022-09": 3.7164 * 1.25,
  "2022-10": 1.4163 * 1.25,
  "2022-11": 1.2457 * 1.25,
  "2022-12": 2.9962 * 1.25,
  "2023-01": 1.3578 * 1.25,
  "2023-02": 1.2154 * 1.25,
  "2023-03": 1.1863 * 1.25,
  "2023-04": 1.1614 * 1.25,
  "2023-05": 0.8342 * 1.25,
  "2023-06": 0.7781 * 1.25,
  "2023-07": 0.4098 * 1.25,
  "2023-08": 0.2467 * 1.25,
  "2023-09": 0.0538 * 1.25,
  "2023-10": 0.5151 * 1.25,
  "2023-11": 1.1387 * 1.25,
  "2023-12": 1.0759 * 1.25,
  "2024-01": 1.0017 * 1.25,
  "2024-02": 0.7345 * 1.25,
  "2024-03": 0.7384 * 1.25,
  "2024-04": 0.6582 * 1.25,
  "2024-05": 0.4177 * 1.25,
  "2024-06": 0.4356 * 1.25,
  "2024-07": 0.3285 * 1.25,
  "2024-08": 0.166 * 1.25,
  "2024-09": 0.2692 * 1.25,
  "2024-10": 0.458 * 1.25,
};

export const stroemKraftMonthlyDefaultFactor = 1.1;

// Uten MVA.
export const finansieltResultatPerKwhActualByMonth: Record<
  string,
  number | undefined
> = {
  "2022-01": -0.2187, // From invoice.
  "2022-02": -0.1847, // From invoice.
  "2022-03": -0.5855, // From invoice.
  "2022-04": -0.3521, // From invoice.
  "2022-05": -0.3289, // From invoice.
  "2022-06": -0.2549, // From invoice.
  "2022-07": -0.2177, // From invoice.
  "2022-08": -0.7912, // From invoice.
  "2022-09": -0.6712, // From invoice.
  "2022-10": 0.3261, // From invoice.
  "2022-11": 0.436, // From invoice.
  "2022-12": -0.4264, // From invoice.
  "2023-01": 0.7715, // From invoice.
  "2023-02": 0.9217, // From invoice.
  "2023-03": 0.9546, // From invoice.
  "2023-04": 0.0577, // From invoice.
  "2023-05": 0.2458, // From invoice.
  "2023-06": 0.2832, // From invoice.
  "2023-07": 0.3658, // From invoice.
  "2023-08": 0.383, // From invoice.
  "2023-09": 0.4694, // From invoice.
  "2023-10": 0.5772, // From invoice.
  "2023-11": 0.04, // From invoice.
  "2023-12": 0.0682, // From invoice.
  "2024-01": 0.0715, // From invoice.
  "2024-02": 0.2209, // From invoice.
  "2024-03": 0.1848, // From invoice.
  "2024-04": -0.0316, // From invoice.
  "2024-05": 0.0869, // From invoice.
  "2024-06": 0.0755, // From invoice.
  "2024-07": 0.1129, // From invoice.
  "2024-08": 0.1691, // From invoice.
  "2024-09": 0.1281, // From invoice.
  "2024-10": 0.2856, // From invoice.
};

// https://www.elvia.no/nettleie/alt-om-nettleiepriser/nettleiepriser-og-effekttariff-for-bedrifter-med-arsforbruk-over-100000-kwh/
export const energileddPerKwhByMonth: Record<string, number | undefined> = {
  "2022-01": 0.07 * 1.25,
  "2022-02": 0.07 * 1.25,
  "2022-03": 0.07 * 1.25,
  "2022-04": 0.039 * 1.25,
  "2022-05": 0.06 * 1.25,
  "2022-06": 0.06 * 1.25,
  "2022-07": 0.06 * 1.25,
  "2022-08": 0.06 * 1.25,
  "2022-09": 0.06 * 1.25,
  "2022-10": 0.06 * 1.25,
  "2022-11": 0.085 * 1.25,
  "2022-12": 0.085 * 1.25,
  "2023-01": 0.085 * 1.25,
  "2023-02": 0.05 * 1.25,
  "2023-03": 0.05 * 1.25,
  "2023-04": 0.05 * 1.25,
  "2023-05": 0.05 * 1.25,
  "2023-06": 0.05 * 1.25,
  "2023-07": 0.05 * 1.25,
  "2023-08": 0.05 * 1.25,
  "2023-09": 0.05 * 1.25,
  "2023-10": 0.05 * 1.25,
  "2023-11": 0.05 * 1.25,
  "2023-12": 0.05 * 1.25,
  "2024-01": 0.05 * 1.25,
  "2024-02": 0.05 * 1.25,
  "2024-03": 0.05 * 1.25,
  "2024-04": 0.05 * 1.25,
  "2024-05": 0.05 * 1.25,
  "2024-06": 0.05 * 1.25,
  "2024-07": 0.05 * 1.25,
  "2024-08": 0.05 * 1.25,
  "2024-09": 0.05 * 1.25,
  "2024-10": 0.05 * 1.25,
  "2024-11": 0.05 * 1.25, // Asssumption.
  "2024-12": 0.05 * 1.25, // Asssumption.
  "2025-01": 0.05 * 1.25, // Asssumption.
  "2025-02": 0.05 * 1.25, // Asssumption.
  "2025-03": 0.05 * 1.25, // Asssumption.
  "2025-04": 0.05 * 1.25, // Asssumption.
  "2025-05": 0.05 * 1.25, // Asssumption.
  "2025-06": 0.05 * 1.25, // Asssumption.
  "2025-07": 0.05 * 1.25, // Asssumption.
  "2025-08": 0.05 * 1.25, // Asssumption.
  "2025-09": 0.05 * 1.25, // Asssumption.
  "2025-10": 0.05 * 1.25, // Asssumption.
  "2025-11": 0.05 * 1.25, // Asssumption.
  "2025-12": 0.05 * 1.25, // Asssumption.
};

// https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/saravgifter/om/elektrisk-kraft/
export const forbruksavgiftPerKwhByMonth: Record<string, number | undefined> = {
  "2022-01": 0.0891 * 1.25,
  "2022-02": 0.0891 * 1.25,
  "2022-03": 0.0891 * 1.25,
  "2022-04": 0.1541 * 1.25,
  "2022-05": 0.1541 * 1.25,
  "2022-06": 0.1541 * 1.25,
  "2022-07": 0.1541 * 1.25,
  "2022-08": 0.1541 * 1.25,
  "2022-09": 0.1541 * 1.25,
  "2022-10": 0.1541 * 1.25,
  "2022-11": 0.1541 * 1.25,
  "2022-12": 0.1541 * 1.25,
  // https://www.regjeringen.no/no/aktuelt/lavere-elavgift-de-forste-tre-manedene-i-2023/id2951105/
  "2023-01": 0.0916 * 1.25,
  "2023-02": 0.0916 * 1.25,
  "2023-03": 0.0916 * 1.25,
  "2023-04": 0.1584 * 1.25,
  "2023-05": 0.1584 * 1.25,
  "2023-06": 0.1584 * 1.25,
  "2023-07": 0.1584 * 1.25,
  "2023-08": 0.1584 * 1.25,
  "2023-09": 0.1584 * 1.25,
  "2023-10": 0.1584 * 1.25,
  "2023-11": 0.1584 * 1.25,
  "2023-12": 0.1584 * 1.25,
  // https://www.regjeringen.no/no/tema/okonomi-og-budsjett/skatter-og-avgifter/avgiftssatser-2024/id2997383/
  "2024-01": 0.0951 * 1.25,
  "2024-02": 0.0951 * 1.25,
  "2024-03": 0.0951 * 1.25,
  "2024-04": 0.1644 * 1.25,
  "2024-05": 0.1644 * 1.25,
  "2024-06": 0.1644 * 1.25,
  "2024-07": 0.1644 * 1.25,
  "2024-08": 0.1644 * 1.25,
  "2024-09": 0.1644 * 1.25,
  "2024-10": 0.1644 * 1.25,
  "2024-11": 0.1644 * 1.25, // Assumption.
  "2024-12": 0.1644 * 1.25, // Assumption.
  // https://www.regjeringen.no/no/tema/okonomi-og-budsjett/skatter-og-avgifter/avgiftssatser-2025/id3057881/
  // "Avgift på elektrisk kraft"
  // https://www.hafslund.no/no/produkter-og-tjenester/fjernvarme/priser-fjernvarme/prismodell-for-fjernvarme-i-borettslag-og-sameier
  "2025-01": 0.0979 * 1.25, // Assumption.
  "2025-02": 0.0979 * 1.25, // Assumption.
  "2025-03": 0.0979 * 1.25, // Assumption.
  "2025-04": 0.1693 * 1.25, // Assumption.
  "2025-05": 0.1693 * 1.25, // Assumption.
  "2025-06": 0.1693 * 1.25, // Assumption.
  "2025-07": 0.1693 * 1.25, // Assumption.
  "2025-08": 0.1693 * 1.25, // Assumption.
  "2025-09": 0.1693 * 1.25, // Assumption.
  "2025-10": 0.1693 * 1.25, // Assumption.
  "2025-11": 0.1693 * 1.25, // Assumption.
  "2025-12": 0.1693 * 1.25, // Assumption.
};

// https://www.elvia.no/nettleie/alt-om-nettleiepriser/nettleiepriser-og-effekttariff-for-bedrifter-med-arsforbruk-over-100000-kwh/
export const effektleddPerKwhByMonth: Record<string, number | undefined> = {
  "2022-01": 122 * 84 * 1.25, // From invoice.
  "2022-02": 141.6 * 84 * 1.25, // From invoice.
  "2022-03": 120.2 * 84 * 1.25, // From invoice.
  "2022-04": 106.8 * 35 * 1.25, // From invoice.
  "2022-05": 104.2 * 40 * 1.25, // From invoice.
  "2022-06": 102.4 * 40 * 1.25, // From invoice.
  "2022-07": 96.2 * 40 * 1.25, // From invoice.
  "2022-08": 112.8 * 40 * 1.25, // From invoice.
  "2022-09": 105.6 * 40 * 1.25, // From invoice.
  "2022-10": 117.6 * 40 * 1.25, // From invoice.
  "2022-11": 110.6 * 90 * 1.25, // From invoice.
  "2022-12": 113 * 90 * 1.25, // From invoice.
  "2023-01": 118.4 * 90 * 1.25, // From invoice.
  "2023-02": 126.6 * 75 * 1.25, // From invoice.
  "2023-03": 116.2 * 75 * 1.25, // From invoice.
  "2023-04": 108.4 * 32 * 1.25, // From invoice.
  "2023-05": 102.4 * 32 * 1.25, // From invoice.
  "2023-06": 94.2 * 32 * 1.25, // From invoice.
  "2023-07": 57.4 * 32 * 1.25, // From invoice.
  // Står nå som bare "Effekt" på faktura.
  "2023-08": 95.4 * 32 * 1.25, // From invoice.
  "2023-09": 107.6 * 32 * 1.25, // From invoice.
  // Prisjustering fra 1. oktober.
  "2023-10": 107.8 * 86 * 1.25, // From invoice.
  "2023-11": 114.4 * 86 * 1.25, // From invoice.
  "2023-12": 121 * 86 * 1.25, // From invoice.
  "2024-01": 118.2 * 86 * 1.25, // From invoice.
  "2024-02": 112.2 * 86 * 1.25, // From invoice.
  "2024-03": 104.4 * 86 * 1.25, // From invoice.
  "2024-04": 115.2 * 36 * 1.25, // From invoice.
  "2024-05": 106 * 36 * 1.25, // From invoice.
  "2024-06": 95.2 * 36 * 1.25, // From invoice.
  "2024-07": 71.2 * 36 * 1.25, // From invoice.
  "2024-08": 97.2 * 36 * 1.25, // From invoice.
  "2024-09": 98.4 * 36 * 1.25, // From invoice.
  // Prisjustering fra 1. oktober.
  "2024-10": 106.2 * 104 * 1.25, // From invoice.
  "2024-11": 120 * 104 * 1.25, // Guess.
  "2024-12": 120 * 104 * 1.25, // Guess.
  // https://assets.ctfassets.net/jbub5thfds15/3ZXkhgLNRYaCtyZoH4q6xz/5ea4057a4edc76bdd18171c76fa289b0/Tariffblad_3_0_Stor_n_ring_effekt_lavspent_20250101.pdf
  "2025-01": 118.2 * 92 * 1.25, // Guess.
  "2025-02": 112.2 * 92 * 1.25, // Guess.
  "2025-03": 104.4 * 92 * 1.25, // Guess.
  "2025-04": 115.2 * 38 * 1.25, // Guess.
  "2025-05": 106 * 38 * 1.25, // Guess.
  "2025-06": 95.2 * 38 * 1.25, // Guess.
  "2025-07": 71.2 * 38 * 1.25, // Guess.
  "2025-08": 97.2 * 38 * 1.25, // Guess.
  "2025-09": 98.4 * 38 * 1.25, // Guess.
  // Antatt prisjustering fra 1. oktober.
  "2025-10": 106.2 * 98 * 1.25, // Guess.
  "2025-11": 115 * 98 * 1.25, // Guess.
  "2025-12": 120 * 98 * 1.25, // Guess.
};

// https://www.regjeringen.no/no/aktuelt/vil-forlenge-stromstotten-til-husholdninger-ut-2023/id2930621/
const priceSupportPercentByMonth: Record<string, number | undefined> = {
  "2022-01": 0.8,
  "2022-02": 0.8,
  "2022-03": 0.8,
  "2022-04": 0.8,
  "2022-05": 0.8,
  "2022-06": 0.8,
  "2022-07": 0.8,
  "2022-08": 0.8,
  "2022-09": 0.9,
  "2022-10": 0.9,
  "2022-11": 0.9,
  "2022-12": 0.9,
  "2023-01": 0.9,
  "2023-02": 0.9,
  "2023-03": 0.9,
  "2023-04": 0.8,
  "2023-05": 0.8,
  "2023-06": 0.8,
  // https://www.regjeringen.no/no/tema/energi/regjeringens-stromtiltak/id2900232/?expand=factbox2900261
  // Utvidet til 90 % fra og med juni 2023 og ut 2024.
  "2023-07": 0.9,
  "2023-08": 0.9,
  // Fra september beregnes denne per time.
  "2023-09": 0.9,
  "2023-10": 0.9,
  "2023-11": 0.9,
  "2023-12": 0.9,
  "2024-01": 0.9,
  "2024-02": 0.9,
  "2024-03": 0.9,
  "2024-04": 0.9,
  "2024-05": 0.9,
  "2024-06": 0.9,
  "2024-07": 0.9,
  "2024-08": 0.9,
  "2024-09": 0.9,
  "2024-10": 0.9,
  "2024-11": 0.9,
  "2024-12": 0.9,
  // https://www.regjeringen.no/no/tema/energi/regjeringens-stromtiltak/id2900232/?expand=factbox2900261
  "2025-01": 0.9,
  "2025-02": 0.9,
  "2025-03": 0.9,
  "2025-04": 0.9,
  "2025-05": 0.9,
  "2025-06": 0.9,
  "2025-07": 0.9,
  "2025-08": 0.9,
  "2025-09": 0.9,
  "2025-10": 0.9,
  "2025-11": 0.9,
  "2025-12": 0.9,
};

function getPriceSupportThreshold(yearMonth: string) {
  if (yearMonth < "2024") return 0.7;
  if (yearMonth < "2025") return 0.73;
  return 0.75;
}

function getFinansieltResultatPerKwh(yearMonth: string) {
  return finansieltResultatPerKwhActualByMonth[yearMonth] ?? 0;
}

function getPriceSupportOfMonthPerKwh(
  yearMonth: string,
  averageSpotPrice: number
): number {
  const percent = priceSupportPercentByMonth[yearMonth];
  if (percent == null) {
    return 0;
  }

  return Math.max(
    0,
    (averageSpotPrice - getPriceSupportThreshold(yearMonth) * 1.25) * percent
  );
}

function getPriceSupportOfHourPerKwh(
  yearMonth: string,
  spotpriceHourPerKwh: number
) {
  const percent = priceSupportPercentByMonth[yearMonth];
  if (percent == null) {
    return 0;
  }

  return Math.max(
    0,
    (spotpriceHourPerKwh - getPriceSupportThreshold(yearMonth) * 1.25) * percent
  );
}

function calculateStroemHourlyPricePre2023Apr(props: {
  data: Data;
  indexedData: IndexedData;
  date: string;
  hour: number;
  usageKwh: number;
}): UsagePrice {
  const plainDate = Temporal.PlainDate.from(props.date);
  const yearMonth = yearMonthIndexer(props);
  const dateHour = dateHourIndexer(props);

  const spotpriceHourPerKwh =
    props.indexedData.spotpriceByHour[dateHour] ?? NaN;

  return {
    usageKwh: props.usageKwh,
    variableByKwh: multiplyWithUsage(props.usageKwh, {
      "Strøm: Kraft":
        spotpriceHourPerKwh *
        (props.indexedData.stroemSpotpriceFactorByMonth[yearMonth] ??
          stroemKraftMonthlyDefaultFactor),
      "Strøm: Finansielt resultat": getFinansieltResultatPerKwh(yearMonth),
      "Strøm: Påslag": stroemPaaslagPerKwh,
      "Nettleie: Energiledd": energileddPerKwhByMonth[yearMonth] ?? NaN,
      "Nettleie: Forbruksavgift": forbruksavgiftPerKwhByMonth[yearMonth] ?? NaN,
      Strømstøtte: -getPriceSupportOfMonthPerKwh(
        yearMonth,
        props.indexedData.spotpriceByMonth[yearMonth] ?? 0
      ),
    }),
    static: {
      "Strøm: Fastbeløp": stroemFastbeloepAar / plainDate.daysInYear / 24,
      "Nettleie: Fastledd":
        (nettFastleddMaanedByMonth[yearMonth] ?? NaN) /
        plainDate.daysInMonth /
        24,
      "Nettleie: Effektledd":
        (effektleddPerKwhByMonth[yearMonth] ?? NaN) /
        plainDate.daysInMonth /
        24,
    },
  };
}

function calculateStroemHourlyPriceFrom2023Apr(props: {
  data: Data;
  indexedData: IndexedData;
  date: string;
  hour: number;
  usageKwh: number;
}): UsagePrice {
  const plainDate = Temporal.PlainDate.from(props.date);
  const yearMonth = yearMonthIndexer(props);
  const dateHour = dateHourIndexer(props);

  const spotpriceHourPerKwh =
    props.indexedData.spotpriceByHour[dateHour] ?? NaN;

  const hourlyPriceSupport = props.date >= "2023-09";

  return {
    usageKwh: props.usageKwh,
    variableByKwh: multiplyWithUsage(props.usageKwh, {
      "Strøm: Kraft":
        spotpriceHourPerKwh *
        (props.indexedData.stroemSpotpriceFactorByMonth[yearMonth] ??
          stroemKraftMonthlyDefaultFactor),
      "Strøm: Finansielt resultat": getFinansieltResultatPerKwh(yearMonth),
      "Strøm: Påslag": stroemPaaslagPerKwh,
      "Nettleie: Energiledd": energileddPerKwhByMonth[yearMonth] ?? NaN,
      "Nettleie: Elavgift": forbruksavgiftPerKwhByMonth[yearMonth] ?? NaN,
      Strømstøtte: hourlyPriceSupport
        ? -getPriceSupportOfHourPerKwh(yearMonth, spotpriceHourPerKwh)
        : -getPriceSupportOfMonthPerKwh(
            yearMonth,
            props.indexedData.spotpriceByMonth[yearMonth] ?? 0
          ),
    }),
    static: {
      "Strøm: Fastbeløp": stroemFastbeloepAar / plainDate.daysInYear / 24,
      "Nettleie: Energifondet fastavgift": (800 * 1.25) / 365 / 24,
      "Nettleie: Fastledd lavspent Næring":
        (nettFastleddMaanedByMonth[yearMonth] ?? NaN) /
        plainDate.daysInMonth /
        24,
      "Nettleie: Aktiv effekt":
        (effektleddPerKwhByMonth[yearMonth] ?? NaN) /
        plainDate.daysInMonth /
        24,
    },
  };
}

export function calculateStroemHourlyPrice(props: {
  data: Data;
  indexedData: IndexedData;
  date: string;
  hour: number;
  usageKwh: number;
}): UsagePrice {
  // Different price model before 2022 not implemented.
  if (Number(props.date.slice(0, 4)) < 2022) {
    return {
      usageKwh: props.usageKwh,
      variableByKwh: {
        "Unsupported price model": NaN,
      },
      static: {
        "Unsupported price model": NaN,
      },
    };
  }

  if (props.date >= "2023-04") {
    return calculateStroemHourlyPriceFrom2023Apr(props);
  }

  return calculateStroemHourlyPricePre2023Apr(props);
}

export function calculateFjernvarmeHourlyPrice(props: {
  data: Data;
  indexedData: IndexedData;
  date: string;
  hour: number;
  usageKwh: number;
}): UsagePrice | null {
  // Different price model before 2022 not implemented.
  if (Number(props.date.slice(0, 4)) < 2022) {
    return {
      usageKwh: props.usageKwh,
      variableByKwh: {
        "Unsupported price model": NaN,
      },
      static: {
        "Unsupported price model": NaN,
      },
    };
  }

  const plainDate = Temporal.PlainDate.from(props.date);
  const yearMonth = yearMonthIndexer(props);

  const priceSupport = getPriceSupportOfMonthPerKwh(
    yearMonth,
    props.indexedData.spotpriceByMonth[yearMonth] ?? 0
  );

  const spotpriceMonth = props.indexedData.spotpriceByMonth[yearMonth] ?? NaN;

  return {
    usageKwh: props.usageKwh,
    variableByKwh: multiplyWithUsage(props.usageKwh, {
      Kraft: spotpriceMonth,
      Rabatt: fjernvarmeRabatt(
        plainDate.toPlainYearMonth(),
        spotpriceMonth,
        priceSupport
      ),
      "Administrativt påslag": fjernvarmeAdministativtPaaslagPerKwh,
      Nettleie: fjernvarmeNettleiePerKwhByMonth[yearMonth] ?? NaN,
      Forbruksavgift: forbruksavgiftPerKwhByMonth[yearMonth] ?? NaN,
      Strømstøtte: -priceSupport,
    }),
    static: {
      Fastledd: fjernvarmeFastleddAar / plainDate.daysInYear / 24,
    },
  };
}

export function calculateHourlyPrice({
  data,
  indexedData,
  date,
  hour,
  stroem,
  fjernvarme,
}: {
  data: Data;
  indexedData: IndexedData;
  date: string;
  hour: number;
  stroem: number;
  fjernvarme: number;
}) {
  return (
    sumPrice(
      calculateStroemHourlyPrice({
        data,
        indexedData,
        date,
        hour,
        usageKwh: stroem,
      })
    ) +
    sumPrice(
      calculateFjernvarmeHourlyPrice({
        data,
        indexedData,
        date,
        hour,
        usageKwh: fjernvarme,
      })
    )
  );
}

function addPricesInner(
  one: Record<string, number>,
  two: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const key of new Set([...Object.keys(one), ...Object.keys(two)])) {
    result[key] = zeroForNaN(one[key]!) + zeroForNaN(two[key]!);
  }

  return result;
}

export function addPrices(one: UsagePrice, two: UsagePrice): UsagePrice {
  return {
    usageKwh: one.usageKwh + two.usageKwh,
    variableByKwh: addPricesInner(one.variableByKwh, two.variableByKwh),
    static: addPricesInner(one.static, two.static),
  };
}

export function sumPrice(usagePrice: UsagePrice | null): number {
  if (usagePrice == null) {
    return NaN;
  }
  return roundTwoDec(
    R.sum(Object.values(usagePrice.variableByKwh)) +
      R.sum(Object.values(usagePrice.static))
  );
}

export function flattenPrices(items: UsagePrice[]): UsagePrice {
  if (items.length === 0) {
    return {
      usageKwh: 0,
      variableByKwh: {},
      static: {},
    };
  }
  return items.reduce(addPrices);
}

export function multiplyWithUsage(
  usage: number,
  values: UsagePrice["variableByKwh"]
): UsagePrice["variableByKwh"] {
  return R.mapObjIndexed((it) => it * usage, values);
}
