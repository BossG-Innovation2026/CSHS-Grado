import Link from "next/link";
import { isAdmin, requireModule } from "@/lib/access";
import { STATUS_LABELS, listMySubjects } from "@/server/grades";

export const dynamic = "force-dynamic";

export default async function GradesPage() {
  const user = await requireModule("grades_submit");
  const subjects = await listMySubjects();

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">Grade Submission</h1>
      <p className="mt-1 text-sm text-muted">
        {isAdmin(user)
          ? "System Admins do not enter grades. Each subject's teacher does."
          : "Subjects you teach this school year. Enter each learner's final grade, then submit."}
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Term</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subjects.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 text-foreground">Term {s.term}</td>
                <td className="px-4 py-3 text-foreground">
                  {s.className}
                  <p className="mt-0.5 text-xs text-subtle">{s.gradeLevelName}</p>
                </td>
                <td className="px-4 py-3 text-foreground">
                  <span className="font-medium text-accent-strong">{s.code}</span> {s.title}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{STATUS_LABELS[s.status]}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/grades/${s.id}`} className="text-accent-strong hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-subtle">
                  No subjects are assigned to you this school year.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
