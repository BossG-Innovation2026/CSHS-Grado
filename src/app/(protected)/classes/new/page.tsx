import Link from "next/link";
import { requireModule } from "@/lib/access";
import { countClassesByGrade, listGradeLevelsForClasses } from "@/server/classes";
import { CreateClassForm, type CreateClassData } from "../create-class-form";

export const dynamic = "force-dynamic";

export default async function NewClassPage() {
  await requireModule("classes");

  const [gradeLevels, classCounts] = await Promise.all([
    listGradeLevelsForClasses(),
    countClassesByGrade(),
  ]);

  const data: CreateClassData = { gradeLevels, classCounts };

  return (
    <div className="max-w-3xl">
      <Link href="/classes" className="text-sm text-accent-strong hover:underline">
        ← Back to classes
      </Link>
      <h1 className="mt-2 text-xl font-bold text-foreground">Create class</h1>
      <p className="mt-1 text-sm text-muted">
        You will be the class adviser. Set up the subjects per term (T1, T2, T3) and enroll
        students on the class page afterward.
      </p>
      <div className="mt-6">
        <CreateClassForm data={data} />
      </div>
    </div>
  );
}
