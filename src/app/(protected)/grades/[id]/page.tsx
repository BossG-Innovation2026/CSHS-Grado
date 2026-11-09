import Link from "next/link";
import { requireModule } from "@/lib/access";
import { STATUS_LABELS, getGradeSheet } from "@/server/grades";
import { FinalGradeGrid } from "../final-grade-grid";
import { SubmitGradesButton } from "../submit-grades-button";
import { UploadGradesForm } from "../upload-grades-form";

export const dynamic = "force-dynamic";

export default async function GradeSheetPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("grades_submit");
  const { id } = await params;
  const sheet = await getGradeSheet(id);

  if (!sheet) {
    return (
      <div>
        <p className="text-sm text-muted">Grade sheet not found, or this subject is not assigned to you.</p>
        <Link href="/grades" className="mt-2 inline-block text-sm text-accent-strong hover:underline">
          ← Back to Grade Submission
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link href="/grades" className="text-sm text-accent-strong hover:underline">
        ← Back to Grade Submission
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {sheet.code} · {sheet.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {sheet.className} · {sheet.gradeLevelName} · Term {sheet.term} · SY {sheet.schoolYearId}
          </p>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-strong">
          {STATUS_LABELS[sheet.status]}
        </span>
      </div>

      {sheet.status === "returned" && sheet.returnNote && (
        <p className="mt-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">
          Returned for correction: {sheet.returnNote}
        </p>
      )}

      <FinalGradeGrid sheet={sheet} />

      {sheet.canEdit && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UploadGradesForm classSubjectId={sheet.id} />
          <SubmitGradesButton classSubjectId={sheet.id} />
        </div>
      )}
    </div>
  );
}
