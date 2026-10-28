import { ArrowUpRight, Download } from "lucide-react";
import { loadAdminCtx } from "@/lib/admin-ctx";
import { sql } from "@/lib/db";
import { CopyButton, InitButton, NewStudyForm, StudyControls, btn, btn2 } from "@/components/admin/bits";
import { Badge, PageHeader, Panel, Stats } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function Overview({ searchParams }: { searchParams: Promise<{ study?: string }> }) {
  const ctx = await loadAdminCtx((await searchParams).study);
  if (!ctx.ok) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <p className="label !text-signal">Setup</p>
        <h1 className="mt-2 text-[2rem] font-medium leading-tight">{ctx.reason === "env" ? "Database not connected" : "Set up the database"}</h1>
        <p className="mb-6 mt-3 text-muted">{ctx.message}</p>
        {ctx.reason === "setup" && <InitButton />}
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
    <div>
      <PageHeader
        title={study.name}
        subtitle={<>{study.base_language} + {study.mix_language} &nbsp;<Badge tone={study.status === "open" ? "ink" : "muted"}>{study.status}</Badge></>}
        actions={<><a className={btn2} href={link} target="_blank">Open survey <ArrowUpRight size={13} /></a><a className={btn} href={`/api/admin/export?study=${study.slug}`}><Download size={14} /> Export CSV</a></>}
      />

      <Stats items={[
        { label: "Recordings", value: clipCount.n },
        { label: "Started", value: counts.started },
        { label: "Completed", value: counts.completed },
        { label: "Completion", value: `${rate}%` },
      ]} />

      <Panel className="!mt-12" title="Participant link" description="Share this link. Participants can only join while the status is open.">
        <div className="flex flex-wrap items-center gap-3">
          <code className="numeral min-w-0 flex-1 truncate border border-rule bg-panel px-4 py-2.5 text-[14px]">{link}</code>
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
