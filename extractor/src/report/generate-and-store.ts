import * as fs from "fs/promises";
import { REPORT_FILE } from "../config.ts";
import type { Data } from "../service/data-store.ts";
import { withSpan } from "../tracing.ts";
import { generateReportData } from "./report.ts";

export async function generateReportDataAndStore(data: Data) {
  const result = await generateReportData(data);

  await withSpan("write-report", async (span) => {
    const content = JSON.stringify(result, undefined, "  ");
    span.setAttribute("bytes", Buffer.byteLength(content));
    await fs.writeFile(REPORT_FILE, content);
  });
}
