import { sql, type Study } from "./db";
import { ensureSchema } from "./migrate";

export type AdminCtx =
  | { ok: true; studies: Study[]; study: Study }
  | { ok: false; reason: "setup" | "env"; message: string };

/** Loads studies and picks the one named by ?study=, defaulting to the first. */
export async function loadAdminCtx(slug?: string): Promise<AdminCtx> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, reason: "env", message: "DATABASE_URL is not set. Add the Neon integration on Vercel (or set it in .env.local)." };
  }
  try {
    await ensureSchema();
    const studies = (await sql()`SELECT * FROM studies ORDER BY id`) as Study[];
    if (!studies.length) return { ok: false, reason: "setup", message: "No studies yet." };
    return { ok: true, studies, study: studies.find((s) => s.slug === slug) ?? studies[0] };
  } catch (e) {
    return { ok: false, reason: "setup", message: (e as Error).message };
  }
}
