import { DATA_FILE } from "../config.ts";
import { DataStore } from "../service/data-store.ts";
import { generateReportDataAndStore } from "./report.ts";

const dataStore = new DataStore(DATA_FILE);

const data = await dataStore.load();

generateReportDataAndStore(data);
