import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getRatings, toCsv } from "@/lib/admin-data";
import { sql } from "@/lib/db";

// ?study=slug for one study; omit for all studies combined (cross-language comparison).
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const slug = new URL(req.url).searchParams.get("study");
  let studyId: number | undefined;
  if (slug) {
    const r = (await sql()`SELECT id FROM studies WHERE slug = ${slug}`) as { id: number }[];
    if (!r[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
    studyId = r[0].id;
  }
  const csv = toCsv(await getRatings(studyId));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ratings-${slug ?? "all"}.csv"`,
    },
  });
}
