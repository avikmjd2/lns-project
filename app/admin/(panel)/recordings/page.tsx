import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { loadAdminCtx } from "@/lib/admin-ctx";
import { sql } from "@/lib/db";
import { ClipActions, UploadForm } from "@/components/admin/bits";
import { Badge, PageHeader, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type Clip = { id: number; label: string; speaker_id: string; speaker_gender: string; guise: string; form_a: boolean; form_b: boolean; blob_url: string };

export default async function Recordings({ searchParams }: { searchParams: Promise<{ study?: string }> }) {
  const ctx = await loadAdminCtx((await searchParams).study);
  if (!ctx.ok) return <p>Set up the database on the Overview page first.</p>;
  const clips = (await sql()`SELECT id, label, speaker_id, speaker_gender, guise, form_a, form_b, blob_url FROM clips WHERE study_id = ${ctx.study.id} ORDER BY speaker_id, guise`) as Clip[];

  // A form is "complete" when it has 1 male + 1 female code-mixed and 1 male + 1 female pure clip.
  const check = (f: "form_a" | "form_b") => {
    const inForm = clips.filter((c) => c[f]);
    const issues: string[] = [];
    for (const g of ["male", "female"]) for (const gu of ["mixed", "pure"]) {
      const n = inForm.filter((c) => c.speaker_gender === g && c.guise === gu).length;
      if (n !== 1) issues.push(`${n} ${g} ${gu === "mixed" ? "code-mixed" : "pure"} (need 1)`);
    }
    const seen = new Map<string, number>();
    inForm.forEach((c) => seen.set(c.speaker_id, (seen.get(c.speaker_id) ?? 0) + 1));
    seen.forEach((n, id) => n > 1 && issues.push(`speaker ${id} appears ${n} times`));
    return issues;
  };

  const bySpeaker = new Map<string, Clip[]>();
  for (const c of clips) (bySpeaker.get(c.speaker_id) ?? bySpeaker.set(c.speaker_id, []).get(c.speaker_id)!).push(c);

  return (
    <div className="space-y-6">
      <PageHeader title="Recordings" subtitle="Upload the clips and choose which form each one belongs to. Participants never see speaker ID, gender or style, and files get random names." />

      <div className="grid gap-4 md:grid-cols-2">
        {([["A", check("form_a")], ["B", check("form_b")]] as const).map(([name, issues]) => (
          <div key={name} className={`surface flex gap-4 rounded-2xl p-5 ${issues.length ? "" : "border-brand/40"}`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${issues.length ? "bg-accent-soft text-accent" : "bg-brand-soft text-brand"}`}>
              {issues.length ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            </span>
            <div>
              <p className="font-semibold">Form {name} {issues.length === 0 && <span className="font-normal text-brand">is complete</span>}</p>
              <p className="mt-0.5 text-sm text-muted">{issues.length === 0 ? "1 male + 1 female code-mixed, 1 male + 1 female pure." : issues.join(" · ")}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="-mt-2 text-sm text-muted">Each form needs one male and one female code-mixed clip plus one male and one female pure clip, with each speaker in one style only. Typical: Form A = M1 mixed, M2 pure, F1 mixed, F2 pure; Form B = the reverse.</p>

      <Panel title="Upload a clip"><UploadForm studyId={ctx.study.id} /></Panel>

      <div>
        <h2 className="mb-3 text-base font-semibold">Uploaded clips <span className="font-normal text-muted">({clips.length})</span></h2>
        {clips.length === 0 && <div className="surface rounded-2xl p-8 text-center text-sm text-muted">No clips yet. Upload your first recording above.</div>}
        <div className="grid gap-4 lg:grid-cols-2">
          {[...bySpeaker].map(([speaker, list]) => (
            <section key={speaker} className="surface rounded-2xl p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold">Speaker {speaker}</h3>
                <Badge tone="muted">{list[0].speaker_gender}</Badge>
              </div>
              <ul className="space-y-3">
                {list.map((c) => (
                  <li key={c.id} className="rounded-xl bg-card2 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <Badge tone={c.guise === "mixed" ? "brand" : "accent"}>{c.guise === "mixed" ? "Code-mixed" : "Pure"}</Badge>
                      <ClipActions id={c.id} formA={c.form_a} formB={c.form_b} />
                    </div>
                    <audio controls preload="none" src={c.blob_url} className="h-10 w-full" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
