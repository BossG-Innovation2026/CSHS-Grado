import Link from "next/link";
import { requireModule } from "@/lib/access";
import { buildStudentCard } from "@/server/cards";
import { fullName } from "@/server/students";
import { BackLink, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { StudentCardView } from "@/components/student-card";

export const dynamic = "force-dynamic";

export default async function PrintCardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("registrar");
  const { id } = await params;
  const card = await buildStudentCard(id, { approvedOnly: true });

  if (!card) {
    return (
      <div>
        <BackLink href="/registrar/cards">Back to card printing</BackLink>
        <p className="mt-3 text-sm text-muted">Student not found.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="print:hidden">
        <BackLink href="/registrar/cards">Back to card printing</BackLink>
        <div className="mt-2">
          <PageHeader
            title={`${fullName(card.student)} — Report Card`}
            description="Official senior high school report card. Only registrar-approved grades are included."
            actions={
              <>
                <Link
                  href={`/students/${card.student.id}`}
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-panel-hover"
                >
                  Student record
                </Link>
                <Link
                  href={`/academic/${card.student.id}`}
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-panel-hover"
                >
                  Form 137
                </Link>
                <PrintButton label="Print card" />
              </>
            }
          />
        </div>
      </div>

      <div className="mt-6">
        <StudentCardView card={card} title="Senior High School Report Card" showContact />
      </div>
    </div>
  );
}
