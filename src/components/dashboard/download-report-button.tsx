"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HospitalReportData } from "./report-document";

export function DownloadReportButton({ data }: { data: HospitalReportData }) {
  const t = useTranslations("report");
  const locale = useLocale();
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function download() {
    if (active.current) return;
    active.current = true; setPending(true); setError(false);
    try {
      const { downloadHospitalPdf } = await import("./report-pdf");
      await downloadHospitalPdf(data, (key, values) => t(key, values), locale);
    } catch {
      setError(true);
    } finally {
      active.current = false; setPending(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button size="sm" disabled={pending} aria-busy={pending} onClick={() => void download()}>
        {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}
        {pending ? t("preparing") : t("download")}
      </Button>
      <span role="status" className="sr-only">{pending ? t("preparing") : ""}</span>
      {error ? <p role="alert" className="max-w-64 text-xs text-destructive">{t("error")}</p> : null}
    </div>
  );
}
