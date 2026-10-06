"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Save, Trash2, Send, Loader2, Sparkles, ChevronDown } from "lucide-react";
import type { ManagedSurvey } from "@/modules/survey/manage-survey";
import type { SurveyDraftInput } from "@/modules/survey/management-schema";
import { createFeedbackIdempotencyKey } from "@/components/feedback/idempotency-key";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function QuestionManager({ initialSurveys, aiTranslationAvailable = false }: { initialSurveys: ManagedSurvey[]; aiTranslationAvailable?: boolean }) {
  const [surveys, setSurveys] = useState(initialSurveys);
  const [selected, setSelected] = useState(initialSurveys[0]?.id ?? "");
  const survey = surveys.find((item) => item.id === selected);
  const [draft, setDraft] = useState<SurveyDraftInput | null>(survey?.draft ?? null);
  const [language, setLanguage] = useState<"en" | "hi" | "mr">("en");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [translating, setTranslating] = useState<{ key: string; locale: "hi" | "mr" } | null>(null);
  const [confirmTranslation, setConfirmTranslation] = useState<{ key: string; locale: "hi" | "mr" } | null>(null);
  const [aiFeedback, setAiFeedback] = useState<{ key: string; text: string; error: boolean } | null>(null);
  const busy = pending || translating !== null;
  const editable = survey?.status === "DRAFT" && survey.editable;
  const dirty = JSON.stringify(draft) !== JSON.stringify(survey?.draft ?? null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function select(id: string) {
    setSelected(id); setDraft(surveys.find((item) => item.id === id)?.draft ?? null); setError(null); setNotice(null); setAiFeedback(null);
  }

  async function perform(action: "clone" | "save" | "publish") {
    if (!survey || !draft || busy) return;
    setPending(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/staff/surveys", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "clone" ? { action, surveyId: survey.id } : action === "save"
          ? { action, surveyId: survey.id, revision: survey.revision, draft }
          : { action, surveyId: survey.id, revision: survey.revision }) });
      const result = await response.json() as { survey?: ManagedSurvey; error?: string };
      if (!response.ok || !result.survey) throw new Error(result.error ?? "Unable to update the survey.");
      const updated = result.survey;
      setSurveys((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
      setSelected(updated.id); setDraft(updated.draft); setConfirmPublish(false);
      setNotice(action === "publish" ? `Version ${updated.version} is published. New patient links use this version; existing responses remain unchanged.`
        : action === "clone" ? `Draft version ${updated.version} is ready to edit.` : "Draft saved. Patients continue to see the published version.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update the survey."); }
    finally { setPending(false); }
  }

  async function translate(key: string, locale: "hi" | "mr") {
    const question = draft?.questions.find((item) => item.key === key);
    if (!survey || !question?.prompts.en.trim() || busy || !editable || !aiTranslationAvailable) return;
    setTranslating({ key, locale }); setAiFeedback(null); setNotice(null); setError(null);
    try {
      const response = await fetch("/api/staff/surveys", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "translate", surveyId: survey.id, english: question.prompts.en, locale }) });
      const result = await response.json() as { translation?: string; error?: string };
      if (!response.ok || !result.translation) throw new Error(result.error ?? "Unable to translate this question.");
      setDraft((current) => current && ({ ...current, questions: current.questions.map((item) => item.key === key ? { ...item, prompts: { ...item.prompts, [locale]: result.translation! } } : item) }));
      setLanguage(locale);
      setAiFeedback({ key, text: `AI ${locale === "hi" ? "Hindi" : "Marathi"} draft added. Review the wording, then save the draft.`, error: false });
    } catch (caught) {
      setAiFeedback({ key, text: caught instanceof Error ? caught.message : "Unable to translate this question.", error: true });
    } finally { setTranslating(null); }
  }

  function updateQuestion(index: number, update: Partial<SurveyDraftInput["questions"][number]>) {
    setDraft((current) => current && ({ ...current, questions: current.questions.map((question, position) => position === index ? { ...question, ...update } : question) }));
  }

  function move(index: number, direction: number) {
    setDraft((current) => {
      if (!current) return current;
      const questions = [...current.questions];
      const target = index + direction;
      if (target < 0 || target >= questions.length) return current;
      [questions[index], questions[target]] = [questions[target]!, questions[index]!];
      return { ...current, questions };
    });
  }

  if (!survey || !draft) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No survey is configured for your hospital. An existing survey is needed to create a question draft.</CardContent></Card>;

  return <div className="space-y-6">
    <Card>
      <CardContent className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="survey-version">Survey and version</Label>
          <select id="survey-version" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm lg:max-w-xl" value={selected} disabled={busy}
            onChange={(event) => dirty ? setConfirmSwitch(event.target.value) : select(event.target.value)}>
            {surveys.map((item) => <option key={item.id} value={item.id}>{item.hospital} · {item.draft.title} · v{item.version} · {item.status.toLowerCase()}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">{survey.slug} · {draft.questions.length} questions · Version {survey.version}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={survey.status === "PUBLISHED" ? "default" : "secondary"}>{survey.status === "DRAFT" ? "Draft" : survey.status === "PUBLISHED" ? "Published" : "Retired"}</Badge>
          {!editable ? <Button disabled={busy || !survey.editable} onClick={() => void perform("clone")}><Copy aria-hidden className="size-4" />Create editable draft</Button> : <>
            <Button variant="outline" disabled={busy || !dirty} onClick={() => void perform("save")}><Save aria-hidden className="size-4" />Save draft</Button>
            <Button disabled={busy || dirty} onClick={() => setConfirmPublish(true)}><Send aria-hidden className="size-4" />Publish version</Button>
          </>}
          {pending && <Loader2 aria-label="Updating survey" className="size-4 animate-spin" />}
        </div>
      </CardContent>
    </Card>

    {error && <Alert variant="destructive" role="alert"><AlertDescription>{error} {error.includes("another session") && <Button variant="link" onClick={() => window.location.reload()}>Reload latest draft</Button>}</AlertDescription></Alert>}
    {notice && <p role="status" className="rounded-lg border border-primary/20 bg-accent p-4 text-sm text-accent-foreground">{notice}</p>}
    {!survey.editable && <Alert><AlertDescription>This version contains optional or conditional questions. The current editor supports required, unconditional questions only.</AlertDescription></Alert>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader><CardTitle>Survey details</CardTitle><CardDescription>English source wording for the patient form.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="survey-title">Survey title</Label><Input id="survey-title" maxLength={200} value={draft.title} disabled={!editable || busy} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="survey-description">Introduction</Label><Textarea id="survey-description" maxLength={2000} value={draft.description} disabled={!editable || busy} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-lg font-semibold">Question wording</h2><p className="text-sm text-muted-foreground">Each question uses the existing 1–5 satisfaction scale.</p></div>
          <div className="space-y-2"><Label htmlFor="question-language">Language</Label><select id="question-language" className="h-10 rounded-md border border-input bg-background px-3 text-sm" disabled={busy} value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}>
            <option value="en">English</option><option value="hi">हिन्दी · Hindi draft</option><option value="mr">मराठी · Marathi draft</option>
          </select></div>
        </div>
        {language !== "en" && <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">These are translation drafts. Publishing this survey releases English only. The complete {language === "hi" ? "Hindi" : "Marathi"} survey and interface still need human review before patients can select them.</p>}

        <div className="space-y-4">
          {draft.questions.map((question, index) => <Card key={question.key}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <CardTitle className="text-base">Question {index + 1}</CardTitle>
              {editable && <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-label={`Move question ${index + 1} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp aria-hidden className="size-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Move question ${index + 1} down`} disabled={busy || index === draft.questions.length - 1} onClick={() => move(index, 1)}><ArrowDown aria-hidden className="size-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Remove question ${index + 1}`} disabled={busy || draft.questions.length === 1} onClick={() => setConfirmRemove(question.key)}><Trash2 aria-hidden className="size-4" /></Button>
              </div>}
            </CardHeader>
            <CardContent className="space-y-4">
              {editable && <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">AI translation uses the English question.</p>
                <DropdownMenu><DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-h-10" disabled={busy || !aiTranslationAvailable || !question.prompts.en.trim()} aria-label={`AI Translate question ${index + 1}`}>
                    {translating?.key === question.key ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Sparkles aria-hidden className="size-4" />}
                    {translating?.key === question.key ? "Translating…" : "AI Translate"}<ChevronDown aria-hidden className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger><DropdownMenuContent align="end">
                  {(["hi", "mr"] as const).map((locale) => <DropdownMenuItem key={locale} onSelect={() => {
                    if (question.prompts[locale].trim()) setConfirmTranslation({ key: question.key, locale });
                    else void translate(question.key, locale);
                  }}>{locale === "hi" ? "हिन्दी · Hindi" : "मराठी · Marathi"}</DropdownMenuItem>)}
                </DropdownMenuContent></DropdownMenu>
              </div>}
              {translating?.key === question.key && <p role="status" className="text-sm text-muted-foreground">Generating a {translating.locale === "hi" ? "Hindi" : "Marathi"} draft from English…</p>}
              {aiFeedback?.key === question.key && <p role={aiFeedback.error ? "alert" : "status"} className={aiFeedback.error ? "text-sm text-destructive" : "text-sm text-primary"}>{aiFeedback.text}</p>}
              <div className="space-y-2"><Label htmlFor={`prompt-${question.key}`}>{language === "en" ? "English question" : language === "hi" ? "Hindi question" : "Marathi question"}</Label>
                <Textarea id={`prompt-${question.key}`} lang={language} maxLength={1000} rows={3} value={question.prompts[language]} disabled={!editable || busy}
                  onChange={(event) => updateQuestion(index, { prompts: { ...question.prompts, [language]: event.target.value } })} />
                {language !== "en" && <p className="text-sm text-muted-foreground">English: {question.prompts.en || "Add the English wording first."}</p>}
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="w-full space-y-2 sm:max-w-xs"><Label htmlFor={`category-${question.key}`}>Service category</Label>
                  <select id={`category-${question.key}`} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={question.categoryKey} disabled={!editable || busy}
                    onChange={(event) => updateQuestion(index, { categoryKey: event.target.value })}>{survey.categories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select>
                </div>
                <p className="text-xs text-muted-foreground">Required · “Not applicable” allowed</p>
              </div>
            </CardContent>
          </Card>)}
        </div>
        {editable && <Button variant="outline" className="min-h-12 w-full border-dashed" disabled={busy || draft.questions.length >= 60} onClick={() => {
          setLanguage("en"); setDraft({ ...draft, questions: [...draft.questions, { key: `q_${createFeedbackIdempotencyKey().replaceAll("-", "")}`, categoryKey: survey.categories[0]!.key, prompts: { en: "", hi: "", mr: "" } }] });
        }}><Plus aria-hidden className="size-4" />Add question</Button>}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Card><CardHeader><CardTitle className="text-base">Publishing checklist</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Use short, neutral questions about one experience at a time.</p><p>Keep enough service categories to meet the existing completion rule.</p>
          <p>Save your changes, then confirm that the English wording has been reviewed before publishing.</p>
          <p>New links use the latest published version. Patients already answering a survey continue on their pinned version.</p>
        </CardContent></Card>
        <Card><CardContent className="space-y-2 p-5 text-sm text-muted-foreground"><p className="font-medium text-foreground">Version history stays intact</p><p>Editing a draft never changes existing answers or scores. Scoring weights, rating values and service definitions remain fixed.</p>
          {dirty && <p role="status" className="font-medium text-primary">You have unsaved changes.</p>}
        </CardContent></Card>
        <Card><CardContent className="space-y-2 p-5 text-sm text-muted-foreground"><p className="font-medium text-foreground">AI translation drafts</p><p>AI Translate sends the English question to Google Gemini. Use only survey wording; keep patient details out of questions. Review the generated text before saving.</p>
          {!aiTranslationAvailable && <p>AI translation is unavailable until GEMINI_API_KEY is configured on the server.</p>}
        </CardContent></Card>
      </aside>
    </div>

    <Dialog open={confirmPublish} onOpenChange={(open) => !pending && setConfirmPublish(open)}><DialogContent><DialogHeader><DialogTitle>Publish version {survey.version}?</DialogTitle><DialogDescription>Confirm you have reviewed every English question. This version becomes available to new patients and its wording cannot be edited afterward. Hindi and Marathi remain drafts.</DialogDescription></DialogHeader><DialogFooter>
      <Button variant="outline" disabled={busy} onClick={() => setConfirmPublish(false)}>Cancel</Button><Button disabled={busy} onClick={() => void perform("publish")}>{pending ? "Publishing…" : "Confirm publication"}</Button>
    </DialogFooter></DialogContent></Dialog>
    <Dialog open={confirmSwitch !== null} onOpenChange={(open) => !open && setConfirmSwitch(null)}><DialogContent><DialogHeader><DialogTitle>Discard unsaved changes?</DialogTitle><DialogDescription>Switching versions will discard your unsaved edits.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmSwitch(null)}>Keep editing</Button><Button onClick={() => { if (confirmSwitch) select(confirmSwitch); setConfirmSwitch(null); }}>Discard and switch</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={confirmRemove !== null} onOpenChange={(open) => !open && setConfirmRemove(null)}><DialogContent><DialogHeader><DialogTitle>Remove this question?</DialogTitle><DialogDescription>This removes the question from the draft. Published surveys and past answers remain unchanged.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmRemove(null)}>Cancel</Button><Button variant="destructive" onClick={() => { setDraft({ ...draft, questions: draft.questions.filter((question) => question.key !== confirmRemove) }); setConfirmRemove(null); }}>Remove question</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={confirmTranslation !== null} onOpenChange={(open) => !open && setConfirmTranslation(null)}><DialogContent><DialogHeader><DialogTitle>Replace the existing translation?</DialogTitle><DialogDescription>This question already has {confirmTranslation?.locale === "hi" ? "Hindi" : "Marathi"} wording. Generate a new AI draft from the English question to replace it?</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmTranslation(null)}>Keep existing text</Button><Button onClick={() => { const choice = confirmTranslation; setConfirmTranslation(null); if (choice) void translate(choice.key, choice.locale); }}>Replace with AI draft</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
