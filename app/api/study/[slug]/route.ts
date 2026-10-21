import { NextResponse } from "next/server";
import { DEFAULT_TRAIT_LABELS, TRAITS, getStudy } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public study info. Deliberately exposes nothing about clips, guises or speaker gender.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const s = await getStudy(slug);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const labels = { ...DEFAULT_TRAIT_LABELS, ...(s.traits ?? {}) };
  return NextResponse.json({
    slug: s.slug,
    name: s.name,
    locale: s.locale,
    status: s.status,
    base_language: s.base_language,
    mix_language: s.mix_language,
    intro: s.intro,
    debrief: s.debrief,
    traits: TRAITS.map((k) => ({ key: k, label: labels[k] })),
  });
}
