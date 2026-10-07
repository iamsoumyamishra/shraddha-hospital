"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface ContactValues {
  displayName: string | null;
  phone: string | null;
  email: string | null;
}

/**
 * Contact details are not part of the server-rendered payload.
 *
 * The page only knows whether consent was given. The values arrive from an
 * authorised, audited POST once a staff member with the right role requests
 * them, so they are never in the initial HTML, a view-source, or a client
 * bundle for anyone who does not open them.
 */
export function RevealContact({
  submissionId,
  canReveal,
}: {
  submissionId: string;
  canReveal: boolean;
}) {
  const t = useTranslations("responses");
  const [contact, setContact] = useState<ContactValues | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (contact) {
    return (
      <dl className="grid gap-1 text-sm">
        {contact.displayName ? (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("name")}:</dt>
            <dd>{contact.displayName}</dd>
          </div>
        ) : null}
        {contact.phone ? (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("phone")}:</dt>
            <dd>
              <a href={`tel:${contact.phone}`} className="underline underline-offset-4">
                {contact.phone}
              </a>
            </dd>
          </div>
        ) : null}
        {contact.email ? (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("email")}:</dt>
            <dd>
              <a href={`mailto:${contact.email}`} className="underline underline-offset-4">
                {contact.email}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    );
  }

  if (!canReveal) {
    return <p className="text-sm text-muted-foreground">{t("contactNotGiven")}</p>;
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const response = await fetch(`/api/staff/responses/${submissionId}/contact`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!response.ok) {
              setError(t("revealFailed"));
              return;
            }
            const payload = (await response.json()) as ContactValues;
            setContact(payload);
          })
        }
      >
        {t("revealContact")}
      </Button>
    </div>
  );
}