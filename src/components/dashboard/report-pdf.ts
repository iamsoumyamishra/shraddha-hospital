import { jsPDF } from "jspdf";
import { buildReportPages, reportFilename, type HospitalReportData, type ReportText } from "./report-document";

const WIDTH = 794;
const HEIGHT = 1123;
const MARGIN = 52;
const CONTENT = WIDTH - MARGIN * 2;
const TEAL = "#087f83";
const INK = "#153437";
const MUTED = "#566b70";

/** Browser text shaping preserves Indian hospital names and reviewed locales.
 * Pages are rendered at 2x resolution; no remote PDF or translation service runs.
 */
export async function createHospitalPdf(data: HospitalReportData, t: ReportText, locale: string): Promise<Blob> {
  const font = getComputedStyle(document.body).fontFamily;
  await document.fonts.load(`400 14px ${font}`, `${data.hospitalName} ${t("title")}`);
  await document.fonts.ready;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.setProperties({ title: t("title"), subject: "Aggregate patient experience report", creator: "Hospital Patient Experience Platform" });
  pdf.setLanguage(locale === "hi" ? "hi" : locale === "mr" ? "mr" : "en");
  const pages = buildReportPages(data, t, locale);
  const generated = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: data.timeZone }).format(new Date(data.computedAt));

  for (const [index, page] of pages.entries()) {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH * 2;
    canvas.height = HEIGHT * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textBaseline = "top";
    const setFont = (size: number, bold = false) => { ctx.font = `${bold ? 600 : 400} ${size}px ${font}`; };
    const fit = (text: string, width: number) => {
      if (ctx.measureText(text).width <= width) return text;
      // Remove whole graphemes, preserving Devanagari combining sequences.
      const chars = Array.from(new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(text), (part) => part.segment);
      while (chars.length && ctx.measureText(`${chars.join("")}…`).width > width) chars.pop();
      return `${chars.join("")}…`;
    };
    const text = (value: string, x: number, y: number, size = 12, color = INK, bold = false, width = CONTENT) => {
      setFont(size, bold); ctx.fillStyle = color; ctx.fillText(fit(value, width), x, y);
    };
    const paragraph = (value: string, y: number, size = 12, color = MUTED) => {
      setFont(size); ctx.fillStyle = color;
      const words = Array.from(new Intl.Segmenter(locale, { granularity: "word" }).segment(value), (part) => part.segment);
      let line = "";
      for (const word of words) {
        if (ctx.measureText(line + word).width > CONTENT && line) {
          ctx.fillText(line, MARGIN, y); y += size * 1.65; line = word.trimStart();
        } else line += word;
      }
      if (line) { ctx.fillText(line, MARGIN, y); y += size * 1.65; }
      return y + 12;
    };

    ctx.fillStyle = TEAL; ctx.fillRect(0, 0, WIDTH, 8);
    // Original H monogram, drawn as vector geometry on each report page.
    ctx.fillRect(MARGIN, 35, 8, 27); ctx.fillRect(MARGIN + 23, 35, 8, 27); ctx.fillRect(MARGIN + 8, 45, 15, 7);
    text(data.hospitalName, MARGIN + 44, 37, 18, INK, true, CONTENT - 44);
    text(t("title"), MARGIN, 83, 11, TEAL, true);
    text(page.title, MARGIN, 110, 27, INK, true);
    text(`${data.from} — ${data.to} · ${data.timeZone}`, MARGIN, 153, 11, MUTED);
    text(`${t("scope")}: ${data.scopeLabel} · ${t("visitType")}: ${data.visitType}`, MARGIN, 175, 11, MUTED);
    ctx.fillStyle = "#e0eaeb"; ctx.fillRect(MARGIN, 204, CONTENT, 1);
    let y = paragraph(page.description, 225);

    if (page.metrics) {
      const cardWidth = (CONTENT - 16) / 2;
      page.metrics.forEach((metric, i) => {
        const x = MARGIN + (i % 2) * (cardWidth + 16);
        const top = y + Math.floor(i / 2) * 108;
        ctx.fillStyle = "#eff8f7"; ctx.fillRect(x, top, cardWidth, 94);
        text(metric.label, x + 16, top + 15, 11, MUTED, false, cardWidth - 32);
        text(metric.value, x + 16, top + 40, 27, TEAL, true, cardWidth - 32);
      });
      y += 225;
    }
    for (const table of page.tables ?? []) {
      text(table.title, MARGIN, y, 15, INK, true); y += 30;
      const colWidths = table.columns.length === 4 ? [0.45, 0.23, 0.16, 0.16] : table.columns.length === 3 ? [0.5, 0.27, 0.23] : [0.73, 0.27];
      const drawRow = (row: string[], top: number, header = false) => {
        ctx.fillStyle = header ? TEAL : "#f3f7f7";
        ctx.fillRect(MARGIN, top, CONTENT, 27);
        let x = MARGIN;
        row.forEach((cell, i) => {
          const w = CONTENT * (colWidths[i] ?? 0);
          text(cell, x + 9, top + 7, 10.5, header ? "#ffffff" : INK, header, w - 18);
          x += w;
        });
      };
      drawRow(table.columns, y, true); y += 29;
      if (!table.rows.length) y = paragraph(t("noData"), y + 12);
      for (const row of table.rows) { drawRow(row, y); y += 29; }
      y += 10;
      if (table.note) y = paragraph(table.note, y, 10);
      y += 10;
    }
    for (const value of page.paragraphs ?? []) y = paragraph(value, y, 11);
    // Fail visibly rather than saving a clipped document if future copy expands.
    if (y > HEIGHT - 90) throw new Error("Report content exceeds page limit");
    ctx.fillStyle = "#e0eaeb"; ctx.fillRect(MARGIN, HEIGHT - 69, CONTENT, 1);
    text(t("generated", { time: generated }), MARGIN, HEIGHT - 51, 9, MUTED, false, CONTENT - 90);
    text(`${index + 1} / ${pages.length}`, WIDTH - MARGIN - 40, HEIGHT - 51, 9, MUTED);
    text(t("confidential"), MARGIN, HEIGHT - 34, 9, MUTED);
    if (index) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
    canvas.width = canvas.height = 0;
    // Give the UI an opportunity to paint while generating a large report.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return pdf.output("blob");
}

export async function downloadHospitalPdf(data: HospitalReportData, t: ReportText, locale: string) {
  const blob = await createHospitalPdf(data, t, locale);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = reportFilename(data.from, data.to);
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
