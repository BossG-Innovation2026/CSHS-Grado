import { requireModule } from "@/lib/access";
import { buildStudentCard } from "@/server/cards";
import { fullName, isLinkedParent } from "@/server/students";
import { BackLink, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { StudentCardView } from "@/components/student-card";

export const dynamic = "force-dynamic";

export default async function ParentCardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("parent_portal");
  const { id } = await params;

  if (!(await isLinkedParent(user.id, id))) {
    return (
      <div>
        <BackLink href="/parent">Back to my children</BackLink>
        <p className="mt-3 text-sm text-muted">This student is not linked to your account.</p>
      </div>
    );
  }

  const card = await buildStudentCard(id, { approvedOnly: true });
  if (!card) {
    return (
      <div>
        <BackLink href="/parent">Back to my children</BackLink>
        <p className="mt-3 text-sm text-muted">Student record not found.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="print:hidden">
        <BackLink href="/parent">Back to my children</BackLink>
        <div className="mt-2">
          <PageHeader
            title={`${fullName(card.student)} — Report Card`}
            description="Only grades approved by the registrar are shown. Ask the registrar office about anything that looks incorrect."
            actions={<PrintButton label="Print card" />}
          />
        </div>
      </div>

      <div className="mt-6">
        <StudentCardView card={card} title="Senior High School Report Card" />
      </div>
    </div>
  );
}
