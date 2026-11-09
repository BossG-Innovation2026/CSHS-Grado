import Link from "next/link";
import { requireModule } from "@/lib/access";
import { listClasses } from "@/server/classes";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  await requireModule("classes");
  const classes = await listClasses();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Class Creation</h1>
          <p className="mt-1 text-sm text-muted">
            Sections with their adviser and subject teachers.
          </p>
        </div>
        <Link
          href="/classes/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong"
        >
          Create class
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Grade level</th>
              <th className="px-4 py-3">Strand</th>
              <th className="px-4 py-3">School year</th>
              <th className="px-4 py-3">Adviser</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {classes.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                <td className="px-4 py-3 text-foreground">{c.gradeLevelName}</td>
                <td className="px-4 py-3 text-xs text-muted">{c.strand || "—"}</td>
                <td className="px-4 py-3 text-xs text-muted">{c.schoolYear || "—"}</td>
                <td className="px-4 py-3 text-xs text-muted">{c.adviserName}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/classes/${c.id}`} className="text-accent-strong hover:underline">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
            {classes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-subtle">
                  No classes yet. Create the first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
