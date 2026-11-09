"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  LockKeyhole,
  Search,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { saveGrades, type GradeActionState } from "../grades/actions";
import { StatusPill } from "@/components/ui";
import { GRADING, remarkFor } from "@/lib/grades";
import { TERM_LABELS, type Term } from "@/lib/terms";
import type {
  TeacherDashboardData,
  TeacherDashboardStudent,
  TeacherGradeStudent,
} from "@/server/teacher-dashboard";
import type { SubjectOffering } from "@/server/grades";

/* ------------------------------------------------------------------ */
/* Small building blocks                                              */
/* ------------------------------------------------------------------ */

function Card({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_18px_50px_-38px_rgba(6,78,59,0.55)] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
            <Icon size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-wide text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function MiniStat({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "good" }) {
  return (
    <div className="rounded-xl border border-border/80 bg-surface px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">{label}</p>
      <p className={`mt-0.5 text-base font-bold ${tone === "good" ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function initialsOf(s: Pick<TeacherDashboardStudent, "firstname" | "surname">) {
  return `${s.firstname.charAt(0)}${s.surname.charAt(0)}`.toUpperCase();
}

function listName(s: Pick<TeacherDashboardStudent, "firstname" | "middlename" | "surname">) {
  return [s.surname, s.firstname, s.middlename].filter(Boolean).join(", ");
}

function termLabel(term: number) {
  return TERM_LABELS[term as Term] ?? `Term ${term}`;
}

function scoreTone(value: number | null) {
  if (value === null) return "text-subtle";
  return value >= GRADING.passing ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";
}

/* ------------------------------------------------------------------ */
/* My Advisory                                                        */
/* ------------------------------------------------------------------ */

function AdvisoryPanel({
  data,
  activeStudent,
  onSelect,
  canOpenStudentCard,
}: {
  data: TeacherDashboardData;
  activeStudent: TeacherDashboardStudent | null;
  onSelect: (id: string) => void;
  canOpenStudentCard: boolean;
}) {
  const [query, setQuery] = useState("");

  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.students;
    return data.students.filter((s) =>
      `${s.surname} ${s.firstname} ${s.middlename} ${s.lrn}`.toLowerCase().includes(q)
    );
  }, [data.students, query]);

  const assessments = activeStudent ? data.assessments.filter((a) => a.studentId === activeStudent.id) : [];
  const encoded = assessments.filter((a) => a.value !== null);
  const average = encoded.length
    ? Math.round(encoded.reduce((sum, a) => sum + (a.value ?? 0), 0) / encoded.length)
    : null;
  const passed = encoded.filter((a) => (a.value ?? 0) >= GRADING.passing).length;

  return (
    <Card
      icon={Users}
      title="My Advisory"
      description={
        data.advisory
          ? `${data.advisory.gradeLevelName} · ${data.advisory.name}`
          : "Your assigned advisory section will appear here."
      }
      actions={
        data.advisory ? (
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-strong">
            {data.students.length} student{data.students.length === 1 ? "" : "s"}
          </span>
        ) : undefined
      }
    >
      {data.advisory ? (
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="min-w-0">
            <label className="relative block">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a student in your advisory…"
                aria-label="Find a student in your advisory"
                className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </label>

            <div className="mt-3 max-h-[20rem] space-y-1 overflow-y-auto pr-1">
              {students.map((s) => {
                const selected = activeStudent?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelect(s.id)}
                    aria-pressed={selected}
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all ${
                      selected
                        ? "border-accent/60 bg-accent-soft shadow-sm"
                        : "border-transparent hover:border-border hover:bg-panel-hover/70"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                        selected ? "bg-accent text-on-accent" : "bg-panel text-muted"
                      }`}
                    >
                      {initialsOf(s)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{listName(s)}</span>
                      <span className="block truncate text-[11px] text-muted">LRN {s.lrn}</span>
                    </span>
                    <ChevronRight size={15} className={selected ? "text-accent-strong" : "text-subtle"} />
                  </button>
                );
              })}
              {students.length === 0 && (
                <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
                  {query ? "No student matches that search." : "No students are enrolled in this advisory yet."}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-panel/45 p-4">
            {activeStudent ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-sm font-bold text-on-accent shadow-md shadow-accent/20">
                    {initialsOf(activeStudent)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-foreground">
                      {activeStudent.firstname} {activeStudent.middlename} {activeStudent.surname}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">LRN {activeStudent.lrn}</p>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-subtle">Class</dt>
                    <dd className="mt-0.5 text-foreground">{data.advisory.name}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-subtle">Grade level</dt>
                    <dd className="mt-0.5 text-foreground">{data.advisory.gradeLevelName}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-subtle">Sex</dt>
                    <dd className="mt-0.5 text-foreground">{activeStudent.sex === "F" ? "Female" : "Male"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-subtle">Date of birth</dt>
                    <dd className="mt-0.5 text-foreground">{activeStudent.birthDate || "—"}</dd>
                  </div>
                </dl>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MiniStat label="Average" value={average ?? "—"} tone={average !== null && average >= GRADING.passing ? "good" : "default"} />
                  <MiniStat label="Passed" value={`${passed}/${encoded.length}`} />
                  <MiniStat label="Records" value={assessments.length} />
                </div>

                {canOpenStudentCard && (
                  <Link
                    href={`/students/${activeStudent.id}`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-on-accent transition-all hover:bg-accent-strong hover:shadow-md"
                  >
                    Open academic card
                    <ArrowUpRight size={15} />
                  </Link>
                )}
              </>
            ) : (
              <div className="grid h-full min-h-40 place-items-center text-center">
                <div>
                  <UserRound size={28} className="mx-auto text-subtle" />
                  <p className="mt-2 text-sm font-medium text-foreground">Select a student</p>
                  <p className="mt-1 text-xs text-muted">Their academic snapshot appears here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 py-10 text-center">
          <Users size={30} className="mx-auto text-subtle" />
          <p className="mt-2 text-sm font-medium text-foreground">No advisory section assigned</p>
          <p className="mt-1 text-xs text-muted">Ask a System Admin to assign you as a class adviser.</p>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Assessment Information | Grades                                     */
/* ------------------------------------------------------------------ */

function AssessmentTable({
  data,
  activeStudent,
}: {
  data: TeacherDashboardData;
  activeStudent: TeacherDashboardStudent | null;
}) {
  const assessments = activeStudent ? data.assessments.filter((a) => a.studentId === activeStudent.id) : [];
  const encoded = assessments.filter((a) => a.value !== null);
  const average = encoded.length
    ? Math.round(encoded.reduce((sum, a) => sum + (a.value ?? 0), 0) / encoded.length)
    : null;

  return (
    <Card
      icon={ClipboardList}
      title="Academic Information"
      description={
        activeStudent
          ? `Assessment records and grades for ${activeStudent.firstname} ${activeStudent.surname}.`
          : "Select a student in My Advisory to view their assessment records."
      }
      actions={
        activeStudent ? (
          <span className="max-w-full truncate rounded-full bg-panel px-2.5 py-1 text-[11px] font-medium text-muted">
            {data.advisory?.name ?? "Advisory"}
          </span>
        ) : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left">
          <thead className="border-b border-border bg-panel/70 text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold sm:px-5">Assessment Information</th>
              <th className="px-4 py-3 text-right font-semibold sm:px-5">Grades</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {assessments.map((a, index) => (
              <tr key={`${a.subjectCode}-${a.term}-${a.className}-${index}`} className="transition-colors hover:bg-panel/40">
                <td className="px-4 py-3 sm:px-5">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong">
                      <BookOpen size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{a.subjectTitle}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {a.subjectCode} · {termLabel(a.term)} · {a.className}
                      </p>
                      <span className="mt-1.5 inline-flex">
                        <StatusPill status={a.status} />
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right align-top sm:px-5">
                  <p className={`text-lg font-extrabold ${scoreTone(a.value)}`}>{a.value ?? "—"}</p>
                  <p className="text-[11px] text-muted">{a.value === null ? "Not encoded" : remarkFor(a.value)}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assessments.length === 0 && (
        <div className="px-4 py-10 text-center">
          <ClipboardList size={28} className="mx-auto text-subtle" />
          <p className="mt-2 text-sm font-medium text-foreground">No assessment records yet</p>
          <p className="mt-1 text-xs text-muted">Grades encoded for this student will appear in this table.</p>
        </div>
      )}

      {assessments.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-panel/30 px-4 py-3 sm:px-5">
          <p className="text-[11px] text-muted">
            {encoded.length} encoded assessment{encoded.length === 1 ? "" : "s"} ·{" "}
            {encoded.filter((a) => (a.value ?? 0) >= GRADING.passing).length} passed
          </p>
          <p className="text-xs font-medium text-muted">
            General average{" "}
            <span className={`text-lg font-extrabold ${scoreTone(average)}`}>{average ?? "—"}</span>
          </p>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* My Class                                                           */
/* ------------------------------------------------------------------ */

function offeringProgress(offering: SubjectOffering) {
  if (offering.studentCount === 0) return 0;
  return Math.round((offering.encodedCount / offering.studentCount) * 100);
}

function ClassPanel({
  data,
  activeOffering,
  onSelect,
}: {
  data: TeacherDashboardData;
  activeOffering: SubjectOffering | null;
  onSelect: (offeringId: string) => void;
}) {
  return (
    <Card
      icon={GraduationCap}
      title="My Class"
      description="Subject sections assigned to you. Select one to open its grades."
      actions={
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-strong">
          {data.offerings.length} section{data.offerings.length === 1 ? "" : "s"}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-3 p-4 min-[430px]:grid-cols-2 sm:p-5">
        {data.offerings.map((offering) => {
          const selected = activeOffering?.id === offering.id;
          const isSubjectTeacher = offering.teacherId === data.teacherId;
          const progress = offeringProgress(offering);
          return (
            <button
              key={offering.id}
              type="button"
              onClick={() => onSelect(offering.id)}
              aria-pressed={selected}
              className={`group relative overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                selected
                  ? "border-accent bg-accent-soft shadow-md shadow-accent/10"
                  : "border-border bg-surface hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg hover:shadow-black/5"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-xl transition-colors ${
                    selected ? "bg-accent text-on-accent" : "bg-panel text-accent-strong"
                  }`}
                >
                  <BookOpen size={16} />
                </span>
                <span className="rounded-full border border-border bg-surface/80 px-2 py-0.5 text-[10px] font-semibold text-muted">
                  {termLabel(offering.term)}
                </span>
              </div>

              <p className="mt-3 truncate text-base font-extrabold leading-tight text-foreground">{offering.code}</p>
              <p className="truncate text-[11px] text-muted">{offering.title}</p>
              <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent-strong">
                <Users size={12} className="shrink-0" />
                <span className="truncate">{offering.className}</span>
              </p>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <p className="text-[10px] text-subtle">
                  {offering.encodedCount}/{offering.studentCount} encoded
                </p>
                <span className="text-[10px] font-medium text-muted">{isSubjectTeacher ? "Subject teacher" : "Advisory"}</span>
              </div>
              <div className="mt-2">
                <StatusPill status={offering.status} />
              </div>
            </button>
          );
        })}
      </div>

      {data.offerings.length === 0 && (
        <div className="px-4 py-10 text-center">
          <GraduationCap size={30} className="mx-auto text-subtle" />
          <p className="mt-2 text-sm font-medium text-foreground">No subject sections assigned yet</p>
          <p className="mt-1 text-xs text-muted">
            Ask a System Admin to assign you as a subject teacher or class adviser.
          </p>
        </div>
      )}

      <div className="border-t border-border bg-panel/30 px-4 py-2.5">
        <Link href="/grades" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong hover:underline">
          Open all grade sheets
          <ArrowUpRight size={13} />
        </Link>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Grades                                                             */
/* ------------------------------------------------------------------ */

function GradeEditor({
  offering,
  students,
  canEncode,
}: {
  offering: SubjectOffering;
  students: TeacherGradeStudent[];
  canEncode: boolean;
}) {
  const [state, action, pending] = useActionState<GradeActionState, FormData>(saveGrades, {});
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.gradeValue === null ? "" : String(s.gradeValue)]))
  );

  return (
    <form action={action}>
      <input type="hidden" name="classSubjectId" value={offering.id} />

      {offering.status === "returned" && offering.returnNote && (
        <div className="mx-3 mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
          <span className="font-semibold">Returned for correction: </span>
          {offering.returnNote}
        </div>
      )}

      <div className="max-h-[22rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-panel text-[10px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Student</th>
              <th className="w-20 px-2 py-2.5 font-semibold">Grade</th>
              <th className="w-24 px-2 py-2.5 font-semibold">Remark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {students.map((s) => {
              const raw = values[s.id] ?? "";
              const value = raw.trim() === "" ? null : Number(raw);
              const valid = value !== null && Number.isInteger(value) && value >= GRADING.min && value <= GRADING.max;
              return (
                <tr key={s.id} className="transition-colors hover:bg-panel/40">
                  <td className="px-3 py-2.5">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {s.surname}, {s.firstname}
                    </p>
                    <p className="text-[10px] text-subtle">LRN {s.lrn}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={GRADING.min}
                      max={GRADING.max}
                      step={1}
                      name={`grade_${s.id}`}
                      value={raw}
                      onChange={(event) => setValues((current) => ({ ...current, [s.id]: event.target.value }))}
                      disabled={!canEncode || pending}
                      placeholder="—"
                      aria-label={`Grade for ${s.firstname} ${s.surname}`}
                      className="w-16 rounded-lg border border-border bg-surface px-2 py-1.5 text-center text-sm font-semibold text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-panel disabled:text-muted"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`text-[11px] font-medium ${raw.trim() === "" ? "text-subtle" : valid ? scoreTone(value) : "text-rose-600 dark:text-rose-300"}`}>
                      {raw.trim() === "" ? "Not encoded" : valid ? remarkFor(value) : "60–100 only"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {students.length === 0 && (
        <div className="px-4 py-8 text-center">
          <Users size={24} className="mx-auto text-subtle" />
          <p className="mt-2 text-xs font-medium text-foreground">No students enrolled</p>
          <p className="mt-1 text-[11px] text-muted">Students added to this class will appear here.</p>
        </div>
      )}

      <div className="border-t border-border p-3">
        {state.error && <p className="mb-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-200">{state.error}</p>}
        {state.message && (
          <p className="mb-2 flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
            <CheckCircle2 size={13} /> {state.message}
          </p>
        )}

        {canEncode ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-muted">Grades are saved against your account.</p>
            <div className="flex gap-1.5">
              <button
                type="submit"
                name="intent"
                value="save"
                disabled={pending}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-panel-hover disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save draft"}
              </button>
              <button
                type="submit"
                name="intent"
                value="submit"
                disabled={pending}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <LockKeyhole size={13} /> This sheet is locked while it is with the verifier or registrar.
          </p>
        )}
      </div>
    </form>
  );
}

function GradesPanel({
  data,
  activeOffering,
  onSelectOffering,
}: {
  data: TeacherDashboardData;
  activeOffering: SubjectOffering | null;
  onSelectOffering: (offeringId: string) => void;
}) {
  const termOfferings = activeOffering
    ? data.offerings
        .filter((o) => o.classId === activeOffering.classId && o.code === activeOffering.code)
        .sort((a, b) => a.term - b.term)
    : [];
  const students = activeOffering ? data.gradesByOffering[activeOffering.id] ?? [] : [];
  const canEncode = activeOffering ? activeOffering.status === "draft" || activeOffering.status === "returned" : false;

  return (
    <Card
      icon={ClipboardList}
      title="Grades"
      description="Assessment records and grades for the selected subject section."
      actions={
        activeOffering ? (
          <span className="rounded-full bg-panel px-2.5 py-1 text-[11px] font-semibold text-muted">
            {activeOffering.code}
          </span>
        ) : undefined
      }
    >
      {activeOffering ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-panel/25 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <CalendarDays size={14} className="text-accent-strong" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">Grading period</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {termOfferings.map((o) => {
                const active = o.id === activeOffering.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => onSelectOffering(o.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      active ? "bg-accent text-on-accent" : "bg-surface text-muted hover:bg-panel-hover hover:text-foreground"
                    }`}
                  >
                    {termLabel(o.term)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">
                {activeOffering.className} · {activeOffering.title}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {termLabel(activeOffering.term)} ·{" "}
                {activeOffering.teacherId === data.teacherId ? "Assigned subject teacher" : "Advisory class"} ·{" "}
                {activeOffering.encodedCount}/{activeOffering.studentCount} encoded
              </p>
            </div>
            <StatusPill status={activeOffering.status} />
          </div>

          <div className="mt-3">
            <GradeEditor key={activeOffering.id} offering={activeOffering} students={students} canEncode={canEncode} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-panel/30 px-4 py-2.5">
            <Link
              href={`/grades/${activeOffering.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong hover:underline"
            >
              Open full grade sheet
              <ArrowUpRight size={13} />
            </Link>
            <p className="text-[10px] text-subtle">Passing grade: {GRADING.passing}</p>
          </div>
        </>
      ) : (
        <div className="px-4 py-10 text-center">
          <TrendingUp size={30} className="mx-auto text-subtle" />
          <p className="mt-2 text-sm font-medium text-foreground">No subject selected</p>
          <p className="mt-1 text-xs text-muted">Choose a subject section in My Class to view and encode grades.</p>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Main dashboard                                                     */
/* ------------------------------------------------------------------ */

export function TeacherDashboard({
  data,
  teacherName,
  canOpenStudentCard,
}: {
  data: TeacherDashboardData;
  teacherName: string;
  canOpenStudentCard: boolean;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState(data.students[0]?.id ?? "");
  const [selectedOfferingId, setSelectedOfferingId] = useState(data.offerings[0]?.id ?? "");

  const activeStudent =
    data.students.find((s) => s.id === selectedStudentId) ?? data.students[0] ?? null;
  const activeOffering =
    data.offerings.find((o) => o.id === selectedOfferingId) ?? data.offerings[0] ?? null;

  const pendingSheets = data.offerings.filter((o) => o.status === "returned" || o.status === "draft").length;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface px-5 py-5 shadow-[0_18px_50px_-40px_rgba(6,78,59,0.55)] sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent-soft/80 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent-strong">
              Cabiao Senior High School
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">Teacher Dashboard</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Welcome back, {teacherName.split(/\s+/)[0] || teacherName}. Manage your advisory, subject sections and grades in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-foreground">
              <Users size={14} className="text-accent-strong" />
              {data.advisory ? data.advisory.name : "No advisory"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-foreground">
              <BookOpen size={14} className="text-accent-strong" />
              {data.offerings.length} subject section{data.offerings.length === 1 ? "" : "s"}
            </span>
            {pendingSheets > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <ClipboardList size={14} />
                {pendingSheets} sheet{pendingSheets === 1 ? "" : "s"} to finish
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-7">
          <AdvisoryPanel
            data={data}
            activeStudent={activeStudent}
            onSelect={setSelectedStudentId}
            canOpenStudentCard={canOpenStudentCard}
          />
          <AssessmentTable data={data} activeStudent={activeStudent} />
        </div>

        <div className="min-w-0 space-y-5 xl:col-span-5">
          <ClassPanel data={data} activeOffering={activeOffering} onSelect={setSelectedOfferingId} />
          <GradesPanel
            data={data}
            activeOffering={activeOffering}
            onSelectOffering={setSelectedOfferingId}
          />
        </div>
      </div>
    </div>
  );
}
