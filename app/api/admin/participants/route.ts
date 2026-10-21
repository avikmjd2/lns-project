import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

// Delete a participant (and their ratings) or all participants of a study (clear test data).
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = new URL(req.url);
  const id = u.searchParams.get("id");
  const studyId = Number(u.searchParams.get("studyId"));
  const db = sql();
  if (id && /^[0-9a-f-]{36}$/i.test(id)) await db`DELETE FROM participants WHERE id = ${id}`;
  else if (studyId && u.searchParams.get("all") === "1") await db`DELETE FROM participants WHERE study_id = ${studyId}`;
  else return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
