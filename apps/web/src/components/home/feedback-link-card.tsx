"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FeedbackLinkCard({ href }: { href: string }) {
  const t = useTranslations("employeeHome.feedback");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).href);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <section aria-labelledby="feedback-link-title" className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-muted text-primary"><Link2 className="size-5" /></span>
          <div className="min-w-0 space-y-2">
            <p className="section-eyebrow">{t("eyebrow")}</p>
            <h2 id="feedback-link-title" className="text-lg font-semibold tracking-tight">{t("title")}</h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{t("body")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:shrink-0">
          <Button variant="outline" onClick={() => void copyLink()} className="flex-1 sm:flex-none">
            {copyStatus === "copied" ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
            {t(copyStatus === "copied" ? "copied" : "copy")}
          </Button>
          <Button asChild variant="secondary" className="flex-1 sm:flex-none">
            <a href={href} target="_blank" rel="noopener noreferrer">{t("open")}<ExternalLink aria-hidden className="size-4" /><span className="sr-only">{t("newTab")}</span></a>
          </Button>
        </div>
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <a href={href} target="_blank" rel="noopener noreferrer" className="block w-fit max-w-full rounded-sm font-mono text-xs break-all text-primary underline-offset-4 hover:underline">
          {href}<span className="sr-only">{t("newTab")}</span>
        </a>
        <p role="status" className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t(copyStatus === "copied" ? "success" : copyStatus === "error" ? "error" : "hint")}
        </p>
      </div>
    </section>
  );
}
