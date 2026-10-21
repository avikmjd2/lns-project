import { Plus } from "lucide-react";
import { loadAdminCtx } from "@/lib/admin-ctx";
import { sql, getQuestions } from "@/lib/db";
import { QuestionForm, QuestionRow } from "@/components/admin/bits";
import { PageHeader, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function Questions({ searchParams }: { searchParams: Promise<{ study?: string }> }) {
  const ctx = await loadAdminCtx((await searchParams).study);
  if (!ctx.ok) return <p>Set up the database on the Overview page first.</p>;
  const { study } = ctx;
  const qs = await getQuestions(study.id);
  const clipRows = (await sql()`SELECT id, speaker_id, guise FROM clips WHERE study_id = ${study.id} ORDER BY speaker_id, guise`) as
    { id: number; speaker_id: string; guise: string }[];
  const clips = clipRows.map((c) => ({ id: c.id, label: `${c.speaker_id} · ${c.guise === "mixed" ? "code-mixed" : "pure"}` }));
  const counts = (await sql()`
    SELECT question_id, COUNT(*)::int AS n FROM answers
    WHERE question_id = ANY(${qs.map((q) => q.id)}::int[]) GROUP BY question_id`) as { question_id: number; n: number }[];
  const nOf = (id: number) => counts.find((c) => c.question_id === id)?.n ?? 0;
  const clipQs = qs.filter((q) => q.scope === "clip"), finalQs = qs.filter((q) => q.scope === "final");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Questions"
        subtitle="Participants hear a recording, then answer its questions one at a time. A question can be asked for every recording or only the ones you pick, so you never need to copy it. Scale questions feed the Results charts; free-text answers appear in Responses and the CSV."
      />

      <details className="surface group rounded-2xl" open={qs.length === 0}>
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-semibold sm:px-6"><Plus size={18} className="text-brand transition group-open:rotate-45" /> Add a question</summary>
        <div className="border-t border-line p-4 sm:p-6"><QuestionForm studyId={study.id} clips={clips} /></div>
      </details>

      <section>
        <h2 className="mb-3 text-base font-semibold">After a recording <span className="font-normal text-muted">({clipQs.length})</span></h2>
        <ul className="space-y-3">
          {clipQs.length === 0 && <li className="surface rounded-2xl p-6 text-center text-sm text-muted">No per-recording questions yet. Participants would just listen.</li>}
          {clipQs.map((q, i) => <QuestionRow key={`${q.id}-${q.prompt}-${q.scope}-${q.required}-${String(q.clip_ids)}`} q={q} n={nOf(q.id)} clips={clips} index={i + 1} />)}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 text-base font-semibold">Once, at the end <span className="font-normal text-muted">({finalQs.length})</span></h2>
        <ul className="space-y-3">
          {finalQs.length === 0 && <li className="surface rounded-2xl p-6 text-center text-sm text-muted">None. Add one for general feedback or demographics.</li>}
          {finalQs.map((q, i) => <QuestionRow key={`${q.id}-${q.prompt}-${q.scope}-${q.required}-${String(q.clip_ids)}`} q={q} n={nOf(q.id)} clips={clips} index={i + 1} />)}
        </ul>
      </section>
      <Panel className="!bg-card2 !shadow-none"><p className="text-sm text-muted">The type and scale range of a question are fixed once created (delete and re-add to change them) so collected answers keep their meaning.</p></Panel>
    </div>
  );
}
