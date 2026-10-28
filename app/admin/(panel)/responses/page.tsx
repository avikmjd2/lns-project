import { Download } from "lucide-react";
import { loadAdminCtx } from "@/lib/admin-ctx";
import { sql } from "@/lib/db";
import { DeleteParticipant, btn } from "@/components/admin/bits";
import { Badge, PageHeader, Panel, TableShell, td, th } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type P = { id: string; listener_gender: string; age: number | null; first_language: string | null; form: string; started_at: string; completed_at: string | null; n_rated: number; n_total: number };

export default async function Responses({ searchParams }: { searchParams: Promise<{ study?: string }> }) {
  const ctx = await loadAdminCtx((await searchParams).study);
  if (!ctx.ok) return <p>Set up the database on the Overview page first.</p>;
  const { study } = ctx;
  const db = sql();
  const rows = (await db`
    SELECT p.id, p.listener_gender, p.age, p.first_language, p.form, p.started_at, p.completed_at,
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

  const combos = ["A", "B", "C", "D"];
  const cell = (g: string, f: string) => rows.filter((r) => r.completed_at && r.listener_gender === g && r.form === f).length;
  const genders = [["male", "Male"], ["female", "Female"], ["other", "Other"], ["na", "No answer"]];

  return (
    <div>
      <PageHeader title="Responses" subtitle={`${rows.filter((r) => r.completed_at).length} completed of ${rows.length} started`}
        actions={<><DeleteParticipant all studyId={study.id} /><a className={btn} href={`/api/admin/export?study=${study.slug}`}><Download size={14} /> Download CSV</a></>} />

      <Panel title="Balance check" description="Completed participants by listener gender and clip combination (A to D). Aim for even numbers.">
        <TableShell>
          <table className="w-full text-[0.95rem]">
            <thead><tr><th className={th}>Listener gender</th>{combos.map((c) => <th key={c} className={th}>{c}</th>)}<th className={th}>Total</th></tr></thead>
            <tbody>
              {genders.map(([g, name]) => (
                <tr key={g}>
                  <td className={td}>{name}</td>
                  {combos.map((f) => <td key={f} className={`${td} numeral`}>{cell(g, f)}</td>)}
                  <td className={`${td} numeral font-medium`}>{combos.reduce((t, f) => t + cell(g, f), 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </Panel>

      {byPrompt.size > 0 && (
        <Panel title="Written answers">
          <div className="space-y-8">
            {[...byPrompt].map(([prompt, list]) => (
              <div key={prompt}>
                <p className="label !text-ink">{prompt} · {list.length}</p>
                <ul className="mt-2 border-t border-ink">
                  {list.map((t, i) => (
                    <li key={i} className="grid grid-cols-[4.2rem_1fr] items-baseline gap-3 border-b border-rule py-3">
                      <span className="label numeral">{t.clip_label ?? "final"}</span>
                      <span className="text-[1.05rem] leading-snug">{t.text_value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="All participants">
        <TableShell>
          <table className="w-full min-w-[620px] text-[0.95rem]">
            <thead><tr><th className={th}>Started</th><th className={th}>Gender</th><th className={th}>Age</th><th className={th}>First language</th><th className={th}>Combo</th><th className={th}>Progress</th><th className={th}></th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td className={`${td} py-10 text-center text-muted`} colSpan={7}>No participants yet.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} numeral text-[13px]`}>{new Date(r.started_at).toLocaleString()}</td>
                  <td className={`${td} capitalize`}>{r.listener_gender}</td><td className={`${td} numeral`}>{r.age}</td><td className={td}>{r.first_language ?? "–"}</td><td className={`${td} numeral`}>{r.form}</td>
                  <td className={td}>{r.completed_at ? <Badge>Completed</Badge> : <Badge tone="muted">{r.n_rated}/{r.n_total} clips</Badge>}</td>
                  <td className={`${td} text-right`}><DeleteParticipant id={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </Panel>
    </div>
  );
}
