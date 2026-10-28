import { NextResponse } from "next/server";
import { sql, getStudy } from "@/lib/db";
import { COMBOS, buildAssignment, pickCombo, shuffle, type Combo } from "@/lib/assign";
import { syncClips } from "@/lib/recordings";

export const dynamic = "force-dynamic";

type ClipRow = { id: number; label: string };

// Create a participant, assign one of 4 clip combinations (balanced within listener gender), return shuffled clips.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const slug = String(body?.slug ?? "");
  const gender = String(body?.gender ?? "");
  const age = Number(body?.age);
  const firstLanguage = String(body?.firstLanguage ?? "").trim().slice(0, 100);
  const repeatDevice = body?.repeatDevice === true;
  if (!["male", "female", "other", "na"].includes(gender) || !(age >= 18 && age <= 99) || !firstLanguage) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const study = await getStudy(slug);
  if (!study || study.status !== "open") {
    return NextResponse.json({ error: "Study closed" }, { status: 403 });
  }
  const db = sql();
  const counts = (await db`
    SELECT form, COUNT(*)::int AS n FROM participants
    WHERE study_id = ${study.id} AND listener_gender = ${gender}
      AND (completed_at IS NOT NULL OR started_at > now() - interval '30 minutes')
    GROUP BY form`) as { form: string; n: number }[];
  const tally = Object.fromEntries(COMBOS.map((c) => [c, counts.find((x) => x.form === c)?.n ?? 0])) as Record<Combo, number>;
  const combo = pickCombo(tally);
  const labels = buildAssignment(combo);

  // Register the 8 local recordings the first time (or whenever some are missing).
  const [reg] = (await db`SELECT COUNT(*)::int AS n FROM clips WHERE study_id = ${study.id} AND blob_url NOT LIKE 'http%'`) as { n: number }[];
  if (reg.n < 8) await syncClips(study.id);

  const clips = (await db`
    SELECT id, label FROM clips
    WHERE study_id = ${study.id} AND blob_url NOT LIKE 'http%' AND label = ANY(${labels}::text[])`) as ClipRow[];
  if (clips.length !== 4) return NextResponse.json({ error: "no_clips" }, { status: 409 });

  const ordered = shuffle(clips);
  const inserted = (await db`
    INSERT INTO participants (study_id, listener_gender, age, form, clip_order, first_language, repeat_device)
    VALUES (${study.id}, ${gender}, ${age}, ${combo}, ${JSON.stringify(ordered.map((c) => c.id))}::jsonb, ${firstLanguage}, ${repeatDevice})
    RETURNING id`) as { id: string }[];
  return NextResponse.json({
    participantId: inserted[0].id,
    clips: ordered.map((c) => ({ id: c.id, url: `/api/audio/${c.id}` })),
    done: [],
  });
}

// Resume: returns the participant's clip order and which clips are already rated.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const db = sql();
  const p = (await db`SELECT study_id, clip_order, completed_at FROM participants WHERE id = ${id}`) as {
    study_id: number; clip_order: number[]; completed_at: string | null;
  }[];
  if (!p[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  const clips = (await db`SELECT id, label FROM clips WHERE id = ANY(${p[0].clip_order}::int[])`) as ClipRow[];
  const byId = new Map(clips.map((c) => [c.id, c]));
  const done = (await db`SELECT clip_id FROM ratings WHERE participant_id = ${id}`) as { clip_id: number }[];
  return NextResponse.json({
    participantId: id,
    completed: !!p[0].completed_at,
    clips: p[0].clip_order.filter((cid) => byId.has(cid)).map((cid) => ({ id: cid, url: `/api/audio/${cid}` })),
    done: done.map((d) => d.clip_id),
  });
}
