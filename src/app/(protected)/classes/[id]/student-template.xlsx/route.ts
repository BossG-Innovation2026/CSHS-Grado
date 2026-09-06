import { requireModule } from "@/lib/access";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireModule("classes");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["LRN", "Surname", "Firstname", "Middlename", "Sex"],
    ["1234567890", "Doe", "John", "A.", "M"],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="students_template.xlsx"',
    },
  });
}
