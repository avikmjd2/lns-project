import { NextResponse } from "next/server";
import { sql, getQuestions, validateAnswer } from "@/lib/db";

export const dynamic = "force-dynamic";

// Finish the survey. Optionally carries the answers to the end-of-survey (scope "final") questions.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const pid = String(b?.participantId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(pid)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const db = sql();
  const p = (await db`SELECT study_id FROM participants WHERE id = ${pid}`) as { study_id: number }[];
  if (!p.length) return NextResponse.json({ error: "not found" }, { status: 404 });

  const finals = (await getQuestions(p[0].study_id)).filter((q) => q.scope === "final");
  if (b?.answers && typeof b.answers === "object") {
    const writes = [];
    for (const q of finals) {
      const r = validateAnswer(q, (b.answers as Record<string, unknown>)[String(q.id)]);
      if (r === "missing" || r === "invalid") return NextResponse.json({ error: r, questionId: q.id }, { status: 400 });
      if (r.num === null && r.text === null) continue;
      writes.push(db`INSERT INTO answers (participant_id, clip_id, question_id, num_value, text_value)
                     VALUES (${pid}, NULL, ${q.id}, ${r.num}, ${r.text})`);
    }
    await db.transaction([db`DELETE FROM answers WHERE participant_id = ${pid} AND clip_id IS NULL`, ...writes]);
  }
  // Every required final question must have an answer on file.
  for (const q of finals.filter((x) => x.required)) {
    const have = (await db`SELECT 1 FROM answers WHERE participant_id = ${pid} AND question_id = ${q.id}`) as unknown[];
    if (!have.length) return NextResponse.json({ error: "missing", questionId: q.id }, { status: 400 });
  }
  // Complete only if every assigned clip has been answered.
  const rows = (await db`
    UPDATE participants p SET completed_at = COALESCE(completed_at, now())
    WHERE p.id = ${pid}
      AND (SELECT COUNT(*) FROM ratings r WHERE r.participant_id = p.id) >= jsonb_array_length(p.clip_order)
    RETURNING id`) as unknown[];
  if (!rows.length) return NextResponse.json({ error: "incomplete" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
