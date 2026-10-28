import { NextResponse } from "next/server";
import { getQuestions, getStudy } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public study info. Deliberately exposes nothing about clips, guises or speaker gender.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const s = await getStudy(slug);
    if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
    const questions = await getQuestions(s.id);
    return NextResponse.json({
      slug: s.slug,
      name: s.name,
      locale: s.locale,
      status: s.status,
      base_language: s.base_language,
      mix_language: s.mix_language,
      intro: s.intro,
      debrief: s.debrief,
      questions: questions.map((q) => ({
        id: q.id, kind: q.kind, scope: q.scope, prompt: q.prompt, min: q.scale_min, max: q.scale_max,
        low: q.low_label, high: q.high_label, required: q.required, clipIds: q.clip_ids, options: q.options,
      })),
    }, {
      // Identical for every participant: let the CDN absorb a burst of visitors (changes show within ~15 s).
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" },
    });
  } catch (e) {
    // Most common cause: the database tables have not been created yet (Admin > Set up database).
    return NextResponse.json({ error: "server", detail: (e as Error).message }, { status: 500 });
  }
}
