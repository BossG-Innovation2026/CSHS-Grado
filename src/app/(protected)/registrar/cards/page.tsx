import Link from "next/link";
import { requireModule } from "@/lib/access";
import { listClassesForCards, listStudentsForCards } from "@/server/registrar";
import { fullName } from "@/server/students";
import { EmptyState, PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireModule("registrar");
  const { q = "" } = await searchParams;
  const [students, classes] = await Promise.all([listStudentsForCards(q), listClassesForCards()]);

  return (
    <div>
      <PageHeader
        title="Report Card Printing"
        description="Print the official report card for any student. Only grades approved by the registrar appear on the printed card."
        actions={
          <form action="/registrar/cards" method="get" className="flex items-center gap-2">
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

      <div className="mt-5 flex flex-wrap gap-2">
        {classes.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted"
          >
            <span className="font-medium text-foreground">{c.name}</span>
            <span>· {c.students} student(s)</span>
          </span>
        ))}
      </div>

      <div className="mt-5">
        <Panel title={`${students.length} student(s)`}>
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
                      <Link href={`/registrar/cards/${s.id}`} className="text-accent-strong hover:underline">
                        Open / print card
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
