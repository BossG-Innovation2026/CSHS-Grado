import Link from "next/link";
import { requireModule } from "@/lib/access";
import { canViewContactInfo, fullName, listStudents } from "@/server/students";
import { EmptyState, PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireModule("personal_info");
  const { q = "" } = await searchParams;
  const students = await listStudents(q);
  const showContact = canViewContactInfo(user);

  return (
    <div>
      <PageHeader
        title="Personal Information"
        description={
          showContact
            ? "Search any student and open their complete personal record, grades and academic history."
            : "Search the students in your classes. Teacher accounts see the date of birth; parent and contact details stay with the registrar office."
        }
        actions={
          <form action="/students" method="get" className="flex items-center gap-2">
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
        <Panel title={`${students.length} student(s)`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">LRN</th>
                  <th className="px-4 py-3">Sex</th>
                  <th className="px-4 py-3">Date of birth</th>
                  <th className="px-4 py-3">Class</th>
                  {showContact && <th className="px-4 py-3">Parent / contact</th>}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{fullName(s)}</td>
                    <td className="px-4 py-3 text-accent-strong">{s.lrn}</td>
                    <td className="px-4 py-3 text-muted">{s.sex}</td>
                    <td className="px-4 py-3 text-muted">{s.birthDate || "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {s.className ? `${s.gradeLevelName} · ${s.className}` : "Not enrolled"}
                    </td>
                    {showContact && (
                      <td className="px-4 py-3 text-xs text-muted">
                        <p>{s.parentName || "—"}</p>
                        <p>{s.parentContact || ""}</p>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <Link href={`/students/${s.id}`} className="text-accent-strong hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {students.length === 0 && (
            <EmptyState
              title="No students found"
              hint={q ? "Try another name or LRN." : "Enrol students from a class page first."}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
