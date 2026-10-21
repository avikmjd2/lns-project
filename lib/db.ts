import { neon } from "@neondatabase/serverless";

export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export const TRAITS = ["friendly", "likable", "like_me", "educated", "confident"] as const;
export type Trait = (typeof TRAITS)[number];

export const DEFAULT_TRAIT_LABELS: Record<Trait, string> = {
  friendly: "Friendly",
  likable: "Likable",
  like_me: "Someone like me",
  educated: "Educated",
  confident: "Confident",
};

export type Study = {
  id: number;
  slug: string;
  name: string;
  base_language: string;
  mix_language: string;
  locale: string;
  status: string;
  intro: string | null;
  debrief: string | null;
  traits: Partial<Record<Trait, string>> | null;
};

export async function getStudy(slug: string): Promise<Study | null> {
  const rows = (await sql()`SELECT * FROM studies WHERE slug = ${slug}`) as Study[];
  return rows[0] ?? null;
}
