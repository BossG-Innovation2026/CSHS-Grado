import Link from "next/link";
import { requireModule } from "@/lib/access";
import { fullName, listStudents } from "@/server/students";
import { EmptyState, PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AcademicPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireModule("academic_info");
  const { q = "" } = await searchParams;
  const students = await listStudents(q);

  return (
    <div>
      <PageHeader
        title="Academic Information"
        description="Junior high school records that feed the permanent record, and the Form 137 view of senior high grades."
        actions={
          <form action="/academic" method="get" className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Name or LRN"
              aria-label="Search students"
              className="w-48 rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong"
            >
              Search
            </button>
          </form>
        }
      />

      <div className="mt-6">
        <Panel title={`${students.length} student record(s)`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">LRN</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{fullName(s)}</td>
                    <td className="px-4 py-3 text-accent-strong">{s.lrn}</td>
                    <td className="px-4 py-3 text-muted">
                      {s.className ? `${s.gradeLevelName} · ${s.className}` : "Not enrolled"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/academic/${s.id}`} className="text-accent-strong hover:underline">
                        Open record
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {students.length === 0 && <EmptyState title="No students found" hint="Try another name or LRN." />}
        </Panel>
      </div>
    </div>
  );
}
