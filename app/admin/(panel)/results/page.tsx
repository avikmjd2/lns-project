import Link from "next/link";
import { loadAdminCtx } from "@/lib/admin-ctx";
import { getRatings } from "@/lib/admin-data";
import { MEASURES, cells, tests, verdictH1, verdictH2, type GuiseTests, type Measure } from "@/lib/analysis";
import ResultsChart from "@/components/admin/ResultsChart";

export const dynamic = "force-dynamic";

const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "–");
const pTxt = (p?: number) => (p == null ? "–" : p < 0.001 ? "<.001" : p.toFixed(3));
const NICE: Record<string, string> = { composite: "Overall (mean of 5)", friendly: "Friendly", likable: "Likable", like_me: "Someone like me", educated: "Educated", confident: "Confident" };

export default async function Results({ searchParams }: { searchParams: Promise<{ study?: string; m?: string }> }) {
  const sp = await searchParams;
  const ctx = await loadAdminCtx(sp.study);
  if (!ctx.ok) return <p>Set up the database on the Overview page first.</p>;
  const { study } = ctx;
  const m: Measure = (MEASURES as string[]).includes(sp.m ?? "") ? (sp.m as Measure) : "composite";
  // Only listeners who identified as male or female enter the gender comparison.
  const rows = (await getRatings(study.id)).filter((r) => r.listener_gender === "male" || r.listener_gender === "female");
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Results · {study.name}</h1>
        <p className="mt-1 text-sm text-muted">{nListeners} completed male/female listeners ({nMale} male, {nListeners - nMale} female). Ratings from “other / prefer not to say” are excluded here but kept in the CSV.</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {MEASURES.map((k) => (
            <Link key={k} href={`/admin/results?study=${study.slug}&m=${k}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${k === m ? "bg-brand text-brand-ink" : "border border-line bg-card hover:bg-brand-soft"}`}>{NICE[k]}</Link>
          ))}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <ResultsChart title="Code-mixed clips (1–5)" data={chartData("mixed")} />
        <ResultsChart title="Pure-language baseline clips (1–5)" data={chartData("pure")} />
      </section>

      <section className="overflow-x-auto rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-2 font-semibold">Mean ratings: {NICE[m]}</h2>
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-muted"><tr><th className="py-1">Style</th><th>Speaker</th><th>Listener</th><th>Mean</th><th>SD</th><th>n ratings</th></tr></thead>
          <tbody>
            {c.map((x, i) => (
              <tr key={i} className="border-t border-line"><td className="py-1.5">{x.guise === "mixed" ? "Code-mixed" : "Pure"}</td><td>{x.speaker}</td><td>{x.listener}</td><td>{f2(x.mean)}</td><td>{f2(x.sd)}</td><td>{x.n}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Tests (code-mixed clips first, then baseline)</h2>
        <TestBlock title="Code-mixed" g={mixed} />
        <TestBlock title="Pure-language baseline" g={pure} />
        <p className="text-xs text-muted">
          Method: for each listener, rating of the male speaker minus rating of the female speaker in that style (positive = male speaker rated higher).
          “Within group” is a one-sample t-test of those differences against 0; the group comparison is Welch’s t-test of male-listener vs female-listener differences
          (this is the speaker gender × listener gender interaction). Two-sided p-values.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Verdict h="H1 · Same-gender preference" r={h1} note="Judged on code-mixed clips." />
        <Verdict h="H2 · Double standard" r={h2} note="Judged on code-mixed clips." />
      </section>
      <p className="text-sm text-muted">
        Baseline check: in pure-language clips, male-listener gap = {f2(pure.maleListeners.mean)}, female-listener gap = {f2(pure.femaleListeners.mean)}.
        If these look like the code-mixed gaps, the effect may come from the voices rather than the code-mixing.
        Verdicts are automatic suggestions only; with small samples, read them together with the numbers.
      </p>
    </div>
  );
}

function TestBlock({ title, g }: { title: string; g: GuiseTests }) {
  const row = (label: string, x: GuiseTests["maleListeners"]) => (
    <tr className="border-t border-line">
      <td className="py-1.5">{label}</td><td>{x.d.length}</td><td>{f2(x.mean)}</td><td>{x.t ? f2(x.t.t) : "–"}</td><td>{x.t ? f2(x.t.df) : "–"}</td><td>{pTxt(x.t?.p)}</td>
    </tr>
  );
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card p-5">
      <h3 className="mb-2 font-medium">{title}</h3>
      <table className="w-full min-w-[520px] text-sm">
        <thead className="text-left text-muted"><tr><th className="py-1">Comparison (male − female speaker)</th><th>n</th><th>Mean gap</th><th>t</th><th>df</th><th>p</th></tr></thead>
        <tbody>
          {row("Male listeners (within)", g.maleListeners)}
          {row("Female listeners (within)", g.femaleListeners)}
          <tr className="border-t border-line"><td className="py-1.5">Male vs female listeners (interaction)</td><td>{g.interaction ? `${g.interaction.nA}/${g.interaction.nB}` : "–"}</td><td>{g.interaction ? f2(g.interaction.meanA - g.interaction.meanB) : "–"}</td><td>{g.interaction ? f2(g.interaction.t) : "–"}</td><td>{g.interaction ? f2(g.interaction.df) : "–"}</td><td>{pTxt(g.interaction?.p)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function Verdict({ h, r, note }: { h: string; r: { v: string; why: string }; note: string }) {
  const icon = r.v === "supported" ? "✓" : r.v === "partly supported" ? "◐" : r.v === "not supported" ? "✕" : "…";
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <p className="text-sm text-muted">{h}</p>
      <p className="mt-1 text-xl font-semibold"><span aria-hidden>{icon}</span> {r.v}</p>
      <p className="mt-2 text-sm">{r.why}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
