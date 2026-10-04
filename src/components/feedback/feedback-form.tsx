"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2 } from "lucide-react";

export interface FeedbackFormSurvey {
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

interface Acknowledgement {
  publicId: string;
  status: "COMPLETE" | "INCOMPLETE";
  patientIndex: number | null;
  displayDecimals: number;
}

/** 1 answered rating, or explicit not-applicable. null = unanswered. */
type AnswerState = number | "na" | null;

export function FeedbackForm({ survey }: { survey: FeedbackFormSurvey }) {
  const t = useTranslations("survey");
  const tLanding = useTranslations("landing");

  const [step, setStep] = useState(0);
  const [privacyAck, setPrivacyAck] = useState(false);
  const [visitType, setVisitType] = useState(survey.visitTypes[0] ?? "outpatient");
  const [servicesUsed, setServicesUsed] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [contactConsent, setContactConsent] = useState(false);
  const [contact, setContact] = useState({ displayName: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledgement, setAcknowledgement] = useState<Acknowledgement | null>(null);

  // Stable across retries so a double-tap or a network retry cannot create two
  // submissions. Kept in a ref rather than state so it survives re-renders.
  const idempotencyKey = useRef(crypto.randomUUID());

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
  const progress = Math.round((step / totalSteps) * 100);

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

  if (acknowledgement) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <CheckCircle2 aria-hidden className="size-5 text-emerald-600" />
            {t("confirmationTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {acknowledgement.status === "COMPLETE"
              ? t("confirmationComplete", { publicId: acknowledgement.publicId })
              : t("confirmationIncomplete", { publicId: acknowledgement.publicId })}
          </p>
          {acknowledgement.patientIndex !== null ? (
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{t("confirmationIndex")}</p>
              <p className="text-3xl font-semibold tabular-nums">
                {acknowledgement.patientIndex.toFixed(acknowledgement.displayDecimals)}
                <span className="text-base font-normal text-muted-foreground"> / 100</span>
              </p>
            </div>
          ) : null}
          <aside className="rounded-lg border border-dashed p-4 text-sm">
            <p className="font-medium">{tLanding("urgentHeading")}</p>
            <p className="mt-1 text-muted-foreground">{tLanding("urgentBody")}</p>
          </aside>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setAcknowledgement(null);
              setStep(0);
              setAnswers({});
              setServicesUsed([]);
              setComment("");
              setContactConsent(false);
              setContact({ displayName: "", phone: "", email: "" });
              setOverallRating(null);
              setError(null);
              idempotencyKey.current = crypto.randomUUID();
            }}
          >
            {t("anotherResponse")}
          </Button>
        </CardContent>
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
      setError(t("errors.privacyConsent"));
      return;
    }
    if (step === 1 && servicesUsed.length === 0) {
      setError(t("errors.services"));
      return;
    }
    if (step === 2 && answeredCount < survey.questions.length) {
      setError(t("errors.questions"));
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, totalSteps - 1));
  }

  async function handleSubmit() {
    // This check belongs here, not in `goNext`: the contact step is the last one
    // and has no Next button, so validating it while advancing never ran.
    if (contactConsent && !contact.phone.trim() && !contact.email.trim()) {
      setError(t("errors.contactConsent"));
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
          idempotencyKey: idempotencyKey.current,
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
        setError(t("errors.rateLimit"));
        return;
      }
      if (!response.ok) {
        setError(response.status === 422 ? t("errors.questions") : t("errors.submit"));
        return;
      }
      setAcknowledgement(payload as Acknowledgement);
    } catch {
      setError(t("errors.submit"));
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
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Shraddha Hospital</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{survey.title}</h1>
        {survey.description ? (
          <p className="text-muted-foreground">{survey.description}</p>
        ) : null}
      </header>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {t("stepOf", { current: step + 1, total: totalSteps })}
        </p>
        <Progress value={progress} aria-hidden />
      </div>

      {error ? (
        <Alert
          ref={errorRef}
          tabIndex={-1}
          variant="destructive"
          role="alert"
          className="focus-visible:ring-2 focus-visible:ring-destructive"
        >
          <AlertDescription>{error}</AlertDescription>
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
                      {type}
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
          {grouped.map((group) => (
            <Card key={group.categoryKey}>
              <CardHeader>
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
              <fieldset className="space-y-3">
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

      <div className="flex gap-3">
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

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium leading-snug">{prompt}</legend>
      <RadioGroup
        value={selected}
        onValueChange={(next) => onChange(next === "na" ? "na" : Number(next))}
        className="gap-2"
      >
        {ratingValues.map((rating) => (
          <div key={rating} className="flex items-center gap-3">
            <RadioGroupItem value={String(rating)} id={`${id}-${rating}`} />
            <Label htmlFor={`${id}-${rating}`} className="font-normal">
              <span className="font-medium tabular-nums">{rating}</span> — {scaleLabels[rating - 1]}
            </Label>
          </div>
        ))}
        <div className="flex items-start gap-3">
          <RadioGroupItem value="na" id={`${id}-na`} />
          <div className="grid gap-1">
            <Label htmlFor={`${id}-na`} className="font-normal">
              {t("notApplicable")}
            </Label>
            <p className="text-xs text-muted-foreground">{t("notApplicableHint")}</p>
          </div>
        </div>
      </RadioGroup>
    </fieldset>
  );
}