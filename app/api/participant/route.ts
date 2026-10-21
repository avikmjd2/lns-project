import { NextResponse } from "next/server";
import { sql, getStudy } from "@/lib/db";
import { pickForm, shuffle } from "@/lib/assign";

export const dynamic = "force-dynamic";

type ClipRow = { id: number; blob_url: string };

// Create a participant, assign a form (balanced within listener gender), return shuffled clips.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const slug = String(body?.slug ?? "");
  const gender = String(body?.gender ?? "");
  const age = Number(body?.age);
  if (!["male", "female", "other", "na"].includes(gender) || !(age >= 18 && age <= 99)) {
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
  const nA = counts.find((c) => c.form === "A")?.n ?? 0;
  const nB = counts.find((c) => c.form === "B")?.n ?? 0;
  const form = pickForm(nA, nB);

  const clips = (form === "A"
    ? await db`SELECT id, blob_url FROM clips WHERE study_id = ${study.id} AND form_a`
    : await db`SELECT id, blob_url FROM clips WHERE study_id = ${study.id} AND form_b`) as ClipRow[];
  if (clips.length === 0) return NextResponse.json({ error: "no_clips" }, { status: 409 });

  const ordered = shuffle(clips);
  const inserted = (await db`
    INSERT INTO participants (study_id, listener_gender, age, form, clip_order)
    VALUES (${study.id}, ${gender}, ${age}, ${form}, ${JSON.stringify(ordered.map((c) => c.id))}::jsonb)
    RETURNING id`) as { id: string }[];
  return NextResponse.json({
    participantId: inserted[0].id,
    clips: ordered.map((c) => ({ id: c.id, url: c.blob_url })),
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
  const clips = (await db`SELECT id, blob_url FROM clips WHERE id = ANY(${p[0].clip_order}::int[])`) as ClipRow[];
  const byId = new Map(clips.map((c) => [c.id, c]));
  const done = (await db`SELECT clip_id FROM ratings WHERE participant_id = ${id}`) as { clip_id: number }[];
  return NextResponse.json({
    participantId: id,
    completed: !!p[0].completed_at,
    clips: p[0].clip_order.filter((cid) => byId.has(cid)).map((cid) => ({ id: cid, url: byId.get(cid)!.blob_url })),
    done: done.map((d) => d.clip_id),
  });
}
