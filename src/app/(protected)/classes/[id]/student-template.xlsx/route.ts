import { requireModule } from "@/lib/access";
import { buildWorkbook, XLSX_MIME } from "@/server/spreadsheet";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireModule("classes");
  const file = buildWorkbook("Students", [
    ["LRN", "Surname", "Firstname", "Middlename", "Sex"],
    ["123456789012", "Doe", "John", "A.", "M"],
  ]);
  return new Response(file, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": 'attachment; filename="students_template.xlsx"',
    },
  });
}
