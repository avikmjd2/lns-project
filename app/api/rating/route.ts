import { NextResponse } from "next/server";
import { sql, TRAITS } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const pid = String(b?.participantId ?? "");
  const clipId = Number(b?.clipId);
  const s = b?.scores ?? {};
  const vals = TRAITS.map((t) => Number(s[t]));
  if (!/^[0-9a-f-]{36}$/i.test(pid) || !Number.isInteger(clipId) || vals.some((v) => !Number.isInteger(v) || v < 1 || v > 5)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const played = Math.max(0, Math.min(100, Math.round(Number(b?.playedPct) || 0)));
  const [friendly, likable, like_me, educated, confident] = vals;
  const db = sql();
  // Only allow clips that belong to this participant's assigned order.
  const ok = (await db`SELECT 1 FROM participants WHERE id = ${pid} AND clip_order @> ${JSON.stringify([clipId])}::jsonb`) as unknown[];
  if (!ok.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await db`
    INSERT INTO ratings (participant_id, clip_id, friendly, likable, like_me, educated, confident, played_pct)
    VALUES (${pid}, ${clipId}, ${friendly}, ${likable}, ${like_me}, ${educated}, ${confident}, ${played})
    ON CONFLICT (participant_id, clip_id) DO UPDATE SET
      friendly = EXCLUDED.friendly, likable = EXCLUDED.likable, like_me = EXCLUDED.like_me,
      educated = EXCLUDED.educated, confident = EXCLUDED.confident, played_pct = EXCLUDED.played_pct,
      rated_at = now()`;
  return NextResponse.json({ ok: true });
}
