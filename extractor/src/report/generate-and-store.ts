import * as fs from "fs/promises";
import { MONTHLY_DETAILS_FILE, REPORT_FILE } from "../config.ts";
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

  if (MONTHLY_DETAILS_FILE) {
    await withSpan("write-monthly-details", async (span) => {
      const payload = {
        stroemMeterNames: result.stroemMeterNames,
        monthly: result.table.monthly,
      };
      const content = JSON.stringify(
        payload,
        (_key, val) =>
          typeof val === "number" && Number.isFinite(val)
            ? Math.round(val * 10000) / 10000
            : val,
        "  ",
      );
      span.setAttribute("bytes", Buffer.byteLength(content));
      await fs.writeFile(MONTHLY_DETAILS_FILE, content);
    });
  }
}
