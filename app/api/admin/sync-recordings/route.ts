import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { syncClips } from "@/lib/recordings";
import { applyStudyQuestions } from "@/lib/default-questions";

// Registers the 8 recordings from the /Recording folder as clips of a study (idempotent),
// and installs the study questions if the original defaults are still untouched.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const studyId = Number(b?.studyId);
  if (!studyId) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const clips = await syncClips(studyId);
  await applyStudyQuestions();
  return NextResponse.json({ ok: true, count: clips.length });
}
