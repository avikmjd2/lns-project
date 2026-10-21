import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const pid = String(b?.participantId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(pid)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const db = sql();
  // Complete only if every assigned clip has a rating.
  const rows = (await db`
    UPDATE participants p SET completed_at = COALESCE(completed_at, now())
    WHERE p.id = ${pid}
      AND (SELECT COUNT(*) FROM ratings r WHERE r.participant_id = p.id) >= jsonb_array_length(p.clip_order)
    RETURNING id`) as unknown[];
  if (!rows.length) return NextResponse.json({ error: "incomplete" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
