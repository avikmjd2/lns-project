import { Download, MessageSquareText } from "lucide-react";
import { loadAdminCtx } from "@/lib/admin-ctx";
import { sql } from "@/lib/db";
import { DeleteParticipant, btn } from "@/components/admin/bits";
import { Badge, PageHeader, Panel, TableShell, td, th } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type P = { id: string; listener_gender: string; age: number | null; form: string; started_at: string; completed_at: string | null; n_rated: number; n_total: number };

export default async function Responses({ searchParams }: { searchParams: Promise<{ study?: string }> }) {
  const ctx = await loadAdminCtx((await searchParams).study);
  if (!ctx.ok) return <p>Set up the database on the Overview page first.</p>;
  const { study } = ctx;
  const db = sql();
  const rows = (await db`
    SELECT p.id, p.listener_gender, p.age, p.form, p.started_at, p.completed_at,
           (SELECT COUNT(*)::int FROM ratings r WHERE r.participant_id = p.id) AS n_rated,
           jsonb_array_length(p.clip_order) AS n_total
    FROM participants p WHERE p.study_id = ${study.id} ORDER BY p.started_at DESC`) as P[];
  const texts = (await db`
    SELECT a.text_value, q.prompt, q.scope, c.label AS clip_label
    FROM answers a JOIN questions q ON q.id = a.question_id JOIN participants p ON p.id = a.participant_id
    LEFT JOIN clips c ON c.id = a.clip_id
    WHERE p.study_id = ${study.id} AND p.completed_at IS NOT NULL AND a.text_value IS NOT NULL
    ORDER BY q.position, a.answered_at DESC`) as { text_value: string; prompt: string; scope: string; clip_label: string | null }[];
  const byPrompt = new Map<string, typeof texts>();
  for (const t of texts) (byPrompt.get(t.prompt) ?? byPrompt.set(t.prompt, []).get(t.prompt)!).push(t);

  const cell = (g: string, f: string) => rows.filter((r) => r.completed_at && r.listener_gender === g && r.form === f).length;
  const genders = [["male", "Male"], ["female", "Female"], ["other", "Other"], ["na", "No answer"]];

  return (
    <div className="space-y-6">
      <PageHeader title="Responses" subtitle={`${rows.filter((r) => r.completed_at).length} completed of ${rows.length} started`}
        actions={<><DeleteParticipant all studyId={study.id} /><a className={btn} href={`/api/admin/export?study=${study.slug}`}><Download size={15} /> Download CSV</a></>} />

      <Panel title="Balance check" description="Completed participants by listener gender and clip combination (A to D). Aim for even numbers.">
        <TableShell>
          <table className="w-full text-sm">
            <thead className="border-b border-line"><tr><th className={th}>Listener gender</th><th className={th}>A</th><th className={th}>B</th><th className={th}>C</th><th className={th}>D</th><th className={th}>Total</th></tr></thead>
            <tbody>
              {genders.map(([g, name]) => (
                <tr key={g} className="border-b border-line last:border-0">
                  <td className={`${td} font-medium`}>{name}</td>{["A", "B", "C", "D"].map((f) => <td key={f} className={`${td} tabular-nums`}>{cell(g, f)}</td>)}<td className={`${td} font-semibold tabular-nums`}>{["A", "B", "C", "D"].reduce((t, f) => t + cell(g, f), 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </Panel>

      {byPrompt.size > 0 && (
        <Panel title="Written answers" right={<MessageSquareText className="text-muted" size={18} />}>
          <div className="space-y-6">
            {[...byPrompt].map(([prompt, list]) => (
              <div key={prompt}>
                <p className="text-sm font-semibold">{prompt} <span className="font-normal text-muted">({list.length})</span></p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {list.map((t, i) => (
                    <li key={i} className="rounded-xl bg-card2 p-3 text-sm leading-relaxed">
                      {t.clip_label && <span className="mr-2 inline-block rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand-strong">{t.clip_label}</span>}{t.text_value}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div>
        <h2 className="mb-3 text-base font-semibold">All participants</h2>
        <TableShell>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-line"><tr><th className={th}>Started</th><th className={th}>Gender</th><th className={th}>Age</th><th className={th}>Form</th><th className={th}>Progress</th><th className={th}></th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td className={`${td} py-10 text-center text-muted`} colSpan={6}>No participants yet.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-card2">
                  <td className={td}>{new Date(r.started_at).toLocaleString()}</td>
                  <td className={`${td} capitalize`}>{r.listener_gender}</td><td className={td}>{r.age}</td><td className={td}>{r.form}</td>
                  <td className={td}>{r.completed_at ? <Badge>Completed</Badge> : <Badge tone="muted">{r.n_rated}/{r.n_total} clips</Badge>}</td>
                  <td className={`${td} text-right`}><DeleteParticipant id={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </div>
    </div>
  );
}
