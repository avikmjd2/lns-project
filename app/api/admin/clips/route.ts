import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

const deny = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Register an already-uploaded blob as a clip.
export async function POST(req: Request) {
  if (!(await isAdmin())) return deny();
  const b = await req.json().catch(() => null);
  const studyId = Number(b?.studyId);
  const speakerGender = String(b?.speakerGender);
  const guise = String(b?.guise);
  const speakerId = String(b?.speakerId ?? "").trim();
  const label = String(b?.label ?? "").trim();
  const url = String(b?.url ?? "");
  if (!studyId || !speakerId || !label || !url.startsWith("https://") || !["male", "female"].includes(speakerGender) || !["mixed", "pure"].includes(guise)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const formA = !!b?.formA, formB = !!b?.formB;
  const rows = await sql()`
    INSERT INTO clips (study_id, label, speaker_id, speaker_gender, guise, form_a, form_b, blob_url)
    VALUES (${studyId}, ${label}, ${speakerId}, ${speakerGender}, ${guise}, ${formA}, ${formB}, ${url})
    RETURNING id`;
  return NextResponse.json({ ok: true, id: rows[0].id });
}

// Edit metadata / form membership.
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return deny();
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  if (!id) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const db = sql();
  if (typeof b.formA === "boolean") await db`UPDATE clips SET form_a = ${b.formA} WHERE id = ${id}`;
  if (typeof b.formB === "boolean") await db`UPDATE clips SET form_b = ${b.formB} WHERE id = ${id}`;
  if (typeof b.label === "string" && b.label.trim()) await db`UPDATE clips SET label = ${b.label.trim()} WHERE id = ${id}`;
  if (typeof b.speakerId === "string" && b.speakerId.trim()) await db`UPDATE clips SET speaker_id = ${b.speakerId.trim()} WHERE id = ${id}`;
  if (["male", "female"].includes(b.speakerGender)) await db`UPDATE clips SET speaker_gender = ${b.speakerGender} WHERE id = ${id}`;
  if (["mixed", "pure"].includes(b.guise)) await db`UPDATE clips SET guise = ${b.guise} WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

// Delete the clip, its ratings (cascade) and the stored audio file.
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return deny();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const db = sql();
  const rows = (await db`DELETE FROM clips WHERE id = ${id} RETURNING blob_url`) as { blob_url: string }[];
  if (rows[0]) { try { await del(rows[0].blob_url); } catch {} }
  return NextResponse.json({ ok: true });
}
