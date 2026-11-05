import Link from "next/link";
import { requireModule } from "@/lib/access";
import { isAdmin } from "@/lib/access";
import { countSubjectsByGrade, listGradeLevels } from "@/server/curriculum";
import { AddGradeLevelForm } from "./add-grade-level-form";

export const dynamic = "force-dynamic";

const K12_NAMES = [
  "Kindergarten",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

export default async function CurriculumPage() {
  const user = await requireModule("curriculum");
  const admin = isAdmin(user);
  const [levels, subjectCounts] = await Promise.all([listGradeLevels(), countSubjectsByGrade()]);
  const existing = new Set(levels.map((l) => l.name));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Curriculum Setup</h1>
          <p className="mt-1 text-sm text-muted">
            Grade levels from K-12 with the subjects taught in each.
          </p>
        </div>
      </div>

      {admin && (
        <div className="mt-6 max-w-md rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Add grade level</h2>
          <AddGradeLevelForm k12Names={K12_NAMES} existing={[...existing]} />
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Grade level</th>
              <th className="px-4 py-3">Subjects</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {levels.map((l) => {
              const count = subjectCounts[l.id] ?? 0;
              return (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{l.name}</td>
                  <td className="px-4 py-3 text-xs text-muted">{count} subject{count === 1 ? "" : "s"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/curriculum/${l.id}`} className="text-accent-strong hover:underline">
                      {count > 0 ? "Manage subjects" : "Add subjects"}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {levels.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-subtle">
                  No grade levels yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
