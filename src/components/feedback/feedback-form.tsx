"use client";

import { BrandMark } from "@/components/branding/brand-mark";
import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "cn";
import { CheckCircle2, Loader2 } from "lucide-react";

import { useFeedbackDraft, type FeedbackDraft } from "./draft-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import type { Locale } from "@/i18n/catalog";

export interface FeedbackFormSurvey {
  id: string;
  locale: Locale;
  availableLocales: Locale[];
  visitTypeLabels: Record<string, string>;
  slug: string;
  title: string;
  description: string | null;
  visitTypes: string[];
  presentation: { services: Array<{ key: string; label: string }>; categoryLabels: Record<string, string> };
  categoryLabels: Record<string, string>;
  questions: Array<{
    id: string;
    key: string;
    categoryKey: string;
    sortOrder: number;
    prompt: string;
  }>;
  ratingScale: { min: 1; max: 5; labels: string[] };
}

/** 1 answered rating, or explicit not-applicable. null = unanswered. */
type AnswerState = number | "na" | null;

export function FeedbackForm({ survey }: { survey: FeedbackFormSurvey }) {
  const t = useTranslations("survey");
  const tBrand = useTranslations("brand");
  const tUi = useTranslations("ui");

  const { draft, setter } = useFeedbackDraft(survey.id, survey.visitTypes[0] ?? "outpatient");
  const { step, privacyAck, visitType, servicesUsed, answers, overallRating, comment, contactConsent, contact, error, submitting, acknowledgement, idempotencyKey } = draft;
  const setStep = setter("step");
  const setPrivacyAck = setter("privacyAck");
  const setVisitType = setter("visitType");
  const setServicesUsed = setter("servicesUsed");
  const setAnswers = setter("answers");
  const setOverallRating = setter("overallRating");
  const setComment = setter("comment");
  const setContactConsent = setter("contactConsent");
  const setContact = setter("contact");
  const setError = setter("error");
  const setSubmitting = setter("submitting");
  const setAcknowledgement = setter("acknowledgement");

  const grouped = useMemo(() => {
    const byCategory = new Map<string, typeof survey.questions>();
    for (const question of [...survey.questions].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const bucket = byCategory.get(question.categoryKey) ?? [];
      bucket.push(question);
      byCategory.set(question.categoryKey, bucket);
    }
    return [...byCategory.entries()].map(([categoryKey, questions]) => ({
      categoryKey,
      label: survey.categoryLabels[categoryKey] ?? categoryKey,
      questions,
    }));
  }, [survey]);

  const totalSteps = 5;
  const answeredCount = Object.values(answers).filter((value) => value !== null).length;

  const STEP_KEYS = ["privacy", "services", "questions", "review", "contact"] as const;

  // The error message is rendered once, above the step content. On the
  // questions step the content is far taller than any viewport, so someone who
  // has scrolled to the bottom to press the button would otherwise get no
  // feedback at all: the message would appear several screens above them.
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error === null) return;
    const node = errorRef.current;
    if (!node) return;
    // Move focus as well as scroll, so assistive technology announces the
    // reason the step did not advance instead of leaving focus on a button
    // that appears to have done nothing.
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    node.focus({ preventScroll: true });
  }, [error]);

  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (acknowledgement) confirmationRef.current?.focus();
  }, [acknowledgement]);

  if (acknowledgement) {
    return (
      <Card ref={confirmationRef} role="status" tabIndex={-1} className="outline-none">
        <CardHeader className="py-8">
          <CardTitle role="heading" aria-level={1} className="flex items-center gap-3 text-xl">
            <CheckCircle2 aria-hidden className="size-6 shrink-0 text-primary" />
            {t("confirmationTitle")}
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  function setAnswer(questionId: string, value: AnswerState) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setError(null);
  }

  function toggleService(key: string) {
    setServicesUsed((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
    setError(null);
  }

  function goNext() {
    if (step === 0 && !privacyAck) {
      setError("errors.privacyConsent");
      return;
    }
    if (step === 1 && servicesUsed.length === 0) {
      setError("errors.services");
      return;
    }
    if (step === 2 && answeredCount < survey.questions.length) {
      setError("errors.questions");
      return;
    }
    // Step 3 holds the standalone overall-experience rating. It was previously
    // validated nowhere, so a respondent could reach submit without choosing
    // one even though the server requires it.
    if (step === 3 && overallRating === null) {
      setError("errors.overallRating");
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, totalSteps - 1));
  }

  async function handleSubmit() {
    // This check belongs here, not in `goNext`: the contact step is the last one
    // and has no Next button, so validating it while advancing never ran.
    if (contactConsent && !contact.phone.trim() && !contact.email.trim()) {
      setError("errors.contactConsent");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveySlug: survey.slug,
          idempotencyKey,
          surveyVersionId: survey.id,
          locale: survey.locale,
          visitType,
          servicesUsed,
          respondentRole: "PATIENT",
          overallRating,
          comment: comment.trim() ? comment.trim() : null,
          followUpConsent: contactConsent
            ? {
                consentGiven: true,
                contact: {
                  displayName: contact.displayName.trim() || undefined,
                  phone: contact.phone.trim() || undefined,
                  email: contact.email.trim() || undefined,
                },
              }
            : null,
          answers: survey.questions.map((question) => ({
            questionId: question.id,
            rating: answers[question.id] === "na" ? null : (answers[question.id] ?? null),
          })),
        }),
      });

      const payload = await response.json();

      if (response.status === 429) {
        setError("errors.rateLimit");
        return;
      }
      if (!response.ok) {
        setError(response.status === 422 ? "errors.questions" : "errors.submit");
        return;
      }
      setAcknowledgement(payload as NonNullable<FeedbackDraft["acknowledgement"]>);
    } catch {
      setError("errors.submit");
    } finally {
      setSubmitting(false);
    }
  }

  const ratingValues = Array.from(
    { length: survey.ratingScale.max },
    (_, index) => index + 1,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
      <header className="patient-brand">
        <BrandMark />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-tight tracking-tight">
            {tBrand("name")}
          </p>
          <p className="truncate text-sm text-muted-foreground">{tBrand("tagline")}</p>
        </div>
      </header>
      <LanguageSwitcher locales={survey.availableLocales} surveyVersionId={survey.id} disabled={submitting} />
      </div>

      <div className="space-y-3">
        <p className="section-eyebrow">{tBrand("tagline")}</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-4xl">
          {survey.title}
        </h1>
        {survey.description ? (
          <p className="leading-relaxed text-muted-foreground">{survey.description}</p>
        ) : null}
      </div>

      {/* Segmented stepper. The step count is also the accessible description of
          the form region, so the position is never conveyed by colour alone. */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-medium">
            {t("stepOf", { current: step + 1, total: totalSteps })}
            <span className="text-muted-foreground">
              {" · "}
              {t(`steps.${STEP_KEYS[step]}`)}
            </span>
          </p>
          {step === 2 ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {answeredCount === survey.questions.length
                ? t("allAnswered")
                : t("answeredCount", {
                    answered: answeredCount,
                    total: survey.questions.length,
                  })}
            </p>
          ) : null}
        </div>

        <ol aria-label={tUi("surveyProgress")} className="flex gap-2 sm:gap-3">
          {STEP_KEYS.map((key, index) => (
            <li key={key} aria-current={index === step ? "step" : undefined} className="min-w-0 flex-1">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  index < step
                    ? "bg-primary/35"
                    : index === step
                      ? "bg-primary"
                      : "bg-border",
                )}
              />
              <span className={cn("sr-only mt-2 text-xs sm:not-sr-only sm:block", index === step ? "font-semibold text-primary" : "text-muted-foreground")}>{t(`steps.${key}`)}</span>
            </li>
          ))}
        </ol>
      </div>

      {error ? (
        <Alert
          ref={errorRef}
          tabIndex={-1}
          variant="destructive"
          role="alert"
          className="focus-visible:ring-2 focus-visible:ring-destructive"
        >
          <AlertDescription>{t(error)}</AlertDescription>
        </Alert>
      ) : null}

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("privacyTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{t("privacyBody")}</p>
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Checkbox
                id="privacy"
                checked={privacyAck}
                onCheckedChange={(checked) => setPrivacyAck(checked === true)}
                aria-describedby="privacy-label"
              />
              <Label htmlFor="privacy" id="privacy-label" className="leading-snug">
                {t("privacyConsentLabel")}
              </Label>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("servicesTitle")}</CardTitle>
            <CardDescription>{t("servicesHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{t("visitTypeTitle")}</legend>
              <RadioGroup
                value={visitType}
                onValueChange={(value) => setVisitType(value)}
                className="flex flex-wrap gap-4"
              >
                {survey.visitTypes.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <RadioGroupItem value={type} id={`visit-${type}`} />
                    <Label htmlFor={`visit-${type}`} className="capitalize">
                      {survey.visitTypeLabels[type] ?? type}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{t("servicesTitle")}</legend>
              {survey.presentation.services.map((service) => (
                <div key={service.key} className="flex items-start gap-3 rounded-lg border p-3">
                  <Checkbox
                    id={`service-${service.key}`}
                    checked={servicesUsed.includes(service.key)}
                    onCheckedChange={() => toggleService(service.key)}
                  />
                  <Label htmlFor={`service-${service.key}`} className="leading-snug">
                    {service.label}
                  </Label>
                </div>
              ))}
            </fieldset>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-muted-foreground">{tUi("surveyHint")}</p>
          {grouped.map((group) => (
            <Card key={group.categoryKey}>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base">{group.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {group.questions.map((question) => (
                  <QuestionBlock
                    key={question.id}
                    id={question.id}
                    prompt={question.prompt}
                    scaleLabels={survey.ratingScale.labels}
                    ratingValues={ratingValues}
                    value={answers[question.id] ?? null}
                    onChange={(value) => setAnswer(question.id, value)}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("confirmationIndex")}</CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset className="space-y-3" aria-required>
                <legend className="sr-only">{t("confirmationIndex")}</legend>
                <RadioGroup
                  value={overallRating === null ? "" : String(overallRating)}
                  onValueChange={(value) => setOverallRating(Number(value))}
                  className="flex flex-wrap gap-2"
                >
                  {ratingValues.map((value) => (
                    <div key={value} className="flex items-center gap-2 rounded-lg border p-3">
                      <RadioGroupItem value={String(value)} id={`overall-${value}`} />
                      <Label htmlFor={`overall-${value}`}>{survey.ratingScale.labels[value - 1]}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {t("commentTitle")}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({t("commentOptional")})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="comment" className="sr-only">
                {t("commentTitle")}
              </Label>
              <Textarea
                id="comment"
                rows={6}
                maxLength={2000}
                value={comment}
                placeholder={t("commentPlaceholder")}
                onChange={(event) => setComment(event.target.value)}
              />
              <p className="mt-2 text-right text-xs text-muted-foreground">
                {comment.length}/2000
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("contactTitle")}</CardTitle>
            <CardDescription>{t("contactBody")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Checkbox
                id="contact-consent"
                checked={contactConsent}
                onCheckedChange={(checked) => setContactConsent(checked === true)}
              />
              <Label htmlFor="contact-consent" className="leading-snug">
                {t("contactConsentLabel")}
              </Label>
            </div>
            {contactConsent ? (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">{t("contactName")}</Label>
                  <Input
                    id="contact-name"
                    autoComplete="name"
                    value={contact.displayName}
                    onChange={(event) => setContact((c) => ({ ...c, displayName: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">{t("contactPhone")}</Label>
                  <Input
                    id="contact-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={contact.phone}
                    onChange={(event) => setContact((c) => ({ ...c, phone: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">{t("contactEmail")}</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    autoComplete="email"
                    value={contact.email}
                    onChange={(event) => setContact((c) => ({ ...c, email: event.target.value }))}
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="patient-actions">
        {step > 0 ? (
          <Button
            variant="outline"
            className="h-12 flex-1"
            onClick={() => {
              setError(null);
              setStep((current) => current - 1);
            }}
          >
            {t("back")}
          </Button>
        ) : null}
        {step < totalSteps - 1 ? (
          <Button className="h-12 flex-1" onClick={goNext}>
            {t("next")}
          </Button>
        ) : (
          <Button className="h-12 flex-1" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 aria-hidden className="mr-2 size-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function QuestionBlock({
  id,
  prompt,
  scaleLabels,
  ratingValues,
  value,
  onChange,
}: {
  id: string;
  prompt: string;
  scaleLabels: string[];
  ratingValues: number[];
  value: AnswerState;
  onChange: (value: AnswerState) => void;
}) {
  const t = useTranslations("survey");
  const selected = value === null ? undefined : value === "na" ? "na" : String(value);

  // One selectable row per option. The row, not the 16px radio, is the touch
  // target: many respondents are older, and a control this small is genuinely
  // hard to hit one-handed on a phone.
  // min-h-12 keeps every option at 48px, comfortably past the 44px minimum
  // touch target, because many respondents are older.
  const rowClass =
    "flex min-h-12 items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 " +
    "transition-colors hover:border-primary/45 hover:bg-accent/45 has-[:checked]:border-primary " +
    "has-[:checked]:bg-accent has-[:checked]:shadow-card";

  return (
    // Every question must be answered, including an explicit "Not applicable".
    // aria-required on the group tells assistive technology that leaving the
    // whole question blank is not an option, which the radio inputs alone
    // cannot express.
    <fieldset className="space-y-2.5" aria-required>
      <legend className="mb-1 text-sm font-semibold leading-snug text-pretty">{prompt}</legend>
      <RadioGroup
        value={selected}
        onValueChange={(next) => onChange(next === "na" ? "na" : Number(next))}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {ratingValues.map((rating) => (
          <div key={rating} className={rowClass}>
            <RadioGroupItem value={String(rating)} id={`${id}-${rating}`} />
            {/* Two spans so the number can be emphasised. The text content is
                still exactly "4 — Satisfied", which is the accessible name the
                end-to-end tests select on. */}
            <Label htmlFor={`${id}-${rating}`} className="min-w-0 flex-1 cursor-pointer">
              <span className="font-semibold tabular-nums">{rating}</span>
              <span className="text-muted-foreground"> — {scaleLabels[rating - 1]}</span>
            </Label>
          </div>
        ))}

        <div className={cn(rowClass, "items-start py-3.5 sm:col-span-2")}>
          <RadioGroupItem value="na" id={`${id}-na`} className="mt-0.5" />
          {/* The hint stays outside the label so the accessible name remains
              exactly "Not applicable". */}
          <div className="grid min-w-0 flex-1 gap-0.5">
            <Label htmlFor={`${id}-na`} className="cursor-pointer font-medium">
              {t("notApplicable")}
            </Label>
            <p className="text-xs leading-snug text-muted-foreground">{t("notApplicableHint")}</p>
          </div>
        </div>
      </RadioGroup>
    </fieldset>
  );
}
