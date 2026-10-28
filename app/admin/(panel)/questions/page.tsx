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
  const key = (q: (typeof qs)[number]) => `${q.id}-${q.prompt}-${q.scope}-${q.required}-${String(q.clip_ids)}`;

  return (
    <div>
      <PageHeader
        title="Questions"
        subtitle="Participants hear a recording, then answer its questions one at a time. A question can be asked for every recording or only the ones you pick, so you never need to copy it. Scale questions feed the Results charts; free-text answers appear in Responses and the CSV."
      />

      <details className="group border-b border-ink pb-6" open={qs.length === 0}>
        <summary className="flex cursor-pointer list-none items-center justify-between py-1">
          <span className="text-[1.45rem] font-medium tracking-[-0.01em]">Add a question</span>
          <span className="label group-open:hidden">Open +</span><span className="label hidden group-open:inline">Close −</span>
        </summary>
        <div className="mt-6"><QuestionForm studyId={study.id} clips={clips} /></div>
      </details>

      <Panel className="!mt-10" title={`After a recording (${clipQs.length})`}>
        <ul className="border-t border-ink">
          {clipQs.length === 0 && <li className="border-b border-rule py-6 text-muted">No per-recording questions yet. Participants would just listen.</li>}
          {clipQs.map((q, i) => <QuestionRow key={key(q)} q={q} n={nOf(q.id)} clips={clips} index={i + 1} />)}
        </ul>
      </Panel>
      <Panel title={`Once, at the end (${finalQs.length})`}>
        <ul className="border-t border-ink">
          {finalQs.length === 0 && <li className="border-b border-rule py-6 text-muted">None. Add one for general feedback or demographics.</li>}
          {finalQs.map((q, i) => <QuestionRow key={key(q)} q={q} n={nOf(q.id)} clips={clips} index={i + 1} />)}
        </ul>
      </Panel>
      <p className="label mt-8">The type and scale range of a question are fixed once created. Delete and re-add to change them, so collected answers keep their meaning.</p>
    </div>
  );
}
