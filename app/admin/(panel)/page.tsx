import { loadAdminCtx } from "@/lib/admin-ctx";
import { sql } from "@/lib/db";
import { InitButton, NewStudyForm, StudyControls } from "@/components/admin/bits";

export const dynamic = "force-dynamic";

export default async function Overview({ searchParams }: { searchParams: Promise<{ study?: string }> }) {
  const ctx = await loadAdminCtx((await searchParams).study);
  if (!ctx.ok) {
    return (
      <div className="rounded-2xl border border-line bg-card p-6">
        <h1 className="text-xl font-semibold">{ctx.reason === "env" ? "Database not connected" : "Set up the database"}</h1>
        <p className="mt-2 text-sm text-muted">{ctx.message}</p>
        {ctx.reason === "setup" && <div className="mt-4"><InitButton /></div>}
      </div>
    );
  }
  const { study, studies } = ctx;
  const db = sql();
  const [counts] = (await db`
    SELECT COUNT(*)::int AS started, COUNT(completed_at)::int AS completed
    FROM participants WHERE study_id = ${study.id}`) as { started: number; completed: number }[];
  const [clipCount] = (await db`SELECT COUNT(*)::int AS n FROM clips WHERE study_id = ${study.id}`) as { n: number }[];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">{study.name}</h1>
        <p className="mt-1 text-sm text-muted">{study.base_language} + {study.mix_language} · participant link: <code className="rounded bg-brand-soft px-1.5 py-0.5">/s/{study.slug}</code></p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Clips uploaded" value={clipCount.n} />
          <Stat label="Started" value={counts.started} />
          <Stat label="Completed" value={counts.completed} />
        </div>
      </section>
      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-3 font-semibold">Study settings</h2>
        <StudyControls key={study.id + study.status} study={study} />
        {study.status !== "open" && <p className="mt-3 text-sm text-accent">Participants can only take part when status is “open”.</p>}
      </section>
      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-3 font-semibold">Add another study (e.g. Bangla)</h2>
        <p className="mb-3 text-sm text-muted">{studies.length} stud{studies.length === 1 ? "y" : "ies"} so far. New studies start as drafts with their own clips and participants.</p>
        <NewStudyForm />
      </section>
      <section className="text-sm text-muted">
        <a className="underline" href="/api/admin/export">Download all studies as CSV</a>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}
