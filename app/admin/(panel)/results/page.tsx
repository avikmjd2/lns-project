import Link from "next/link";
import { loadAdminCtx } from "@/lib/admin-ctx";
import { getRatings } from "@/lib/admin-data";
import { getQuestions } from "@/lib/db";
import { cells, tests, verdictH1, verdictH2, type GuiseTests, type Measure } from "@/lib/analysis";
import ResultsChart from "@/components/admin/ResultsChart";
import { Badge, PageHeader, Panel, TableShell, td, th } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "–");
const pTxt = (p?: number) => (p == null ? "–" : p < 0.001 ? "<.001" : p.toFixed(3));

export default async function Results({ searchParams }: { searchParams: Promise<{ study?: string; m?: string }> }) {
  const sp = await searchParams;
  const ctx = await loadAdminCtx(sp.study);
  if (!ctx.ok) return <p>Set up the database on the Overview page first.</p>;
  const { study } = ctx;
  const questions = await getQuestions(study.id);
  const scaleQs = questions.filter((q) => q.kind === "scale" && q.scope === "clip");
  const measures: { key: Measure; label: string; min: number; max: number }[] = [
    { key: "composite", label: "Overall", min: 1, max: 5 },
    ...scaleQs.map((q) => ({ key: String(q.id), label: q.prompt, min: q.scale_min, max: q.scale_max })),
  ];
  const cur = measures.find((x) => x.key === sp.m) ?? measures[0];
  const m: Measure = cur.key;
  // Only listeners who identified as male or female enter the gender comparison.
  const rows = (await getRatings(study.id, questions)).filter((r) => r.listener_gender === "male" || r.listener_gender === "female");
  const nListeners = new Set(rows.map((r) => r.participant_id)).size;
  const nMale = new Set(rows.filter((r) => r.listener_gender === "male").map((r) => r.participant_id)).size;
  const c = cells(rows, m);
  const mixed = tests(rows, "mixed", m), pure = tests(rows, "pure", m);
  const h1 = verdictH1(mixed), h2 = verdictH2(mixed);

  const chartData = (guise: "mixed" | "pure") =>
    (["male", "female"] as const).map((sg) => {
      const get = (l: "male" | "female") => c.find((x) => x.guise === guise && x.speaker === sg && x.listener === l)!;
      const a = get("male"), b = get("female");
      return { speaker: sg === "male" ? "Male speakers" : "Female speakers", male: Number.isFinite(a.mean) ? a.mean : null, female: Number.isFinite(b.mean) ? b.mean : null, nMale: a.n, nFemale: b.n };
    });

  return (
    <div>
      <PageHeader title="Results"
        subtitle={<>{nListeners} completed listeners ({nMale} male, {nListeners - nMale} female). Listeners who chose “other / prefer not to say” are left out here but kept in the CSV.</>} />

      <nav className="mb-10 flex flex-wrap gap-x-6 gap-y-2" aria-label="Measure">
        {measures.map((x) => (
          <Link key={x.key} href={`/admin/results?study=${study.slug}&m=${x.key}`}
            className={`border-b-2 pb-0.5 text-[1.02rem] leading-snug transition-colors ${x.key === m ? "border-signal text-ink" : "border-transparent text-muted hover:text-ink"}`}>{x.label}</Link>
        ))}
      </nav>

      {nListeners === 0 ? (
        <div className="border-y border-ink py-14 text-center">
          <p className="text-[1.5rem] font-medium">No completed responses yet</p>
          <p className="mx-auto mt-2 max-w-md text-muted">Charts and tests appear here once participants finish the survey. Only scale questions are analysed.</p>
        </div>
      ) : (
        <>
          <section className="grid gap-10 lg:grid-cols-2">
            <ResultsChart title={`Code-mixed clips · ${cur.min}–${cur.max}`} min={cur.min} max={cur.max} data={chartData("mixed")} />
            <ResultsChart title={`Pure-language baseline · ${cur.min}–${cur.max}`} min={cur.min} max={cur.max} data={chartData("pure")} />
          </section>

          <section className="mt-12 grid gap-10 md:grid-cols-2">
            <Verdict h="H1 · Same-gender preference" r={h1} />
            <Verdict h="H2 · Double standard" r={h2} />
          </section>
          <p className="mt-6 max-w-3xl text-[0.98rem] leading-relaxed text-muted">
            Baseline check: in pure-language clips the male-listener gap is {f2(pure.maleListeners.mean)} and the female-listener gap is {f2(pure.femaleListeners.mean)}.
            If these look like the code-mixed gaps, the effect may come from the voices rather than the code-mixing. Verdicts are automatic suggestions from the code-mixed clips; with small samples, read them together with the numbers.
          </p>

          <Panel title={`Mean ratings · ${cur.label}`}>
            <TableShell>
              <table className="w-full min-w-[520px] text-[0.95rem]">
                <thead><tr><th className={th}>Style</th><th className={th}>Speaker</th><th className={th}>Listener</th><th className={th}>Mean</th><th className={th}>SD</th><th className={th}>n</th></tr></thead>
                <tbody>
                  {c.map((x, i) => (
                    <tr key={i}>
                      <td className={td}><Badge tone={x.guise === "mixed" ? "ink" : "signal"}>{x.guise === "mixed" ? "Code-mixed" : "Pure"}</Badge></td>
                      <td className={`${td} capitalize`}>{x.speaker}</td><td className={`${td} capitalize`}>{x.listener}</td>
                      <td className={`${td} numeral font-medium`}>{f2(x.mean)}</td><td className={`${td} numeral`}>{f2(x.sd)}</td><td className={`${td} numeral`}>{x.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </Panel>

          <Panel title="Statistical tests" description="Code-mixed clips first, then the pure-language baseline.">
            <div className="space-y-8">
              <TestBlock title="Code-mixed" g={mixed} />
              <TestBlock title="Pure-language baseline" g={pure} />
            </div>
            <p className="mt-5 max-w-3xl text-[0.92rem] leading-relaxed text-muted">
              For each listener: rating of the male speaker minus rating of the female speaker in that style (positive = male speaker rated higher).
              “Within” rows are one-sample t-tests of those gaps against 0. The last row compares male vs female listeners with Welch’s t-test, which is the speaker gender × listener gender interaction. Two-sided p-values.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}

function TestBlock({ title, g }: { title: string; g: GuiseTests }) {
  const row = (name: string, x: GuiseTests["maleListeners"]) => (
    <tr>
      <td className={td}>{name}</td><td className={`${td} numeral`}>{x.d.length}</td><td className={`${td} numeral`}>{f2(x.mean)}</td>
      <td className={`${td} numeral`}>{x.t ? f2(x.t.t) : "–"}</td><td className={`${td} numeral`}>{x.t ? f2(x.t.df) : "–"}</td>
      <td className={`${td} numeral ${x.t && x.t.p < 0.05 ? "font-medium text-signal" : ""}`}>{pTxt(x.t?.p)}</td>
    </tr>
  );
  const i = g.interaction;
  return (
    <div>
      <p className="label !text-ink mb-2">{title}</p>
      <TableShell>
        <table className="w-full min-w-[520px] text-[0.95rem]">
          <thead><tr><th className={th}>Comparison (male − female speaker)</th><th className={th}>n</th><th className={th}>Mean gap</th><th className={th}>t</th><th className={th}>df</th><th className={th}>p</th></tr></thead>
          <tbody>
            {row("Male listeners (within)", g.maleListeners)}
            {row("Female listeners (within)", g.femaleListeners)}
            <tr>
              <td className={td}>Male vs female listeners</td><td className={`${td} numeral`}>{i ? `${i.nA}/${i.nB}` : "–"}</td>
              <td className={`${td} numeral`}>{i ? f2(i.meanA - i.meanB) : "–"}</td><td className={`${td} numeral`}>{i ? f2(i.t) : "–"}</td><td className={`${td} numeral`}>{i ? f2(i.df) : "–"}</td>
              <td className={`${td} numeral ${i && i.p < 0.05 ? "font-medium text-signal" : ""}`}>{pTxt(i?.p)}</td>
            </tr>
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}

function Verdict({ h, r }: { h: string; r: { v: string; why: string } }) {
  const mark = r.v === "supported" ? "●" : r.v === "partly supported" ? "◐" : r.v === "not supported" ? "○" : "·";
  return (
    <div className="border-t-2 border-ink pt-4">
      <p className="label">{h}</p>
      <p className="mt-2 text-[2rem] font-medium capitalize leading-tight tracking-[-0.015em]"><span className="mr-2 text-signal" aria-hidden>{mark}</span>{r.v}</p>
      <p className="mt-2 text-[1.02rem] leading-relaxed text-muted">{r.why}</p>
    </div>
  );
}
