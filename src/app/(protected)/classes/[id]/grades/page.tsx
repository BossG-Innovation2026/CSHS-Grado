import Link from "next/link";
import { requireModule } from "@/lib/access";
import { TERMS, type Term } from "@/lib/terms";
import { STATUS_LABELS, getConsolidatedSheet } from "@/server/grades";

export const dynamic = "force-dynamic";

export default async function ConsolidatedGradesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  await requireModule("classes");
  const { id } = await params;
  const { term: termParam } = await searchParams;
  const term = TERMS.includes(Number(termParam) as Term) ? (Number(termParam) as Term) : 1;

  const sheet = await getConsolidatedSheet(id, term);
  if (!sheet) {
    return (
      <div>
        <p className="text-sm text-muted">Class not found, or you do not have access to its consolidated grades.</p>
        <Link href="/classes" className="mt-2 inline-block text-sm text-accent-strong hover:underline">
          ← Back to classes
        </Link>
      </div>
    );
  }

  const { cls, subjects, students, grades } = sheet;
  const submitted = subjects.filter((s) => s.status === "submitted" || s.status === "approved").length;

  return (
    <div>
      <Link href={`/classes/${cls.id}`} className="text-sm text-accent-strong hover:underline">
        ← Back to class
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Consolidated grades · {cls.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {cls.gradeLevelName} · SY {cls.schoolYearId} · {submitted} of {subjects.length} subject(s) submitted for Term{" "}
            {term}
          </p>
        </div>
        <div className="flex gap-1 rounded-md bg-panel p-1">
          {TERMS.map((t) => (
            <Link
              key={t}
              href={`/classes/${cls.id}/grades?term=${t}`}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                t === term ? "bg-accent text-on-accent" : "text-muted hover:text-foreground"
              }`}
            >
              Term {t}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-panel text-xs text-muted">
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-52 bg-panel px-4 py-2">
                Learner
              </th>
              {subjects.map((s) => (
                <th key={s.id} scope="col" title={`${s.title} · ${s.teacherName ?? "No teacher"}`} className="px-3 py-2 text-center font-medium">
                  {s.code}
                  <span className="block font-normal text-subtle">{STATUS_LABELS[s.status]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((learner) => (
              <tr key={learner.id}>
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-2 font-normal text-foreground">
                  {learner.surname}, {learner.firstname}
                  <span className="block text-xs text-subtle">{learner.lrn}</span>
                </th>
                {subjects.map((s) => (
                  <td key={s.id} className="px-3 py-2 text-center text-foreground" data-consolidated={`${s.id}:${learner.id}`}>
                    {grades[s.id]?.[learner.id] ?? <span className="text-subtle">—</span>}
                  </td>
                ))}
              </tr>
            ))}
            {(students.length === 0 || subjects.length === 0) && (
              <tr>
                <td colSpan={subjects.length + 1} className="px-4 py-8 text-center text-subtle">
                  {students.length === 0 ? "No learners are enrolled yet." : `No subjects are set up for Term ${term}.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
