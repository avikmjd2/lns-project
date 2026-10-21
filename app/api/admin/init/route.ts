import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SCHEMA } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";

// Idempotent: creates tables and the default "hindi" study.
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = sql();
  for (const stmt of SCHEMA) await db.query(stmt);
  return NextResponse.json({ ok: true });
}
