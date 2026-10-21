import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getFinalAnswers, getRatings, toCsv } from "@/lib/admin-data";
import { sql, type Question } from "@/lib/db";

// ?study=slug for one study; omit for all studies combined (cross-language comparison).
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const slug = new URL(req.url).searchParams.get("study");
  const db = sql();
  let studyId: number | undefined;
  if (slug) {
    const r = (await db`SELECT id FROM studies WHERE slug = ${slug}`) as { id: number }[];
    if (!r[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
    studyId = r[0].id;
  }
  const questions = (studyId
    ? await db`SELECT * FROM questions WHERE study_id = ${studyId} ORDER BY position, id`
    : await db`SELECT * FROM questions ORDER BY study_id, position, id`) as Question[];
  const csv = toCsv(await getRatings(studyId, questions), questions, await getFinalAnswers(studyId));
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="responses-${slug ?? "all"}.csv"`,
    },
  });
}
