import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { reportFixture } from "../fixtures/hospital-report";

// Exercise the real browser renderer with synthetic data, without requiring a
// staff account or database. Use the bundler already provided by tsx.
const require = createRequire(join(process.cwd(), "package.json"));
const { buildSync } = require(require.resolve("esbuild", { paths: [dirname(require.resolve("tsx"))] }));
const bundle: string = buildSync({ entryPoints: ["src/components/dashboard/report-pdf.ts"], bundle: true, write: false, format: "iife", globalName: "ReportPdf", platform: "browser" }).outputFiles[0].text;

for (const locale of ["en", "hi", "mr"] as const) {
  test(`downloads a valid five-page ${locale} PDF with large synthetic data`, async ({ page }, testInfo) => {
    const messages = JSON.parse(await readFile(`messages/${locale}.json`, "utf8")).report;
    await page.setContent('<html><body style="font-family: sans-serif"><button>Download report</button></body></html>');
    await page.addScriptTag({ content: bundle });
    await page.evaluate(({ data, messages, locale }) => {
      const renderer = (window as unknown as { ReportPdf: typeof import("../../src/components/dashboard/report-pdf") }).ReportPdf;
      const translate = (key: string, values: Record<string, string | number> = {}) => {
        let text: string = messages[key];
        for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value));
        return text;
      };
      const original = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (...args) {
        const result = original.apply(this, args);
        if (!document.querySelector("img")) {
          const preview = document.createElement("img"); preview.src = result; preview.style.width = "794px";
          document.body.append(preview);
        }
        return result;
      };
      document.querySelector("button")!.onclick = () => {
        void renderer.downloadHospitalPdf(data, translate, locale).catch((error: Error) => {
          document.body.dataset.error = error.message;
        });
      };
    }, { data: {
      ...reportFixture, hospitalName: "आरोग्य Hospital",
      categories: Array.from({ length: 50 }, (_, i) => ({ ...reportFixture.categories[0]!, label: `Service ${i + 1}` })),
      branches: Array.from({ length: 50 }, (_, i) => ({ ...reportFixture.branches[0]!, name: `Branch ${i + 1}` })),
      trend: Array.from({ length: 30 }, () => reportFixture.trend[0]!),
    }, messages, locale });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download report" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("hospital-experience-report-2026-01-01-2026-03-31.pdf");
    const path = await download.path();
    const bytes = await readFile(path!);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(5);
    await expect(page.locator("body")).not.toHaveAttribute("data-error");
    if (locale === "en") await page.locator("img").screenshot({ path: testInfo.outputPath("report-preview.png") });
  });
}

test("generates an empty report without fabricated scores", async ({ page }) => {
  const messages = JSON.parse(await readFile("messages/en.json", "utf8")).report;
  await page.setContent('<html><body style="font-family: sans-serif"></body></html>');
  await page.addScriptTag({ content: bundle });
  const size = await page.evaluate(async ({ data, messages }) => {
    const renderer = (window as unknown as { ReportPdf: typeof import("../../src/components/dashboard/report-pdf") }).ReportPdf;
    const blob = await renderer.createHospitalPdf(data, (key, values = {}) => {
      let text: string = messages[key];
      for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value));
      return text;
    }, "en");
    return blob.size;
  }, { data: { ...reportFixture, averageIndex: null, completedCount: 0, totalCount: 0, incompleteCount: 0, categories: [], branches: [], trend: [], distribution: [], visitTypes: [] }, messages });
  expect(size).toBeGreaterThan(1000);
});
