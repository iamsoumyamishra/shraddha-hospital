import { setRequestLocale } from "next-intl/server";
import { requireStaffPage } from "@/lib/authorization";
import { listManagedSurveys, managedHospitalIds } from "@/modules/survey/manage-survey";
import { PageHeading } from "@/components/dashboard/staff-shell";
import { QuestionManager } from "@/components/dashboard/question-manager";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function QuestionsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const staff = await requireStaffPage();
  return <div className="space-y-6">
    <PageHeading title="Survey questions" description="Manage the questions patients see. Work in a draft, review the wording, then publish a new survey version." />
    {managedHospitalIds(staff).length ? <QuestionManager initialSurveys={await listManagedSurveys(staff)} aiTranslationAvailable={Boolean(process.env.GEMINI_API_KEY?.trim())} /> :
      <Card><CardContent className="p-6 text-sm text-muted-foreground">A hospital administrator must manage survey questions. Contact your hospital administrator for access.</CardContent></Card>}
  </div>;
}
