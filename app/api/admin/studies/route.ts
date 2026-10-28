import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

const deny = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Create a study (e.g. Bangla). Optionally copies text/trait labels from an existing study.
export async function POST(req: Request) {
  if (!(await isAdmin())) return deny();
  const b = await req.json().catch(() => null);
  const slug = String(b?.slug ?? "").trim().toLowerCase();
  const name = String(b?.name ?? "").trim();
  const base = String(b?.baseLanguage ?? "").trim();
  const mix = String(b?.mixLanguage ?? "English").trim();
  const locale = String(b?.locale ?? "en").trim() || "en";
  if (!/^[a-z0-9-]{2,30}$/.test(slug) || !name || !base) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const db = sql();
  try {
    await db`INSERT INTO studies (slug, name, base_language, mix_language, locale, status, defaults_applied, research_questions_applied) VALUES (${slug}, ${name}, ${base}, ${mix}, ${locale}, 'draft', true, true)`;
  } catch {
    return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
  }
  // Start from the first study's questions; they can be edited on the Questions page.
  await db`
    INSERT INTO questions (study_id, position, kind, scope, prompt, scale_min, scale_max, low_label, high_label, required, options)
    SELECT (SELECT id FROM studies WHERE slug = ${slug}), position, kind, scope, prompt, scale_min, scale_max, low_label, high_label, required, options
    FROM questions WHERE study_id = (SELECT MIN(id) FROM studies WHERE slug <> ${slug})`;
  return NextResponse.json({ ok: true });
}

// Update status / texts.
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return deny();
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  if (!id) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const db = sql();
  if (["draft", "open", "closed"].includes(b.status)) await db`UPDATE studies SET status = ${b.status} WHERE id = ${id}`;
  if (typeof b.intro === "string") await db`UPDATE studies SET intro = ${b.intro.trim() || null} WHERE id = ${id}`;
  if (typeof b.debrief === "string") await db`UPDATE studies SET debrief = ${b.debrief.trim() || null} WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
