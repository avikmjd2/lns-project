import Link from "next/link";
import { Download } from "lucide-react";
import { loadAdminCtx } from "@/lib/admin-ctx";
import { sql, getQuestions } from "@/lib/db";
import { getRatings } from "@/lib/admin-data";
import {
  DIMS, FAST_MINUTES, breakdown, crosstab, daily, funnel, median, quality, questionStats, timing, type DimKey, type PRow,
} from "@/lib/responses-stats";
import { DeleteParticipant, btn } from "@/components/admin/bits";
import { Badge, BarRow, Histogram, PageHeader, Panel, Stats, TableShell, td, th } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "–");
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "–");
const pct0 = (x: number) => (Number.isFinite(x) ? `${Math.round(x)}%` : "–");
const mins = (x: number) => (!Number.isFinite(x) ? "–" : x < 1 ? `${Math.round(x * 60)} s` : x >= 90 ? `${(x / 60).toFixed(1)} h` : `${x.toFixed(1)} min`);
/** Same as mins() but the unit is small, so a big number fits one line inside a stat cell. */
const minsNode = (x: number) => {
  if (!Number.isFinite(x)) return "–";
  const [n, u] = x < 1 ? [String(Math.round(x * 60)), "s"] : x >= 90 ? [(x / 60).toFixed(1), "h"] : [x.toFixed(1), "min"];
  return <>{n}<span className="ml-1 text-[1rem] text-muted">{u}</span></>;
};
const rowLimit = 100;
const textLimit = 8;

export default async function Responses({ searchParams }: { searchParams: Promise<{ study?: string; by?: string }> }) {
  const sp = await searchParams;
  const ctx = await loadAdminCtx(sp.study);
  if (!ctx.ok) return <p>Set up the database on the Overview page first.</p>;
  const { study } = ctx;
  const db = sql();
  const rows = (await db`
    SELECT p.id, p.listener_gender, p.age, p.first_language, p.repeat_device, p.form, p.started_at, p.completed_at,
           (SELECT COUNT(*)::int FROM ratings r WHERE r.participant_id = p.id) AS n_rated,
           jsonb_array_length(p.clip_order) AS n_total
    FROM participants p WHERE p.study_id = ${study.id} ORDER BY p.started_at DESC`) as PRow[];
  const questions = await getQuestions(study.id);
  const ratings = await getRatings(study.id, questions);
  const texts = (await db`
    SELECT a.text_value, q.prompt, q.scope, c.label AS clip_label
    FROM answers a JOIN questions q ON q.id = a.question_id JOIN participants p ON p.id = a.participant_id
    LEFT JOIN clips c ON c.id = a.clip_id
    WHERE p.study_id = ${study.id} AND p.completed_at IS NOT NULL AND a.text_value IS NOT NULL
    ORDER BY q.position, a.answered_at DESC`) as { text_value: string; prompt: string; scope: string; clip_label: string | null }[];
  const byPrompt = new Map<string, typeof texts>();
  for (const t of texts) (byPrompt.get(t.prompt) ?? byPrompt.set(t.prompt, []).get(t.prompt)!).push(t);

  const done = rows.filter((p) => p.completed_at);
  const dim = DIMS.find((d) => d.key === (sp.by as DimKey)) ?? DIMS[0];
  const dimOf = (k: DimKey) => DIMS.find((d) => d.key === k)!;
  const tm = timing(rows);
  const ql = quality(ratings);
  const fn = funnel(rows);
  const days = daily(rows);
  const gaps = breakdown(rows, ratings, dim);
  const cross = crosstab(rows, dim, dim.key === "gender" ? dimOf("combo") : dimOf("gender"));
  const qstats = questionStats(ratings, questions);
  const ageMedian = median(rows.map((p) => p.age ?? NaN));
  const shown = rows.slice(0, rowLimit);
  const dur = (p: PRow) => (p.completed_at ? (new Date(p.completed_at).getTime() - new Date(p.started_at).getTime()) / 60000 : NaN);

  // Fixed demographic overview (all started participants).
  const overview = (["gender", "age", "language"] as DimKey[]).map((k) => {
    let g = breakdown(rows, ratings, dimOf(k));
    if (k === "language" && g.length > 8) { // keep the chart readable: top 7 + "Other languages"
      const rest = g.slice(7);
      g = [...g.slice(0, 7), { ...g[7], key: `Other (${rest.length} languages)`, started: rest.reduce((t, x) => t + x.started, 0), completed: rest.reduce((t, x) => t + x.completed, 0) }];
    }
    return { dim: dimOf(k), groups: g };
  });

  const maxDay = Math.max(1, ...days.map((d) => d.started));
  const shownDays = days.slice(-21);

  return (
    <div>
      <PageHeader title="Responses"
        subtitle={`${done.length} completed of ${rows.length} started${rows.length ? ` · latest started ${new Date(rows[0].started_at).toLocaleString()}` : ""}`}
        actions={<><DeleteParticipant all studyId={study.id} /><a className={btn} href={`/api/admin/export?study=${study.slug}`}><Download size={14} /> Download CSV</a></>} />

      <Stats items={[
        { label: "Started", value: rows.length },
        { label: "Completed", value: done.length },
        { label: "Completion rate", value: rows.length ? pct0((done.length / rows.length) * 100) : "–" },
        { label: "Median time", value: minsNode(tm.median), hint: tm.n ? `${tm.n} finished` : undefined },
        { label: "Median age", value: Number.isFinite(ageMedian) ? Math.round(ageMedian) : "–" },
        { label: "Same device", value: rows.filter((p) => p.repeat_device).length, hint: "marked as repeat" },
      ]} />

      {rows.length === 0 ? (
        <div className="mt-12 border-y border-ink py-14 text-center">
          <p className="text-[1.5rem] font-medium">No participants yet</p>
          <p className="mx-auto mt-2 max-w-md text-muted">Statistics appear here as soon as the first person starts the survey.</p>
        </div>
      ) : (
        <>
          <Panel title="Who took part" description="Everyone who started the survey, by gender, age group and first language.">
            <div className="grid gap-x-12 gap-y-10 lg:grid-cols-3">
              {overview.map(({ dim: d, groups }) => {
                const max = Math.max(1, ...groups.map((g) => g.started));
                return (
                  <div key={d.key}>
                    <p className="label !text-ink mb-2 border-b border-ink pb-2">{d.label}</p>
                    {groups.map((g) => <BarRow key={g.key} label={g.key} value={g.started} max={max} total={rows.length} />)}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Where people drop off" description="How far each person got. Large gaps between two steps show where the survey loses people.">
            {fn.map((s, i) => {
              const lost = i > 0 ? fn[i - 1].n - s.n : 0;
              return <BarRow key={s.label} label={s.label} value={s.n} max={fn[0].n} total={fn[0].n} tone={i === fn.length - 1 ? "signal" : "ink"} sub={lost > 0 ? `−${lost}` : undefined} />;
            })}
          </Panel>

          <Panel title="Break down by" description="Pick any aspect. The table compares groups on completion, age, time taken, average rating and how much audio was played.">
            <nav className="mb-6 flex flex-wrap gap-x-6 gap-y-1" aria-label="Break down by">
              {DIMS.map((d) => (
                <Link key={d.key} href={`/admin/responses?study=${study.slug}&by=${d.key}`}
                  className={`border-b-2 py-2 text-[1.02rem] transition-colors ${d.key === dim.key ? "border-signal text-ink" : "border-transparent text-muted hover:text-ink"}`}>{d.label}</Link>
              ))}
            </nav>
            <TableShell>
              <table className="w-full min-w-[720px] text-[0.95rem]">
                <thead><tr><th className={th}>{dim.label}</th><th className={th}>Started</th><th className={th}>Completed</th><th className={th}>Completion</th><th className={th}>Mean age</th><th className={th}>Median time</th><th className={th}>Avg rating</th><th className={th}>Audio played</th></tr></thead>
                <tbody>
                  {gaps.map((g) => (
                    <tr key={g.key}>
                      <td className={td}>{g.key}</td>
                      <td className={`${td} numeral`}>{g.started}</td><td className={`${td} numeral`}>{g.completed}</td>
                      <td className={`${td} numeral`}>{pct0(g.completionPct)}</td><td className={`${td} numeral`}>{f1(g.meanAge)}</td>
                      <td className={`${td} numeral`}>{mins(g.medianMinutes)}</td><td className={`${td} numeral`}>{f2(g.meanComposite)}</td><td className={`${td} numeral`}>{pct0(g.meanPlayed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
            <p className="label mt-2">Avg rating is the mean of all scale answers rescaled to 1–5. It covers completed participants only.</p>

            <p className="label !text-ink mb-2 mt-10">Completed participants: {dim.label.toLowerCase()} × {(dim.key === "gender" ? dimOf("combo") : dimOf("gender")).label.toLowerCase()}</p>
            <TableShell>
              <table className="w-full min-w-[480px] text-[0.95rem]">
                <thead><tr><th className={th}>{dim.label}</th>{cross.colKeys.map((c) => <th key={c} className={th}>{c}</th>)}<th className={th}>Total</th></tr></thead>
                <tbody>
                  {cross.rowKeys.map((r) => (
                    <tr key={r}>
                      <td className={td}>{r}</td>
                      {cross.colKeys.map((c) => <td key={c} className={`${td} numeral`}>{cross.cell(r, c)}</td>)}
                      <td className={`${td} numeral font-medium`}>{cross.colKeys.reduce((t, c) => t + cross.cell(r, c), 0)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className={`${td} font-medium`}>Total</td>
                    {cross.colKeys.map((c) => <td key={c} className={`${td} numeral font-medium`}>{cross.rowKeys.reduce((t, r) => t + cross.cell(r, c), 0)}</td>)}
                    <td className={`${td} numeral font-medium`}>{cross.total}</td>
                  </tr>
                </tbody>
              </table>
            </TableShell>
            <p className="label mt-2">Aim for even numbers across combinations within each gender so the comparisons stay fair.</p>
          </Panel>

          <Panel title="Activity by day" description="People who started each day (dark = finished, red = did not finish). Last 21 days with activity.">
            <div className="space-y-0.5">
              {shownDays.map((d) => (
                <div key={d.date} className="grid grid-cols-[6rem_1fr_auto] items-center gap-x-3 py-1.5 text-[0.98rem]">
                  <span className="numeral text-[13px]">{d.date}</span>
                  <span className="flex h-[10px] bg-rule" aria-hidden>
                    <span className="block h-full bg-ink" style={{ width: `${(d.completed / maxDay) * 100}%` }} />
                    <span className="block h-full bg-signal" style={{ width: `${((d.started - d.completed) / maxDay) * 100}%` }} />
                  </span>
                  <span className="numeral min-w-[5.5rem] text-right text-[13px]">{d.completed}/{d.started}</span>
                </div>
              ))}
            </div>
          </Panel>

          <div className="mt-12 grid gap-x-12 gap-y-12 lg:grid-cols-2">
            <Panel className="!mt-0" title="Time to finish" description="From starting to finishing the survey.">
              <dl className="divide-y divide-rule border-y border-ink text-[1rem]">
                {[
                  ["Median", mins(tm.median)], ["Average", mins(tm.mean)],
                  ["Fastest 10% finish within", mins(tm.p10)], ["Slowest 10% take over", mins(tm.p90)],
                  ["Shortest / longest", `${mins(tm.min)} / ${mins(tm.max)}`],
                  [`Finished in under ${FAST_MINUTES} min`, `${tm.fast} of ${tm.n}`],
                ].map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="numeral">{v}</dd></div>)}
              </dl>
              {tm.fast > 0 && <p className="mt-3 text-[0.95rem] text-muted">Very fast finishers probably skipped the audio. Compare against the listening data on the right before deciding to exclude them.</p>}
            </Panel>
            <Panel className="!mt-0" title="Listening quality" description="How much of each clip was played before the person answered.">
              <dl className="divide-y divide-rule border-y border-ink text-[1rem]">
                {[
                  ["Average audio played", pct0(ql.meanPlayed)],
                  ["Clip answers with under 80% played", `${ql.shortPlays} of ${ql.ratings} (${ql.ratings ? pct0((ql.shortPlays / ql.ratings) * 100) : "–"})`],
                  ["People who skipped at least one clip", `${ql.participantsSkipping} of ${ql.participants}`],
                ].map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="numeral text-right">{v}</dd></div>)}
              </dl>
              <p className="mt-3 text-[0.95rem] text-muted">The CSV has the exact percentage for every answer, so you can filter low-listening answers out in your analysis.</p>
            </Panel>
          </div>

          {qstats.length > 0 && (
            <Panel title="Scores by question" description="Distribution of answers for each scale question, with the average by listener gender. Completed participants only.">
              <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
                {qstats.map((s) => (
                  <div key={s.q.id} className="border-t border-ink pt-3">
                    <p className="text-[1.08rem] leading-snug">{s.q.prompt}</p>
                    <p className="label mt-1"><span className="numeral">{s.n}</span> answers · mean <span className="numeral">{f2(s.mean)}</span> · SD <span className="numeral">{f2(s.sd)}</span></p>
                    <div className="mt-3"><Histogram values={s.hist} start={s.q.scale_min} /></div>
                    <p className="mt-3 text-[0.95rem] text-muted">
                      Male listeners <span className="numeral text-ink">{f2(s.maleMean)}</span> (n={s.nMale}) · Female listeners <span className="numeral text-ink">{f2(s.femaleMean)}</span> (n={s.nFemale})
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {byPrompt.size > 0 && (
            <Panel title="Written answers">
              <div className="space-y-8">
                {[...byPrompt].map(([prompt, list]) => (
                  <div key={prompt}>
                    <p className="label !text-ink">{prompt} · {list.length}</p>
                    <ul className="mt-2 border-t border-ink">
                      {list.slice(0, textLimit).map((t, i) => (
                        <li key={i} className="grid grid-cols-[4.2rem_1fr] items-baseline gap-3 border-b border-rule py-3">
                          <span className="label numeral">{t.clip_label ?? "final"}</span>
                          <span className="text-[1.05rem] leading-snug">{t.text_value}</span>
                        </li>
                      ))}
                    </ul>
                    {list.length > textLimit && <p className="label mt-2">Latest {textLimit} shown. {list.length - textLimit} more in the CSV.</p>}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="All participants" description={rows.length > rowLimit ? `Showing the latest ${rowLimit} of ${rows.length}. The CSV has everyone.` : undefined}>
            <TableShell>
              <table className="w-full min-w-[860px] text-[0.95rem]">
                <thead><tr><th className={th}>Started</th><th className={th}>Gender</th><th className={th}>Age</th><th className={th}>First language</th><th className={th}>Combo</th><th className={th}>Time</th><th className={th}>Progress</th><th className={th}></th></tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id}>
                      <td className={`${td} numeral text-[13px]`}>{new Date(r.started_at).toLocaleString()}</td>
                      <td className={`${td} capitalize`}>{r.listener_gender}</td><td className={`${td} numeral`}>{r.age}</td><td className={td}>{r.first_language ?? "–"}</td><td className={`${td} numeral`}>{r.form}</td>
                      <td className={`${td} numeral`}>{mins(dur(r))}</td>
                      <td className={td}>{r.completed_at ? <Badge>Completed</Badge> : <Badge tone="muted">{r.n_rated}/{r.n_total} clips</Badge>}{r.repeat_device && <> <Badge tone="signal">Same device</Badge></>}</td>
                      <td className={`${td} text-right`}><DeleteParticipant id={r.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </Panel>
        </>
      )}
    </div>
  );
}
