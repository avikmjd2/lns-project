import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { loadAdminCtx } from "@/lib/admin-ctx";
import { sql } from "@/lib/db";
import { SyncButton } from "@/components/admin/bits";
import { Badge, PageHeader, Panel, TableShell, td, th } from "@/components/admin/ui";
import { COMBOS, buildAssignment } from "@/lib/assign";
import { FILE_RE, RECORDINGS } from "@/lib/recordings";

export const dynamic = "force-dynamic";

type Clip = { id: number; label: string; blob_url: string };

export default async function Recordings({ searchParams }: { searchParams: Promise<{ study?: string }> }) {
  const ctx = await loadAdminCtx((await searchParams).study);
  if (!ctx.ok) return <p>Set up the database on the Overview page first.</p>;
  const db = sql();
  const clips = (await db`SELECT id, label, blob_url FROM clips WHERE study_id = ${ctx.study.id}`) as Clip[];
  const counts = (await db`
    SELECT form, listener_gender, COUNT(*)::int AS n FROM participants
    WHERE study_id = ${ctx.study.id} AND completed_at IS NOT NULL GROUP BY form, listener_gender`) as { form: string; listener_gender: string; n: number }[];
  const n = (f: string, g: string) => counts.find((c) => c.form === f && c.listener_gender === g)?.n ?? 0;

  const rows = RECORDINGS.map((r) => {
    const file = path.join(process.cwd(), "Recording", r.file);
    const onDisk = existsSync(file);
    const mb = onDisk ? statSync(file).size / (1024 * 1024) : 0;
    const clip = clips.find((c) => c.label === r.label && FILE_RE.test(c.blob_url));
    return { r, onDisk, mb, clip };
  });
  const ready = rows.every((x) => x.onDisk && x.clip);

  return (
    <div>
      <PageHeader title="Recordings" subtitle="The 8 clips are read from the Recording folder. Participants never see speaker, gender or style, and the audio is served by clip id." actions={<SyncButton studyId={ctx.study.id} />} />

      <div className={`mb-10 border-l-[3px] py-1 pl-5 ${ready ? "border-ink" : "border-signal"}`}>
        <p className={`label ${ready ? "!text-ink" : "!text-signal"}`}>{ready ? "Ready" : "Action needed"}</p>
        <p className="mt-1 text-[1.25rem] leading-snug">{ready ? "All 8 recordings are found and registered." : "Some recordings are missing."}</p>
        <p className="mt-1 text-muted">{ready ? "The form is ready to open." : "Put all 8 .mp4 files in the Recording folder (F1_H, F1_N, F2_H, F2_N, M1_H, M1_N, M2_H, M2_N), deploy, then click Sync recordings."}</p>
      </div>

      <Panel title="Files">
        <TableShell>
          <table className="w-full text-[0.95rem]">
            <thead><tr><th className={th}>File</th><th className={th}>Speaker</th><th className={th}>Style</th><th className={th}>On disk</th><th className={th}>Registered</th><th className={th}>Preview</th></tr></thead>
            <tbody>
              {rows.map(({ r, onDisk, mb, clip }) => (
                <tr key={r.label}>
                  <td className={`${td} numeral text-[13px]`}>{r.file}</td>
                  <td className={td}>{r.speakerId} <span className="text-muted">({r.gender})</span></td>
                  <td className={td}><Badge tone={r.guise === "mixed" ? "ink" : "signal"}>{r.guise === "mixed" ? "Hindi + English" : "Hindi only"}</Badge></td>
                  <td className={td}>{onDisk ? <>yes <span className={mb > 4 ? "text-signal" : "text-muted"}>({mb.toFixed(1)} MB{mb > 4 ? ", too big: convert to audio only" : ""})</span></> : <Badge tone="muted">missing</Badge>}</td>
                  <td className={td}>{clip ? "yes" : <Badge tone="muted">no</Badge>}</td>
                  <td className={td}>{clip && onDisk ? <audio controls preload="none" src={`/api/audio/${clip.id}`} className="h-9 w-56" /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </Panel>

      <Panel title="Clip combinations" description="Each listener hears one clip per speaker, with opposite styles inside the female pair and inside the male pair. Completed listeners per combination.">
        <TableShell>
          <table className="w-full text-[0.95rem]">
            <thead><tr><th className={th}>Combo</th><th className={th}>Clips</th><th className={th}>Male listeners</th><th className={th}>Female listeners</th></tr></thead>
            <tbody>
              {COMBOS.map((c) => (
                <tr key={c}>
                  <td className={`${td} numeral`}>{c}</td>
                  <td className={`${td} numeral text-[13px]`}>{buildAssignment(c).join(", ")}</td>
                  <td className={`${td} numeral`}>{n(c, "male")}</td>
                  <td className={`${td} numeral`}>{n(c, "female")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </Panel>
    </div>
  );
}
