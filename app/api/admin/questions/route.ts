import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

const deny = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// null/undefined = all clips; otherwise a non-empty list of clip ids.
function parseClipIds(v: unknown): number[] | null | "bad" {
  if (v === null || v === undefined) return null;
  if (!Array.isArray(v) || v.length === 0 || v.some((x) => !Number.isInteger(x))) return "bad";
  return v as number[];
}
const bad = (m = "Invalid input") => NextResponse.json({ error: m }, { status: 400 });

export async function POST(req: Request) {
  if (!(await isAdmin())) return deny();
  const b = await req.json().catch(() => null);
  const studyId = Number(b?.studyId);
  const prompt = String(b?.prompt ?? "").trim();
  const kind = String(b?.kind);
  const scope = String(b?.scope ?? "clip");
  if (!studyId || !prompt || prompt.length > 300 || !["scale", "text"].includes(kind) || !["clip", "final"].includes(scope)) return bad();
  let min = 1, max = 5;
  if (kind === "scale") {
    min = Number(b?.scaleMin); max = Number(b?.scaleMax);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 11 || max - min < 1 || max - min > 10) {
      return bad("Scale must have 2 to 11 points (e.g. 1-5, 1-10, 0-10)");
    }
  }
  const low = String(b?.low ?? "").trim() || null;
  const high = String(b?.high ?? "").trim() || null;
  const required = b?.required !== false;
  const clipIds = scope === "clip" ? parseClipIds(b?.clipIds) : null;
  if (clipIds === "bad") return bad("Pick at least one clip, or choose all clips");
  const db = sql();
  const pos = (await db`SELECT COALESCE(MAX(position), 0) + 1 AS n FROM questions WHERE study_id = ${studyId}`) as { n: number }[];
  const rows = await db`
    INSERT INTO questions (study_id, position, kind, scope, prompt, scale_min, scale_max, low_label, high_label, required, clip_ids)
    VALUES (${studyId}, ${pos[0].n}, ${kind}, ${scope}, ${prompt}, ${min}, ${max}, ${kind === "scale" ? low : null}, ${kind === "scale" ? high : null}, ${required}, ${clipIds}::int[])
    RETURNING id`;
  return NextResponse.json({ ok: true, id: rows[0].id });
}

// Editable after creation: wording, labels, required, scope, order. Kind and scale range are fixed
// (delete and re-create instead) so collected answers never change meaning.
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return deny();
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  if (!id) return bad();
  const db = sql();
  if (typeof b.prompt === "string" && b.prompt.trim()) await db`UPDATE questions SET prompt = ${b.prompt.trim().slice(0, 300)} WHERE id = ${id}`;
  if (typeof b.low === "string") await db`UPDATE questions SET low_label = ${b.low.trim() || null} WHERE id = ${id} AND kind = 'scale'`;
  if (typeof b.high === "string") await db`UPDATE questions SET high_label = ${b.high.trim() || null} WHERE id = ${id} AND kind = 'scale'`;
  if (typeof b.required === "boolean") await db`UPDATE questions SET required = ${b.required} WHERE id = ${id}`;
  if (["clip", "final"].includes(b.scope)) {
    await db`UPDATE questions SET scope = ${b.scope} WHERE id = ${id}`;
    if (b.scope === "final") await db`UPDATE questions SET clip_ids = NULL WHERE id = ${id}`;
  }
  if ("clipIds" in b) {
    const ids = parseClipIds(b.clipIds);
    if (ids === "bad") return bad("Pick at least one clip, or choose all clips");
    await db`UPDATE questions SET clip_ids = ${ids}::int[] WHERE id = ${id} AND scope = 'clip'`;
  }
  if (b.move === "up" || b.move === "down") {
    // Swap position with the neighbour in the same study.
    const me = (await db`SELECT study_id, position FROM questions WHERE id = ${id}`) as { study_id: number; position: number }[];
    if (me[0]) {
      const nb = (b.move === "up"
        ? await db`SELECT id, position FROM questions WHERE study_id = ${me[0].study_id} AND (position, id) < (${me[0].position}, ${id}) ORDER BY position DESC, id DESC LIMIT 1`
        : await db`SELECT id, position FROM questions WHERE study_id = ${me[0].study_id} AND (position, id) > (${me[0].position}, ${id}) ORDER BY position, id LIMIT 1`) as { id: number; position: number }[];
      if (nb[0]) {
        // Equal positions are possible; renumber the pair distinctly.
        const lo = Math.min(me[0].position, nb[0].position), hi = lo + 1;
        const [first, second] = b.move === "up" ? [id, nb[0].id] : [nb[0].id, id];
        await db.transaction([
          db`UPDATE questions SET position = ${lo} WHERE id = ${first}`,
          db`UPDATE questions SET position = ${hi} WHERE id = ${second}`,
        ]);
      }
    }
  }
  return NextResponse.json({ ok: true });
}

// Deletes the question and every answer given to it.
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return deny();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return bad();
  await sql()`DELETE FROM questions WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
