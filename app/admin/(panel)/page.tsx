import { AudioLines, CheckCircle2, Download, ExternalLink, PlayCircle, Users } from "lucide-react";
import { loadAdminCtx } from "@/lib/admin-ctx";
import { sql } from "@/lib/db";
import { CopyButton, InitButton, NewStudyForm, StudyControls, btn, btn2 } from "@/components/admin/bits";
import { Badge, PageHeader, Panel, Stat } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function Overview({ searchParams }: { searchParams: Promise<{ study?: string }> }) {
  const ctx = await loadAdminCtx((await searchParams).study);
  if (!ctx.ok) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <Panel>
          <h1 className="font-display text-2xl font-semibold">{ctx.reason === "env" ? "Database not connected" : "Set up the database"}</h1>
          <p className="mb-5 mt-2 text-sm text-muted">{ctx.message}</p>
          {ctx.reason === "setup" && <InitButton />}
        </Panel>
      </div>
    );
  }
  const { study, studies } = ctx;
  const db = sql();
  const [counts] = (await db`
    SELECT COUNT(*)::int AS started, COUNT(completed_at)::int AS completed
    FROM participants WHERE study_id = ${study.id}`) as { started: number; completed: number }[];
  const [clipCount] = (await db`SELECT COUNT(*)::int AS n FROM clips WHERE study_id = ${study.id}`) as { n: number }[];
  const rate = counts.started ? Math.round((counts.completed / counts.started) * 100) : 0;
  const link = `/s/${study.slug}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={study.name}
        subtitle={<>{study.base_language} + {study.mix_language} study <Badge tone={study.status === "open" ? "brand" : "muted"}>{study.status}</Badge></>}
        actions={<><a className={btn2} href={link} target="_blank"><ExternalLink size={15} /> Open survey</a><a className={btn} href={`/api/admin/export?study=${study.slug}`}><Download size={15} /> Export CSV</a></>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<AudioLines size={20} />} label="Recordings" value={clipCount.n} />
        <Stat icon={<PlayCircle size={20} />} label="Started" value={counts.started} />
        <Stat icon={<CheckCircle2 size={20} />} label="Completed" value={counts.completed} />
        <Stat icon={<Users size={20} />} label="Completion rate" value={`${rate}%`} />
      </div>

      <Panel title="Participant link" description="Share this link. Participants can only join while the status is open.">
        <div className="flex flex-wrap items-center gap-3">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-line bg-card2 px-4 py-2.5 text-sm">{link}</code>
          <CopyButton text={link} />
        </div>
      </Panel>

      <Panel title="Study settings">
        <StudyControls key={study.id + study.status} study={study} />
      </Panel>

      <Panel title="Add another study" description={`${studies.length} stud${studies.length === 1 ? "y" : "ies"} so far. A new study (e.g. Bangla) starts as a draft with a copy of the first study's questions and its own recordings and participants.`}>
        <NewStudyForm />
      </Panel>
    </div>
  );
}
