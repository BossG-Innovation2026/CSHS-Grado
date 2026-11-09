import Link from "next/link";
import { redirect } from "next/navigation";
import { can, ROLE_LABELS, ROLE_TEACHER, type ModuleKey } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { buildStudentCard } from "@/server/cards";
import { listMyOfferings, listVerificationQueue } from "@/server/grades";
import { getRegistrarSummary } from "@/server/registrar";
import { listChildrenForParent } from "@/server/students";
import { getTeacherDashboard } from "@/server/teacher-dashboard";
import { EmptyState, PageHeader, Panel, Stat, StatusPill } from "@/components/ui";
import { TeacherDashboard } from "./teacher-dashboard";

export const dynamic = "force-dynamic";

interface QuickAction {
  module: ModuleKey;
  href: string;
  label: string;
  description: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    module: "grades_submit",
    href: "/grades",
    label: "Submit grades",
    description: "Encode one grade per student and submit the sheet for verification.",
  },
  {
    module: "grades_approve",
    href: "/grades/verify",
    label: "Verify grades",
    description: "Check submitted sheets and send them back with a note when needed.",
  },
  {
    module: "personal_info",
    href: "/students",
    label: "Personal information",
    description: "Find a student, see the date of birth, class record and grades.",
  },
  {
    module: "academic_info",
    href: "/academic",
    label: "Academic information",
    description: "Junior high school records and the Form 137 permanent record.",
  },
  {
    module: "registrar",
    href: "/registrar",
    label: "Registrar office",
    description: "Approve grades, receive surrendered records and manage parent access.",
  },
  {
    module: "registrar",
    href: "/registrar/cards",
    label: "Print report cards",
    description: "Print official cards containing registrar-approved grades only.",
  },
  {
    module: "audit",
    href: "/audit",
    label: "Audit log",
    description: "See who changed a grade, record or parent link, and when.",
  },
  {
    module: "classes",
    href: "/classes",
    label: "Classes",
    description: "Open a class, enrol students and assign subject teachers.",
  },
  {
    module: "parent_portal",
    href: "/parent",
    label: "My child's card",
    description: "View the approved report card for each linked child.",
  },
  {
    module: "accounts",
    href: "/accounts",
    label: "Account management",
    description: "Create staff and parent accounts and set their modules.",
  },
  {
    module: "curriculum",
    href: "/curriculum",
    label: "Curriculum setup",
    description: "Manage grade levels, subjects and the subjects offered in classes.",
  },
];

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Teachers get the academic tracking dashboard: advisory, class sections,
  // and the grades for the section they are working on.
  if (user.role === ROLE_TEACHER && can(user, "grades_submit")) {
    const teacherData = await getTeacherDashboard();
    return (
      <TeacherDashboard
        data={teacherData}
        teacherName={user.name}
        canOpenStudentCard={can(user, "personal_info")}
      />
    );
  }

  const isParent = can(user, "parent_portal");
  const isRegistrar = can(user, "registrar");
  const canSubmit = can(user, "grades_submit");
  const canApprove = can(user, "grades_approve");

  const children = isParent ? await listChildrenForParent(user.id) : [];
  const parentCards = isParent
    ? await Promise.all(children.map((child) => buildStudentCard(child.id, { approvedOnly: true })))
    : [];
  const summary = isRegistrar ? await getRegistrarSummary() : null;
  const myOfferings = canSubmit && !isParent ? await listMyOfferings() : [];
  const queue = canApprove && !isRegistrar ? await listVerificationQueue() : [];

  const actions = QUICK_ACTIONS.filter((action) => can(user, action.module)).slice(0, 6);
  const awaitingVerification = queue.filter((o) => o.status === "submitted" || o.status === "verified");
  const returnedToMe = myOfferings.filter((o) => o.status === "returned");
  const draftCount = myOfferings.filter((o) => o.status === "draft").length;
  const submittedCount = myOfferings.filter((o) => o.status === "submitted").length;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name.split(/\s+/)[0] || user.name}`}
        description={`Signed in as ${ROLE_LABELS[user.role] ?? user.role}. Your modules decide which records and actions are available.`}
      />

      {isParent && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Linked children"
            value={children.length}
            hint={children.length === 1 ? "Your child's approved card" : "Only your children are shown"}
            href="/parent"
          />
          <Stat
            label="Approved terms"
            value={parentCards.reduce((sum, card) => sum + (card?.terms.length ?? 0), 0)}
            hint="Only registrar-approved grades appear"
          />
          <Stat
            label="General average"
            value={
              parentCards.find((card) => card?.generalAverage !== null && card?.generalAverage !== undefined)?.generalAverage ??
              "—"
            }
            hint="From approved grades only"
          />
        </div>
      )}

      {isRegistrar && summary && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Students" value={summary.students} hint={`${summary.classes} classes`} href="/students" />
          <Stat
            label="Awaiting action"
            value={summary.submitted + summary.verified}
            hint={`${summary.submitted} to verify · ${summary.verified} to approve`}
            href="/grades/verify"
          />
          <Stat
            label="Records to receive"
            value={summary.pendingSurrenders}
            hint={`${summary.signedSheets} signed sheet(s) on file`}
            href="/registrar"
          />
          <Stat
            label="Approved"
            value={summary.approved}
            hint={`${summary.parentLinks} parent link(s)`}
            href="/registrar"
          />
        </div>
      )}

      {canSubmit && !isParent && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Panel title="My grade sheets" description="Subjects you teach, plus every subject in a class you advise.">
            <div className="grid grid-cols-3 gap-3 p-4 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">{draftCount}</p>
                <p className="text-xs text-muted">Drafts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-300">{submittedCount}</p>
                <p className="text-xs text-muted">Submitted</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-300">{returnedToMe.length}</p>
                <p className="text-xs text-muted">Returned</p>
              </div>
            </div>
            {returnedToMe.length > 0 && (
              <div className="border-t border-border px-4 py-3">
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">Needs your correction</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {returnedToMe.slice(0, 4).map((o) => (
                    <li key={o.id}>
                      <Link href={`/grades/${o.id}`} className="text-accent-strong hover:underline">
                        {o.className} · {o.code} · Term {o.term}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="border-t border-border px-4 py-3">
              <Link href="/grades" className="text-sm text-accent-strong hover:underline">
                Open my subject sheets
              </Link>
            </div>
          </Panel>

          <Panel title="Verification queue" description="Adviser and registrar work on submitted sheets.">
            <div className="divide-y divide-border">
              {awaitingVerification.slice(0, 6).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <Link href={`/grades/${o.id}`} className="text-foreground hover:underline">
                    {o.className} · {o.code} · Term {o.term}
                  </Link>
                  <StatusPill status={o.status} />
                </div>
              ))}
              {awaitingVerification.length === 0 && (
                <EmptyState title="Nothing waiting" hint="Submitted sheets appear here." />
              )}
            </div>
          </Panel>
        </div>
      )}

      {canApprove && !isRegistrar && !canSubmit && (
        <div className="mt-5">
          <Panel title="Sheets needing action" description="Submitted sheets wait for an adviser, head or registrar.">
            <div className="divide-y divide-border">
              {awaitingVerification.slice(0, 8).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <Link href={`/grades/${o.id}`} className="text-foreground hover:underline">
                    {o.className} · {o.code} · Term {o.term}
                  </Link>
                  <StatusPill status={o.status} />
                </div>
              ))}
              {awaitingVerification.length === 0 && (
                <EmptyState title="Nothing waiting" hint="Submitted sheets appear here." />
              )}
            </div>
          </Panel>
        </div>
      )}

      {isParent && (
        <div className="mt-5">
          <Panel
            title="My children"
            description="Only registrar-approved grades are shown in the parent portal."
            actions={
              <Link href="/parent" className="text-sm text-accent-strong hover:underline">
                Open portal
              </Link>
            }
          >
            <div className="divide-y divide-border">
              {children.map((child, index) => (
                <div key={child.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <Link href={`/parent/${child.id}`} className="font-medium text-foreground hover:underline">
                      {child.firstname} {child.surname}
                    </Link>
                    <p className="text-xs text-muted">
                      LRN {child.lrn} · {parentCards[index]?.className ?? "Not enrolled"}
                    </p>
                  </div>
                  <p className="text-xs text-muted">
                    General average: <span className="font-semibold text-foreground">{parentCards[index]?.generalAverage ?? "—"}</span>
                  </p>
                </div>
              ))}
              {children.length === 0 && (
                <EmptyState
                  title="No child linked yet"
                  hint="Ask the registrar office to link your account to your child's record."
                />
              )}
            </div>
          </Panel>
        </div>
      )}

      <div className="mt-5">
        <Panel title="Quick actions" description="Everything you can open is also in the top navigation.">
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((action) => (
              <Link
                key={`${action.module}-${action.href}`}
                href={action.href}
                className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/60 hover:bg-panel-hover"
              >
                <p className="text-sm font-semibold text-foreground">{action.label}</p>
                <p className="mt-1 text-xs text-muted">{action.description}</p>
              </Link>
            ))}
          </div>
          {actions.length === 0 && (
            <EmptyState
              title="No modules assigned yet"
              hint="Ask a System Admin to give this account access to the modules you need."
            />
          )}
        </Panel>
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-border bg-panel p-6 text-center">
        <p className="text-sm font-medium text-foreground">Analytics and notifications</p>
        <p className="mt-1 text-xs text-muted">
          Coming in a later module. Your modules are always available in the top navigation.
        </p>
      </div>
    </div>
  );
}
