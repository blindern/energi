import * as fs from "fs/promises";

export interface DataNordpoolPriceHour {
  date: string; // yyyy-mm-dd
  hour: number;
  price: number;
}

export interface DataTemperatureHour {
  date: string; // yyyy-mm-dd
  hour: number;
  temperature: number;
}

export interface DataTemperatureDay {
  date: string; // yyyy-mm-dd
  meanTemperature: number;
}

export type MeterName = string;

export interface DataPowerUsageHour {
  date: string; // yyyy-mm-dd
  hour: number;
  usage: number;
  verified?: boolean;
}

export interface Data {
  nordpool?: DataNordpoolPriceHour[];
  hourlyTemperature?: DataTemperatureHour[];
  dailyTemperature?: DataTemperatureDay[];
  powerUsage?: Record<MeterName, DataPowerUsageHour[]>;
}

export class DataStore {
  private dataFile: string;
  constructor(dataFile: string) {
    this.dataFile = dataFile;
  }

  async load(): Promise<Data> {
    try {
      await fs.stat(this.dataFile);
    } catch (e) {
      return {};
    }

    const content = (await fs.readFile(this.dataFile)).toString();
    return JSON.parse(content);
  }

  async save(data: Data): Promise<void> {
    const content = JSON.stringify(data, undefined, "  ");
    await fs.writeFile(this.dataFile, content);
  }
}
