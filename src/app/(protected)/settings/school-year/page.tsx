import { requireAdmin } from "@/lib/access";
import { POLICY_LABELS } from "@/lib/grading";
import { listSchoolYears } from "@/server/school-years";
import { AddSchoolYearForm, SetCurrentYearForm, TermDatesForm } from "./school-year-forms";

export const dynamic = "force-dynamic";

export default async function SchoolYearsPage() {
  await requireAdmin();
  const years = await listSchoolYears();

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-foreground">School Years</h1>
      <p className="mt-1 text-sm text-muted">
        New classes join the current school year. Its grading rules follow DepEd Order 015, s. 2026.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Add school year</h2>
        <AddSchoolYearForm />
      </div>

      {years.map((year) => (
        <section key={year.id} className="mt-6 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                SY {year.id}
                {year.isCurrent && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">
                    Current
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {year.startsOn} to {year.endsOn} · {POLICY_LABELS[year.policyKey]}
              </p>
            </div>
            {!year.isCurrent && <SetCurrentYearForm id={year.id} />}
          </div>
          <TermDatesForm id={year.id} terms={year.terms} />
        </section>
      ))}
    </div>
  );
}
