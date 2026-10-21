import { NextResponse } from "next/server";
import { sql, getQuestions, validateAnswer, appliesToClip } from "@/lib/db";

export const dynamic = "force-dynamic";

// Save the answers to the per-clip questions for one clip (idempotent: replaces earlier answers).
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const pid = String(b?.participantId ?? "");
  const clipId = Number(b?.clipId);
  const given: Record<string, unknown> = b?.answers && typeof b.answers === "object" ? b.answers : {};
  if (!/^[0-9a-f-]{36}$/i.test(pid) || !Number.isInteger(clipId)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const played = Math.max(0, Math.min(100, Math.round(Number(b?.playedPct) || 0)));
  const db = sql();
  // Only allow clips that belong to this participant's assigned order.
  const p = (await db`SELECT study_id FROM participants WHERE id = ${pid} AND clip_order @> ${JSON.stringify([clipId])}::jsonb`) as { study_id: number }[];
  if (!p.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const questions = (await getQuestions(p[0].study_id)).filter((q) => appliesToClip(q, clipId));
  const writes = [];
  for (const q of questions) {
    const r = validateAnswer(q, given[String(q.id)]);
    if (r === "missing" || r === "invalid") return NextResponse.json({ error: r, questionId: q.id }, { status: 400 });
    if (r.num === null && r.text === null) continue;
    writes.push(db`INSERT INTO answers (participant_id, clip_id, question_id, num_value, text_value)
                   VALUES (${pid}, ${clipId}, ${q.id}, ${r.num}, ${r.text})`);
  }
  await db.transaction([
    db`DELETE FROM answers WHERE participant_id = ${pid} AND clip_id = ${clipId}`,
    ...writes,
    db`INSERT INTO ratings (participant_id, clip_id, played_pct) VALUES (${pid}, ${clipId}, ${played})
       ON CONFLICT (participant_id, clip_id) DO UPDATE SET played_pct = EXCLUDED.played_pct, rated_at = now()`,
  ]);
  return NextResponse.json({ ok: true });
}
