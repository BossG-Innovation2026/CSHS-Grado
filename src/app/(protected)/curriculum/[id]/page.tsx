import Link from "next/link";
import { requireModule } from "@/lib/access";
import { isAdmin } from "@/lib/access";
import { deleteGradeLevel, deleteSubject, getGradeLevel, listSubjects } from "../actions";
import { AddSubjectForm } from "../add-subject-form";
import { BulkUploadSubjectsForm } from "../bulk-upload-subjects-form";

export const dynamic = "force-dynamic";

export default async function GradeLevelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("curriculum");
  const { id } = await params;
  const admin = isAdmin(user);

  const [level, subjects] = await Promise.all([getGradeLevel(id), listSubjects(id)]);
  if (!level) {
    return (
      <div>
        <p className="text-sm text-muted">Grade level not found.</p>
        <Link href="/curriculum" className="mt-2 inline-block text-sm text-accent-strong hover:underline">
          ← Back to curriculum
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/curriculum" className="text-sm text-accent-strong hover:underline">
        ← Back to curriculum
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{level.name}</h1>
        {admin && (
          <form action={deleteGradeLevel}>
            <input type="hidden" name="id" value={level.id} />
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:bg-panel-hover hover:text-foreground"
            >
              Delete grade level
            </button>
          </form>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">Subjects taught in this grade level.</p>

      {admin && (
        <div className="mt-6 max-w-3xl rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Add subject</h2>
          <AddSubjectForm gradeLevelId={level.id} />
        </div>
      )}

      {admin && (
        <div className="mt-6">
          <BulkUploadSubjectsForm gradeLevelId={level.id} />
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Terms</th>
              <th className="px-4 py-3">Credit Units</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subjects.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-accent-strong">{s.code}</td>
                <td className="px-4 py-3 text-foreground">{s.title}</td>
                <td className="px-4 py-3 text-xs text-muted">
                  {s.terms} term{s.terms === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{s.creditUnits}</td>
                <td className="px-4 py-3 text-right">
                  {admin && (
                    <form action={deleteSubject}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="gradeLevelId" value={level.id} />
                      <button
                        type="submit"
                        className="text-sm text-muted hover:text-foreground hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-subtle">
                  No subjects yet. {admin ? "Use the form above to add one." : ""}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
