"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Status and resolution are edited through an authenticated PATCH, so the change
 * goes through the same server-side role and scope checks as every other
 * mutation rather than trusting the select in the browser.
 */
export function CaseEditor({
  caseId,
  initialStatus,
  initialNote,
  canManage,
}: {
  caseId: string;
  initialStatus: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  initialNote: string | null;
  canManage: boolean;
}) {
  const t = useTranslations("cases");
  const router = useRouter();

  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState(initialNote ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        {initialStatus} {initialNote ? `— ${initialNote}` : ""}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`case-status-${caseId}`}>{t("status")}</Label>
        <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
          <SelectTrigger id={`case-status-${caseId}`} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">{t("statuses.OPEN")}</SelectItem>
            <SelectItem value="IN_PROGRESS">{t("statuses.IN_PROGRESS")}</SelectItem>
            <SelectItem value="RESOLVED">{t("statuses.RESOLVED")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`case-note-${caseId}`}>{t("resolution")}</Label>
        <Textarea
          id={`case-note-${caseId}`}
          rows={2}
          maxLength={4000}
          value={note}
          placeholder={t("resolutionPlaceholder")}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              const response = await fetch(`/api/staff/cases/${caseId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, resolutionNote: note }),
              });
              if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as {
                  error?: string;
                } | null;
                setMessage({ kind: "error", text: payload?.error ?? t("statuses.RESOLVED") });
                return;
              }
              setMessage({ kind: "ok", text: t("saved") });
              router.refresh();
            })
          }
        >
          {t("save")}
        </Button>
        {message ? (
          <p
            role="status"
            className={
              message.kind === "ok" ? "text-xs text-emerald-600" : "text-xs text-destructive"
            }
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}