"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Printer,
  Search,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { GradeEntryTable } from "@/components/grade-entry-table";
import { StatusPill } from "@/components/ui";
import { COMPONENT_LABELS, GRADING, remarkFor } from "@/lib/grades";
import { TERM_LABELS, type Term } from "@/lib/terms";
import type {
  TeacherAdvisory,
  TeacherDashboardData,
  TeacherDashboardStudent,
} from "@/server/teacher-dashboard";
import type { SubjectOffering } from "@/server/grades";

/* ------------------------------------------------------------------ */
/* Small building blocks                                              */
/* ------------------------------------------------------------------ */

function SectionCard({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_22px_60px_-45px_rgba(0,0,0,0.9)] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 bg-panel/35 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-strong">
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-wide text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

function Chip({
  icon: Icon,
  children,
  tone = "default",
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  tone?: "default" | "accent" | "warning" | "success";
}) {
  const tones = {
    default: "border-border bg-panel/60 text-muted",
    accent: "border-accent/30 bg-accent-soft text-accent-strong",
    warning: "border-warning/30 bg-warning/10 text-warning",
    success: "border-success/30 bg-success/10 text-success",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}
    >
      {Icon && <Icon size={13} />}
      {children}
    </span>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "warning" | "success";
}) {
  const ring = {
    default: "text-accent-strong bg-accent-soft",
    accent: "text-accent-strong bg-accent-soft",
    warning: "text-warning bg-warning/10",
    success: "text-success bg-success/10",
  } as const;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${ring[tone]}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-extrabold leading-none tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-2 text-[11px] text-muted">{hint}</p>}
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
  return value >= GRADING.passing ? "text-success" : "text-danger";
}

function advisoryTitle(advisory: TeacherAdvisory) {
  return [advisory.gradeLevelName, advisory.strand, advisory.name].filter(Boolean).join(" · ");
}

/* ------------------------------------------------------------------ */
/* 1. My Advisory                                                     */
/* ------------------------------------------------------------------ */

function AdvisoryPanel({
  data,
  activeStudent,
  onSelect,
  canOpenStudentCard,
  canOpenAcademicCard,
}: {
  data: TeacherDashboardData;
  activeStudent: TeacherDashboardStudent | null;
  onSelect: (id: string) => void;
  canOpenStudentCard: boolean;
  canOpenAcademicCard: boolean;
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
    <SectionCard
      icon={Users}
      title="My Advisory"
      description={
        data.advisory
          ? `${advisoryTitle(data.advisory)}${data.advisory.schoolYear ? ` · SY ${data.advisory.schoolYear}` : ""}`
          : "Your assigned advisory section will appear here."
      }
      actions={
        data.advisory ? (
          <Chip icon={Users} tone="accent">
            {data.students.length} student{data.students.length === 1 ? "" : "s"}
          </Chip>
        ) : undefined
      }
      className="print:hidden"
    >
      {data.advisory ? (
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-border bg-panel/45 px-2.5 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-subtle">Section</p>
                <p className="mt-0.5 truncate text-xs font-bold text-foreground">{data.advisory.name}</p>
              </div>
              <div className="rounded-xl border border-border bg-panel/45 px-2.5 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-subtle">Grade level</p>
                <p className="mt-0.5 truncate text-xs font-bold text-foreground">{data.advisory.gradeLevelName}</p>
              </div>
              <div className="rounded-xl border border-border bg-panel/45 px-2.5 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-subtle">Strand</p>
                <p className="mt-0.5 truncate text-xs font-bold text-foreground">{data.advisory.strand || "—"}</p>
              </div>
              <div className="rounded-xl border border-border bg-panel/45 px-2.5 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-subtle">Students</p>
                <p className="mt-0.5 text-xs font-bold text-foreground">{data.students.length}</p>
              </div>
            </div>

            <label className="relative mt-3 block">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or LRN…"
                aria-label="Search your advisory students"
                className="w-full rounded-xl border border-border bg-input py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </label>

            <div className="mt-3 max-h-[21rem] space-y-1 overflow-y-auto pr-1">
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
                  <div className="min-w-0 flex-1">
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
                  <div className="rounded-xl border border-border/80 bg-surface px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">Average</p>
                    <p className={`mt-0.5 text-base font-bold ${scoreTone(average)}`}>{average ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-surface px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">Passed</p>
                    <p className="mt-0.5 text-base font-bold text-foreground">
                      {passed}/{encoded.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-surface px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">Records</p>
                    <p className="mt-0.5 text-base font-bold text-foreground">{assessments.length}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {canOpenStudentCard && (
                    <Link
                      href={`/students/${activeStudent.id}`}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-on-accent transition-all hover:bg-accent-strong hover:shadow-md"
                    >
                      View student profile
                      <ArrowUpRight size={15} />
                    </Link>
                  )}
                  {canOpenAcademicCard && (
                    <Link
                      href={`/academic/${activeStudent.id}`}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent/50 hover:bg-panel-hover"
                    >
                      Open academic card
                      <ArrowUpRight size={15} />
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <div className="grid h-full min-h-40 place-items-center text-center">
                <div>
                  <UserRound size={28} className="mx-auto text-subtle" />
                  <p className="mt-2 text-sm font-medium text-foreground">Select a student</p>
                  <p className="mt-1 text-xs text-muted">Their academic snapshot and links appear here.</p>
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
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Assessment Information and Grades                               */
/* ------------------------------------------------------------------ */

function AssessmentPanel({
  data,
  activeStudent,
}: {
  data: TeacherDashboardData;
  activeStudent: TeacherDashboardStudent | null;
}) {
  const [term, setTerm] = useState<"all" | Term>("all");

  const all = activeStudent ? data.assessments.filter((a) => a.studentId === activeStudent.id) : [];
  const rows = term === "all" ? all : all.filter((a) => a.term === term);
  const encoded = all.filter((a) => a.value !== null);
  const average = encoded.length
    ? Math.round(encoded.reduce((sum, a) => sum + (a.value ?? 0), 0) / encoded.length)
    : null;

  return (
    <SectionCard
      icon={ClipboardList}
      title="Assessment Information and Grades"
      description={
        activeStudent
          ? `Written Works, Performance Tasks, Other Components and final grades for ${activeStudent.firstname} ${activeStudent.surname}.`
          : "Select a student in My Advisory to view their assessment records."
      }
      actions={
        activeStudent ? (
          <div className="flex flex-wrap items-center gap-1">
            {(["all", 1, 2, 3] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTerm(value)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  term === value
                    ? "bg-accent text-on-accent"
                    : "bg-panel text-muted hover:bg-panel-hover hover:text-foreground"
                }`}
              >
                {value === "all" ? "All terms" : termLabel(value)}
              </button>
            ))}
          </div>
        ) : undefined
      }
      className="print:hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-panel/50 text-[10px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="px-4 py-2.5 font-semibold sm:px-5">Subject</th>
              <th className="px-2 py-2.5 font-semibold">Term</th>
              <th className="px-2 py-2.5 text-center font-semibold">{COMPONENT_LABELS.writtenWork}</th>
              <th className="px-2 py-2.5 text-center font-semibold">{COMPONENT_LABELS.performanceTask}</th>
              <th className="px-2 py-2.5 text-center font-semibold">{COMPONENT_LABELS.otherAssessment}</th>
              <th className="px-2 py-2.5 text-center font-semibold">Final</th>
              <th className="px-4 py-2.5 font-semibold sm:px-5">Remark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {rows.map((a) => (
              <tr key={`${a.subjectCode}-${a.term}-${a.className}`} className="transition-colors hover:bg-panel/40">
                <td className="px-4 py-3 sm:px-5">
                  <p className="truncate text-sm font-semibold text-foreground">{a.subjectTitle}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {a.subjectCode} · {a.className}
                    {a.strand ? ` · ${a.strand}` : ""}
                  </p>
                  <span className="mt-1.5 inline-flex">
                    <StatusPill status={a.status} />
                  </span>
                </td>
                <td className="px-2 py-3 text-xs font-medium text-muted">{termLabel(a.term)}</td>
                <ComponentCell value={a.writtenWork} />
                <ComponentCell value={a.performanceTask} />
                <ComponentCell value={a.otherAssessment} />
                <td className={`px-2 py-3 text-center text-base font-extrabold ${scoreTone(a.value)}`}>
                  {a.value ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs font-medium text-muted sm:px-5">{remarkFor(a.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="px-4 py-10 text-center">
          <ClipboardList size={28} className="mx-auto text-subtle" />
          <p className="mt-2 text-sm font-medium text-foreground">
            {activeStudent ? "No assessment records for this term" : "No student selected"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {activeStudent
              ? "Choose another term, or encode grades in Grades Overview."
              : "Select a student in My Advisory first."}
          </p>
        </div>
      )}

      {all.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-panel/30 px-4 py-3 sm:px-5">
          <p className="text-[11px] text-muted">
            {encoded.length} encoded assessment{encoded.length === 1 ? "" : "s"} ·{" "}
            {encoded.filter((a) => (a.value ?? 0) >= GRADING.passing).length} passed
          </p>
          <p className="text-xs font-medium text-muted">
            General average <span className={`text-lg font-extrabold ${scoreTone(average)}`}>{average ?? "—"}</span>
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function ComponentCell({ value }: { value: number | null }) {
  return (
    <td className={`px-2 py-3 text-center text-xs font-semibold ${value === null ? "text-subtle" : scoreTone(value)}`}>
      {value ?? "—"}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* 3. My Class                                                        */
/* ------------------------------------------------------------------ */

interface ClassCard {
  key: string;
  offering: SubjectOffering;
  terms: number[];
}

function ClassPanel({ data, canOpenClass }: { data: TeacherDashboardData; canOpenClass: boolean }) {
  const cards = useMemo(() => {
    const map = new Map<string, ClassCard>();
    for (const offering of data.offerings) {
      const key = `${offering.classId}:${offering.code}`;
      const existing = map.get(key);
      if (existing) {
        if (!existing.terms.includes(offering.term)) existing.terms.push(offering.term);
      } else {
        map.set(key, { key, offering, terms: [offering.term] });
      }
    }
    for (const card of map.values()) card.terms.sort((a, b) => a - b);
    return [...map.values()].sort(
      (a, b) =>
        a.offering.gradeLevelName.localeCompare(b.offering.gradeLevelName) ||
        a.offering.className.localeCompare(b.offering.className) ||
        a.offering.title.localeCompare(b.offering.title)
    );
  }, [data.offerings]);

  return (
    <SectionCard
      icon={GraduationCap}
      title="My Class"
      description="Every subject and section assigned to you. Open a card to manage its class record."
      actions={
        <Chip icon={Layers} tone="accent">
          {cards.length} subject section{cards.length === 1 ? "" : "s"}
        </Chip>
      }
      className="print:hidden"
    >
      <div className="grid grid-cols-1 gap-3 p-4 min-[430px]:grid-cols-2 sm:p-5 xl:grid-cols-3">
        {cards.map(({ key, offering, terms }) => {
          const progress =
            offering.studentCount === 0
              ? 0
              : Math.round((offering.encodedCount / offering.studentCount) * 100);
          const href = canOpenClass ? `/classes/${offering.classId}` : `/grades/${offering.id}`;
          const isSubjectTeacher = offering.teacherId === data.teacherId;
          return (
            <Link
              key={key}
              href={href}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg hover:shadow-black/20"
            >
              <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-accent-soft/70 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent-strong transition-colors group-hover:bg-accent group-hover:text-on-accent">
                  <BookOpen size={16} />
                </span>
                <div className="flex flex-wrap justify-end gap-1">
                  {terms.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border bg-panel px-1.5 py-0.5 text-[9px] font-semibold text-muted"
                    >
                      T{t}
                    </span>
                  ))}
                </div>
              </div>

              <p className="mt-3 truncate text-base font-extrabold leading-tight text-foreground">{offering.code}</p>
              <p className="truncate text-[11px] text-muted">{offering.title}</p>

              <div className="mt-2 space-y-0.5 text-[11px] text-muted">
                <p className="flex items-center gap-1 truncate">
                  <Users size={12} className="shrink-0 text-accent-strong" />
                  {offering.className}
                  {offering.strand ? ` · ${offering.strand}` : ""}
                </p>
                <p className="flex items-center gap-1 truncate">
                  <GraduationCap size={12} className="shrink-0 text-subtle" />
                  {offering.gradeLevelName}
                  {offering.schoolYear ? ` · SY ${offering.schoolYear}` : ""}
                </p>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <p className="text-[10px] text-subtle">
                  {offering.encodedCount}/{offering.studentCount} encoded
                </p>
                <span className="text-[10px] font-medium text-muted">
                  {isSubjectTeacher ? "Subject teacher" : "Advisory"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <StatusPill status={offering.status} />
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-accent-strong">
                  {canOpenClass ? "Manage class" : "Open sheet"}
                  <ChevronRight size={12} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {cards.length === 0 && (
        <div className="px-4 py-10 text-center">
          <GraduationCap size={30} className="mx-auto text-subtle" />
          <p className="mt-2 text-sm font-medium text-foreground">No subject sections assigned yet</p>
          <p className="mt-1 text-xs text-muted">
            Ask a System Admin to assign you as a subject teacher or class adviser.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border bg-panel/30 px-4 py-2.5">
        <Link href="/grades" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong hover:underline">
          Open all grade sheets
          <ArrowUpRight size={13} />
        </Link>
        {canOpenClass && (
          <Link href="/classes" className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-foreground">
            All classes
            <ArrowUpRight size={13} />
          </Link>
        )}
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Grades Overview                                                 */
/* ------------------------------------------------------------------ */

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function GradesOverview({
  data,
  canOpenClass,
}: {
  data: TeacherDashboardData;
  canOpenClass: boolean;
}) {
  const sections = useMemo(() => {
    const map = new Map<string, { id: string; name: string; strand: string; gradeLevel: string; schoolYear: string }>();
    for (const o of data.offerings) {
      if (!map.has(o.classId)) {
        map.set(o.classId, {
          id: o.classId,
          name: o.className,
          strand: o.strand,
          gradeLevel: o.gradeLevelName,
          schoolYear: o.schoolYear,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.offerings]);

  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [subjectCode, setSubjectCode] = useState("");
  const [term, setTerm] = useState<number>(0);

  const effectiveSectionId = sections.some((s) => s.id === sectionId) ? sectionId : (sections[0]?.id ?? "");
  const sectionOfferings = data.offerings.filter((o) => o.classId === effectiveSectionId);

  const subjects = useMemo(() => {
    const map = new Map<string, { code: string; title: string }>();
    for (const o of sectionOfferings) if (!map.has(o.code)) map.set(o.code, { code: o.code, title: o.title });
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [sectionOfferings]);

  const effectiveCode = subjects.some((s) => s.code === subjectCode) ? subjectCode : (subjects[0]?.code ?? "");
  const terms = sectionOfferings
    .filter((o) => o.code === effectiveCode)
    .slice()
    .sort((a, b) => a.term - b.term);
  const effectiveTerm = terms.some((o) => o.term === term) ? term : (terms[0]?.term ?? 0);
  const activeOffering = terms.find((o) => o.term === effectiveTerm) ?? terms[0];
  const students = activeOffering ? data.gradesByOffering[activeOffering.id] ?? [] : [];
  const canEncode = activeOffering
    ? activeOffering.status === "draft" || activeOffering.status === "returned"
    : false;

  const encodedCount = students.filter((s) => s.gradeValue !== null).length;
  const gradedValues = students
    .map((s) => s.gradeValue)
    .filter((v): v is number => v !== null);
  const classAverage =
    gradedValues.length === 0
      ? null
      : Math.round(gradedValues.reduce((sum, value) => sum + value, 0) / gradedValues.length);

  function exportCsv() {
    if (!activeOffering) return;
    const header = [
      "Subject",
      "Section",
      "Term",
      "School Year",
      "LRN",
      "Student",
      "Written Works",
      "Performance Tasks",
      "Other Components",
      "Final Grade",
      "Remark",
    ];
    const rows = students.map((s) => [
      activeOffering.title,
      activeOffering.className,
      termLabel(activeOffering.term),
      activeOffering.schoolYear,
      s.lrn,
      [s.surname, s.firstname, s.middlename].filter(Boolean).join(", "),
      s.writtenWork ?? "",
      s.performanceTask ?? "",
      s.otherAssessment ?? "",
      s.gradeValue ?? "",
      remarkFor(s.gradeValue),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeOffering.code}-${activeOffering.className.replace(/[^\w-]+/g, "-")}-T${activeOffering.term}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <SectionCard
      icon={TrendingUp}
      title="Grades Overview"
      description="Filter by section, subject and term. Encode, edit, save and submit grades for the subjects assigned to you."
      actions={
        activeOffering ? (
          <div className="flex flex-wrap items-center gap-1.5 print:hidden">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-panel-hover"
            >
              <FileSpreadsheet size={13} /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-panel-hover"
            >
              <Printer size={13} /> Print
            </button>
          </div>
        ) : undefined
      }
      className="print:border-0 print:shadow-none"
    >
      {activeOffering ? (
        <>
          <div className="hidden px-5 py-4 print:block">
            <p className="text-sm font-bold uppercase tracking-[0.18em]">Cabiao Senior High School</p>
            <p className="mt-1 text-base font-bold">
              {activeOffering.className} · {activeOffering.code} — {activeOffering.title}
            </p>
            <p className="text-xs">
              {termLabel(activeOffering.term)}
              {activeOffering.schoolYear ? ` · SY ${activeOffering.schoolYear}` : ""} · Adviser:{" "}
              {activeOffering.adviserName}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-b border-border/80 bg-panel/25 px-4 py-3 sm:px-5 print:hidden">
            <label className="min-w-36 flex-1">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                Section
              </span>
              <select
                value={effectiveSectionId}
                onChange={(event) => {
                  setSectionId(event.target.value);
                  setSubjectCode("");
                  setTerm(0);
                }}
                className="w-full rounded-lg border border-border bg-input px-2.5 py-2 text-xs font-medium text-foreground focus:border-accent focus:outline-none"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.strand ? ` · ${s.strand}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-40 flex-1">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                Subject
              </span>
              <select
                value={effectiveCode}
                onChange={(event) => {
                  setSubjectCode(event.target.value);
                  setTerm(0);
                }}
                className="w-full rounded-lg border border-border bg-input px-2.5 py-2 text-xs font-medium text-foreground focus:border-accent focus:outline-none"
              >
                {subjects.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-28">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                Term
              </span>
              <select
                value={effectiveTerm}
                onChange={(event) => setTerm(Number(event.target.value))}
                className="w-full rounded-lg border border-border bg-input px-2.5 py-2 text-xs font-medium text-foreground focus:border-accent focus:outline-none"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.term}>
                    {termLabel(t.term)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
              <Chip icon={Users}>{students.length} students</Chip>
              <Chip tone={classAverage !== null && classAverage >= GRADING.passing ? "success" : "default"}>
                Class average {classAverage ?? "—"}
              </Chip>
              <StatusPill status={activeOffering.status} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">
                {activeOffering.className} · {activeOffering.title}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {termLabel(activeOffering.term)} ·{" "}
                {activeOffering.teacherId === data.teacherId ? "Assigned subject teacher" : "Advisory class"} ·{" "}
                {encodedCount}/{students.length} encoded
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Link
                href={canOpenClass ? `/classes/${activeOffering.classId}` : `/grades/${activeOffering.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-foreground"
              >
                {canOpenClass ? "Class record" : "Full sheet"}
                <ArrowUpRight size={13} />
              </Link>
              <Link
                href={`/grades/${activeOffering.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong hover:underline"
              >
                Open full grade sheet
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>

          <div className="mt-3">
            <GradeEntryTable
              key={activeOffering.id}
              offering={activeOffering}
              students={students}
              canEncode={canEncode}
              dense
            />
          </div>
        </>
      ) : (
        <div className="px-4 py-10 text-center">
          <TrendingUp size={30} className="mx-auto text-subtle" />
          <p className="mt-2 text-sm font-medium text-foreground">No subject sections assigned</p>
          <p className="mt-1 text-xs text-muted">
            Grades become available once an administrator assigns you a subject or class.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Main dashboard                                                     */
/* ------------------------------------------------------------------ */

export function TeacherDashboard({
  data,
  teacherName,
  canOpenStudentCard,
  canOpenAcademicCard,
  canOpenClass,
}: {
  data: TeacherDashboardData;
  teacherName: string;
  canOpenStudentCard: boolean;
  canOpenAcademicCard: boolean;
  canOpenClass: boolean;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState(data.students[0]?.id ?? "");

  const activeStudent =
    data.students.find((s) => s.id === selectedStudentId) ?? data.students[0] ?? null;

  const pendingSheets = data.offerings.filter(
    (o) => o.status === "returned" || o.status === "draft"
  ).length;
  const returnedSheets = data.offerings.filter((o) => o.status === "returned").length;
  const totalStudents = new Set(data.offerings.map((o) => o.classId)).size;
  const totalEncoded = data.offerings.reduce((sum, o) => sum + o.encodedCount, 0);
  const totalExpected = data.offerings.reduce((sum, o) => sum + o.studentCount, 0);
  const encodedPercent = totalExpected === 0 ? 0 : Math.round((totalEncoded / totalExpected) * 100);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-5 py-5 shadow-[0_24px_70px_-50px_rgba(0,0,0,0.9)] sm:px-6 print:hidden">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-accent-strong/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent-strong">
              Cabiao Senior High School · Academic Tracking
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Teacher Dashboard
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Welcome back, {teacherName.split(/\s+/)[0] || teacherName}. Your advisory, assessment
              records, subject sections and grade encoding in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip icon={Users} tone="accent">
              {data.advisory ? data.advisory.name : "No advisory"}
            </Chip>
            <Chip icon={BookOpen}>
              {data.offerings.length} subject section{data.offerings.length === 1 ? "" : "s"}
            </Chip>
            {returnedSheets > 0 ? (
              <Chip icon={AlertCircle} tone="warning">
                {returnedSheets} returned for correction
              </Chip>
            ) : pendingSheets > 0 ? (
              <Chip icon={CalendarDays} tone="warning">
                {pendingSheets} sheet{pendingSheets === 1 ? "" : "s"} to finish
              </Chip>
            ) : (
              <Chip icon={CheckCircle2} tone="success">
                All sheets up to date
              </Chip>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
        <KpiCard
          icon={Users}
          label="Advisory students"
          value={data.students.length}
          hint={data.advisory ? advisoryTitle(data.advisory) : "No advisory assigned"}
          tone="accent"
        />
        <KpiCard
          icon={Layers}
          label="Subject sections"
          value={data.offerings.length}
          hint={`${totalStudents} section${totalStudents === 1 ? "" : "s"} assigned`}
        />
        <KpiCard
          icon={ClipboardList}
          label="Grades encoded"
          value={`${encodedPercent}%`}
          hint={`${totalEncoded} of ${totalExpected} student records`}
          tone={encodedPercent === 100 ? "success" : "default"}
        />
        <KpiCard
          icon={AlertCircle}
          label="Needs attention"
          value={returnedSheets}
          hint={returnedSheets === 0 ? "Nothing returned to you" : "Returned sheets to correct"}
          tone={returnedSheets > 0 ? "warning" : "success"}
        />
      </div>

      <AdvisoryPanel
        data={data}
        activeStudent={activeStudent}
        onSelect={setSelectedStudentId}
        canOpenStudentCard={canOpenStudentCard}
        canOpenAcademicCard={canOpenAcademicCard}
      />

      <AssessmentPanel data={data} activeStudent={activeStudent} />

      <ClassPanel data={data} canOpenClass={canOpenClass} />

      <GradesOverview data={data} canOpenClass={canOpenClass} />
    </div>
  );
}
