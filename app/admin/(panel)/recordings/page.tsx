import { loadAdminCtx } from "@/lib/admin-ctx";
import { sql } from "@/lib/db";
import { ClipActions, UploadForm } from "@/components/admin/bits";

export const dynamic = "force-dynamic";

type Clip = { id: number; label: string; speaker_id: string; speaker_gender: string; guise: string; form_a: boolean; form_b: boolean; blob_url: string };

export default async function Recordings({ searchParams }: { searchParams: Promise<{ study?: string }> }) {
  const ctx = await loadAdminCtx((await searchParams).study);
  if (!ctx.ok) return <p>Set up the database on the Overview page first.</p>;
  const clips = (await sql()`SELECT id, label, speaker_id, speaker_gender, guise, form_a, form_b, blob_url FROM clips WHERE study_id = ${ctx.study.id} ORDER BY speaker_id, guise`) as Clip[];

  // A form is "complete" when it has 1 male + 1 female code-mixed and 1 male + 1 female pure clip.
  const check = (f: "form_a" | "form_b") => {
    const inForm = clips.filter((c) => c[f]);
    const has = (g: string, gu: string) => inForm.filter((c) => c.speaker_gender === g && c.guise === gu).length;
    const issues: string[] = [];
    for (const g of ["male", "female"]) for (const gu of ["mixed", "pure"]) {
      const n = has(g, gu);
      if (n !== 1) issues.push(`${n} ${g} ${gu === "mixed" ? "code-mixed" : "pure"} (need 1)`);
    }
    // Each speaker must appear in only one guise per form.
    const seen = new Map<string, number>();
    inForm.forEach((c) => seen.set(c.speaker_id, (seen.get(c.speaker_id) ?? 0) + 1));
    seen.forEach((n, id) => n > 1 && issues.push(`speaker ${id} appears ${n} times`));
    return issues;
  };
  const a = check("form_a"), b = check("form_b");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Recordings · {ctx.study.name}</h1>
      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-1 font-semibold">Form checklist</h2>
        <p className="mb-3 text-sm text-muted">Each form needs one male + one female code-mixed clip and one male + one female pure clip, with each speaker in a single guise. Typical: Form A = M1 mixed, M2 pure, F1 mixed, F2 pure; Form B = the reverse.</p>
        {([["A", a], ["B", b]] as const).map(([name, issues]) => (
          <p key={name} className="text-sm">
            <b>Form {name}:</b> {issues.length === 0 ? <span className="text-brand">✓ complete</span> : <span className="text-accent">{issues.join("; ")}</span>}
          </p>
        ))}
      </section>
      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-3 font-semibold">Upload a clip</h2>
        <UploadForm studyId={ctx.study.id} />
        <p className="mt-3 text-xs text-muted">Participants never see speaker ID, gender or style. Files get random names.</p>
      </section>
      <section className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-muted"><tr><th className="p-3">Speaker</th><th>Gender</th><th>Style</th><th>Preview</th><th>Forms</th></tr></thead>
          <tbody>
            {clips.length === 0 && <tr><td className="p-4 text-muted" colSpan={5}>No clips yet.</td></tr>}
            {clips.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="p-3 font-medium">{c.speaker_id}</td>
                <td>{c.speaker_gender}</td>
                <td>{c.guise === "mixed" ? "Code-mixed" : "Pure"}</td>
                <td><audio controls preload="none" src={c.blob_url} className="h-9 w-48" /></td>
                <td><ClipActions id={c.id} formA={c.form_a} formB={c.form_b} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
