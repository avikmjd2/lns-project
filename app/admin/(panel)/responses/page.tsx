import { loadAdminCtx } from "@/lib/admin-ctx";
import { sql } from "@/lib/db";
import { DeleteParticipant } from "@/components/admin/bits";

export const dynamic = "force-dynamic";

type P = { id: string; listener_gender: string; age: number | null; form: string; started_at: string; completed_at: string | null; n_rated: number; n_total: number };

export default async function Responses({ searchParams }: { searchParams: Promise<{ study?: string }> }) {
  const ctx = await loadAdminCtx((await searchParams).study);
  if (!ctx.ok) return <p>Set up the database on the Overview page first.</p>;
  const { study } = ctx;
  const rows = (await sql()`
    SELECT p.id, p.listener_gender, p.age, p.form, p.started_at, p.completed_at,
           (SELECT COUNT(*)::int FROM ratings r WHERE r.participant_id = p.id) AS n_rated,
           jsonb_array_length(p.clip_order) AS n_total
    FROM participants p WHERE p.study_id = ${study.id} ORDER BY p.started_at DESC`) as P[];

  const cell = (g: string, f: string) => rows.filter((r) => r.completed_at && r.listener_gender === g && r.form === f).length;
  const genders = [["male", "Male"], ["female", "Female"], ["other", "Other"], ["na", "No answer"]];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Responses · {study.name}</h1>
        <div className="flex gap-2">
          <a className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-ink" href={`/api/admin/export?study=${study.slug}`}>Download CSV</a>
          <DeleteParticipant all studyId={study.id} />
        </div>
      </div>
      <section className="overflow-x-auto rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-2 font-semibold">Completed participants (balance check)</h2>
        <table className="text-sm">
          <thead className="text-muted"><tr><th className="pr-6 text-left">Listener gender</th><th className="pr-6">Form A</th><th className="pr-6">Form B</th><th>Total</th></tr></thead>
          <tbody>
            {genders.map(([g, label]) => (
              <tr key={g}><td className="pr-6">{label}</td><td className="pr-6 text-center">{cell(g, "A")}</td><td className="pr-6 text-center">{cell(g, "B")}</td><td className="text-center">{cell(g, "A") + cell(g, "B")}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-line text-muted"><tr><th className="p-3">Started</th><th>Gender</th><th>Age</th><th>Form</th><th>Progress</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="p-4 text-muted" colSpan={6}>No participants yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="p-3">{new Date(r.started_at).toLocaleString()}</td>
                <td>{r.listener_gender}</td><td>{r.age}</td><td>{r.form}</td>
                <td>{r.completed_at ? "✓ done" : `${r.n_rated}/${r.n_total}`}</td>
                <td className="p-2"><DeleteParticipant id={r.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
