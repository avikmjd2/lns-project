import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "@/lib/db";
import { FILE_RE } from "@/lib/recordings";
import { serveAudio } from "@/lib/serve-audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams a recording by clip id so participants never see the filename (which reveals speaker and style).
export async function GET(req: Request, ctx: { params: Promise<{ clipId: string }> }) {
  const { clipId } = await ctx.params;
  const id = Number(clipId);
  const notFound = () => new Response("Not found", { status: 404 });
  if (!Number.isInteger(id) || id <= 0) return notFound();
  const rows = (await sql()`SELECT blob_url FROM clips WHERE id = ${id}`) as { blob_url: string }[];
  const file = rows[0]?.blob_url;
  if (!file || !FILE_RE.test(file)) return notFound();
  let buf: Buffer;
  try {
    buf = await readFile(path.join(process.cwd(), "Recording", file));
  } catch {
    return notFound();
  }
  return serveAudio(buf, req.headers.get("range"));
}
