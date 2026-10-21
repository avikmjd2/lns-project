import { loadAdminCtx } from "@/lib/admin-ctx";
import { sql, getQuestions } from "@/lib/db";
import { QuestionForm, QuestionRow } from "@/components/admin/bits";

export const dynamic = "force-dynamic";

export default async function Questions({ searchParams }: { searchParams: Promise<{ study?: string }> }) {
  const ctx = await loadAdminCtx((await searchParams).study);
  if (!ctx.ok) return <p>Set up the database on the Overview page first.</p>;
  const { study } = ctx;
  const qs = await getQuestions(study.id);
  const clipRows = (await sql()`SELECT id, label, speaker_id, speaker_gender, guise FROM clips WHERE study_id = ${study.id} ORDER BY speaker_id, guise`) as
    { id: number; label: string; speaker_id: string; speaker_gender: string; guise: string }[];
  const clips = clipRows.map((c) => ({ id: c.id, label: `${c.speaker_id} · ${c.guise === "mixed" ? "code-mixed" : "pure"}` }));
  const counts = (await sql()`
    SELECT question_id, COUNT(*)::int AS n FROM answers
    WHERE question_id = ANY(${qs.map((q) => q.id)}::int[]) GROUP BY question_id`) as { question_id: number; n: number }[];
  const nOf = (id: number) => counts.find((c) => c.question_id === id)?.n ?? 0;
  const clipQs = qs.filter((q) => q.scope === "clip"), finalQs = qs.filter((q) => q.scope === "final");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Questions · {study.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Scale questions can use any range from 2 to 11 points (1–5, 1–10, 0–10…). Descriptive questions take free text.
          Each question is asked after a recording: for every clip, or only the clips you tick, so you can reuse one question across all recordings or give some recordings their own. “At the end” questions are asked once. The kind and range of a question can’t be changed after creating it
          (delete and re-add instead) so collected answers keep their meaning. Only scale questions are used in the Results charts and tests; text answers appear in the CSV and on the Responses page.
        </p>
      </div>
      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-3 font-semibold">Add a question</h2>
        <QuestionForm studyId={study.id} clips={clips} />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">After a recording ({clipQs.length})</h2>
        <ul className="space-y-3">
          {clipQs.length === 0 && <li className="text-sm text-muted">None yet. Participants would listen without answering anything.</li>}
          {clipQs.map((q) => <QuestionRow key={q.id + q.prompt + q.scope + q.required + String(q.clip_ids)} q={q} n={nOf(q.id)} clips={clips} />)}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Once, at the end ({finalQs.length})</h2>
        <ul className="space-y-3">
          {finalQs.length === 0 && <li className="text-sm text-muted">None.</li>}
          {finalQs.map((q) => <QuestionRow key={q.id + q.prompt + q.scope + q.required + String(q.clip_ids)} q={q} n={nOf(q.id)} clips={clips} />)}
        </ul>
      </section>
    </div>
  );
}
