import Link from "next/link";
import { requireModule } from "@/lib/access";
import { buildStudentCard } from "@/server/cards";
import { listChildrenForParent } from "@/server/students";
import { EmptyState, PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ParentPortalPage() {
  const user = await requireModule("parent_portal");
  const children = await listChildrenForParent(user.id);
  const cards = await Promise.all(children.map((child) => buildStudentCard(child.id, { approvedOnly: true })));

  return (
    <div>
      <PageHeader
        title="My Child's Card"
        description="Only grades approved by the registrar are shown here. Contact the registrar office if a child is missing or a grade looks wrong."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {children.map((child, index) => {
          const card = cards[index];
          return (
            <Panel
              key={child.id}
              title={`${child.firstname} ${child.surname}`}
              description={card?.className ? `${card.gradeLevelName} · ${card.className}` : "Not enrolled"}
              actions={
                <Link href={`/parent/${child.id}`} className="text-sm text-accent-strong hover:underline">
                  Open card
                </Link>
              }
            >
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-subtle">LRN</p>
                  <p className="text-sm font-medium text-foreground">{child.lrn}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-subtle">Adviser</p>
                  <p className="text-sm text-foreground">{card?.adviserName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-subtle">Approved terms</p>
                  <p className="text-sm text-foreground">{card?.terms.length ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-subtle">General average</p>
                  <p className="text-sm font-semibold text-accent-strong">{card?.generalAverage ?? "—"}</p>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {children.length === 0 && (
        <div className="mt-6">
          <Panel>
            <EmptyState
              title="No child linked to this account yet"
              hint="Ask the registrar office to link your account to your child's student record."
            />
          </Panel>
        </div>
      )}
    </div>
  );
}
