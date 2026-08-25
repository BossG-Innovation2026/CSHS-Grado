import { queryOne, runSql } from "@/lib/db";

export const dynamic = "force-dynamic";

const SEED_KEY = "grado-admin-seed-2026";

export async function POST(request: Request) {
  const { key, email } = (await request.json()) as { key: string; email: string };

  if (key !== SEED_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await queryOne<{ id: string; role: string }>(
    "SELECT id, role FROM user WHERE email = ?",
    email
  );

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const allModules = ["accounts", "curriculum", "classes", "grades_submit", "grades_approve", "registrar", "codes"];

  await runSql(
    "UPDATE user SET role = 'super_admin', permissions = ? WHERE email = ?",
    JSON.stringify(allModules),
    email
  );

  return Response.json({ ok: true, message: `${email} promoted to Super Admin` });
}
