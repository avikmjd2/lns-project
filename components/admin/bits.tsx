"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { upload } from "@vercel/blob/client";

export const btn = "rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-40";
export const btn2 = "rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium hover:bg-brand-soft disabled:opacity-40";
export const field = "w-full rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none focus:border-brand";

async function call(method: string, url: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

function NavInner({ slugs }: { slugs: { slug: string; name: string }[] }) {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const study = sp.get("study") ?? slugs[0]?.slug ?? "";
  const q = study ? `?study=${study}` : "";
  const links = [["/admin", "Overview"], ["/admin/recordings", "Recordings"], ["/admin/questions", "Questions"], ["/admin/responses", "Responses"], ["/admin/results", "Results"]];
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="font-semibold">Admin</span>
        <nav className="flex flex-wrap gap-1">
          {links.map(([href, label]) => (
            <Link key={href} href={`${href}${q}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${path === href ? "bg-brand text-brand-ink" : "hover:bg-brand-soft"}`}>{label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {slugs.length > 0 && (
            <select value={study} onChange={(e) => router.push(`${path}?study=${e.target.value}`)} className={`${field} !w-auto`} aria-label="Study">
              {slugs.map((s) => <option key={s.slug} value={s.slug}>{s.name} ({s.slug})</option>)}
            </select>
          )}
          <button className={btn2} onClick={async () => { await call("POST", "/api/admin/logout"); router.push("/admin/login"); }}>Log out</button>
        </div>
      </div>
    </header>
  );
}
export function AdminNav(props: { slugs: { slug: string; name: string }[] }) {
  return <Suspense fallback={<div className="h-14 border-b border-line" />}><NavInner {...props} /></Suspense>;
}

export function LoginForm() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setErr("");
      try { await call("POST", "/api/admin/login", { password: pw }); router.push("/admin"); router.refresh(); }
      catch (x) { setErr((x as Error).message); }
    }}>
      <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Admin password" className={field} />
      {err && <p className="text-sm text-accent">{err}</p>}
      <button className={`${btn} w-full`}>Log in</button>
    </form>
  );
}

export function InitButton({ label = "Set up database" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  return (
    <div>
      <button className={btn} disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        try { await call("POST", "/api/admin/init"); router.refresh(); } catch (x) { setErr((x as Error).message); }
        setBusy(false);
      }}>{busy ? "Working…" : label}</button>
      {err && <p className="mt-2 text-sm text-accent">{err}</p>}
    </div>
  );
}

export function StudyControls({ study }: { study: { id: number; status: string; intro: string | null; debrief: string | null } }) {
  const router = useRouter();
  const [intro, setIntro] = useState(study.intro ?? "");
  const [debrief, setDebrief] = useState(study.debrief ?? "");
  const [msg, setMsg] = useState("");
  async function patch(b: object) { await call("PATCH", "/api/admin/studies", { id: study.id, ...b }); router.refresh(); setMsg("Saved"); setTimeout(() => setMsg(""), 1500); }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm">Status:</span>
        {["draft", "open", "closed"].map((s) => (
          <button key={s} onClick={() => patch({ status: s })} className={study.status === s ? btn : btn2}>{s}</button>
        ))}
        <span className="text-sm text-muted">{msg}</span>
      </div>
      <div>
        <label className="text-sm font-medium">Intro text (blank = default)</label>
        <textarea className={`${field} mt-1`} rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium">Debrief text (blank = default)</label>
        <textarea className={`${field} mt-1`} rows={3} value={debrief} onChange={(e) => setDebrief(e.target.value)} />
      </div>
      <button className={btn} onClick={() => patch({ intro, debrief })}>Save texts</button>
    </div>
  );
}

export function NewStudyForm() {
  const router = useRouter();
  const [f, setF] = useState({ slug: "", name: "", baseLanguage: "", mixLanguage: "English", locale: "en" });
  const [err, setErr] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault(); setErr("");
      try { await call("POST", "/api/admin/studies", f); router.push(`/admin?study=${f.slug}`); router.refresh(); }
      catch (x) { setErr((x as Error).message); }
    }}>
      <input className={field} placeholder="URL slug (e.g. bangla)" value={f.slug} onChange={set("slug")} required />
      <input className={field} placeholder="Study name" value={f.name} onChange={set("name")} required />
      <input className={field} placeholder="Base language (e.g. Bangla)" value={f.baseLanguage} onChange={set("baseLanguage")} required />
      <input className={field} placeholder="Mixed-in language" value={f.mixLanguage} onChange={set("mixLanguage")} />
      <input className={field} placeholder="UI locale (en)" value={f.locale} onChange={set("locale")} />
      <button className={btn}>Create study (draft)</button>
      {err && <p className="text-sm text-accent sm:col-span-2">{err}</p>}
    </form>
  );
}

export function UploadForm({ studyId }: { studyId: number }) {
  const router = useRouter();
  const [f, setF] = useState({ speakerId: "", speakerGender: "female", guise: "mixed", formA: false, formB: false });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault(); if (!file) return; setBusy(true); setErr("");
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
        const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const blob = await upload(`clips/${rand}.${ext}`, file, { access: "public", handleUploadUrl: "/api/admin/upload", contentType: file.type || undefined });
        await call("POST", "/api/admin/clips", {
          studyId, url: blob.url, label: `S${rand.slice(0, 4)}`, ...f,
        });
        setFile(null); (e.target as HTMLFormElement).reset(); router.refresh();
      } catch (x) { setErr((x as Error).message); }
      setBusy(false);
    }}>
      <input className={field} placeholder="Speaker ID (e.g. M1, F2)" value={f.speakerId} onChange={(e) => setF({ ...f, speakerId: e.target.value })} required />
      <input type="file" accept="audio/*" className={field} onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
      <select className={field} value={f.speakerGender} onChange={(e) => setF({ ...f, speakerGender: e.target.value })}>
        <option value="female">Female speaker</option><option value="male">Male speaker</option>
      </select>
      <select className={field} value={f.guise} onChange={(e) => setF({ ...f, guise: e.target.value })}>
        <option value="mixed">Code-mixed</option><option value="pure">Pure (baseline)</option>
      </select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.formA} onChange={(e) => setF({ ...f, formA: e.target.checked })} /> In Form A</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.formB} onChange={(e) => setF({ ...f, formB: e.target.checked })} /> In Form B</label>
      <button className={btn} disabled={busy}>{busy ? "Uploading…" : "Upload clip"}</button>
      {err && <p className="text-sm text-accent sm:col-span-2">{err}</p>}
    </form>
  );
}

export function ClipActions({ id, formA, formB }: { id: number; formA: boolean; formB: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const patch = async (b: object) => { setBusy(true); await call("PATCH", "/api/admin/clips", { id, ...b }); router.refresh(); setBusy(false); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={formA} disabled={busy} onChange={(e) => patch({ formA: e.target.checked })} /> A</label>
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={formB} disabled={busy} onChange={(e) => patch({ formB: e.target.checked })} /> B</label>
      <button className={btn2} disabled={busy} onClick={async () => {
        if (!confirm("Delete this clip and all ratings for it?")) return;
        setBusy(true); await call("DELETE", `/api/admin/clips?id=${id}`); router.refresh(); setBusy(false);
      }}>Delete</button>
    </div>
  );
}

export function DeleteParticipant({ id, studyId, all }: { id?: string; studyId?: number; all?: boolean }) {
  const router = useRouter();
  return (
    <button className={btn2} onClick={async () => {
      if (!confirm(all ? "Delete ALL participants and ratings in this study?" : "Delete this participant?")) return;
      await call("DELETE", all ? `/api/admin/participants?studyId=${studyId}&all=1` : `/api/admin/participants?id=${id}`);
      router.refresh();
    }}>{all ? "Clear all test data" : "Delete"}</button>
  );
}

export type ClipOpt = { id: number; label: string };

/** "All clips" or a checklist of specific clips. value null = all clips. */
function ClipPicker({ clips, value, onChange, disabled }: { clips: ClipOpt[]; value: number[] | null; onChange: (v: number[] | null) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2 text-sm">
      <select className={`${field} !w-auto`} disabled={disabled} value={value ? "some" : "all"}
        onChange={(e) => onChange(e.target.value === "all" ? null : clips.map((c) => c.id).slice(0, 1))}>
        <option value="all">Every clip</option><option value="some">Only selected clips</option>
      </select>
      {value && (
        <div className="grid gap-1 sm:grid-cols-2">
          {clips.length === 0 && <p className="text-muted">Upload clips first.</p>}
          {clips.map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input type="checkbox" disabled={disabled} checked={value.includes(c.id)}
                onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))} />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuestionForm({ studyId, clips }: { studyId: number; clips: ClipOpt[] }) {
  const router = useRouter();
  const [f, setF] = useState({ prompt: "", kind: "scale", scope: "clip", scaleMin: 1, scaleMax: 5, low: "Not at all", high: "Very", required: true });
  const [clipIds, setClipIds] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isScale = f.kind === "scale";
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      try {
        await call("POST", "/api/admin/questions", { studyId, ...f, clipIds: f.scope === "clip" ? clipIds : null });
        setF({ ...f, prompt: "" }); router.refresh();
      } catch (x) { setErr((x as Error).message); }
      setBusy(false);
    }}>
      <input className={`${field} sm:col-span-2`} placeholder="Question text, e.g. How friendly does this speaker sound?" value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} required maxLength={300} />
      <select className={field} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
        <option value="scale">Scale (numbers)</option><option value="text">Descriptive (free text)</option>
      </select>
      <select className={field} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}>
        <option value="clip">Ask after a recording</option><option value="final">Ask once, at the end</option>
      </select>
      {isScale && (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span>Scale from</span>
            <input type="number" className={`${field} !w-20`} min={0} max={10} value={f.scaleMin} onChange={(e) => setF({ ...f, scaleMin: Number(e.target.value) })} />
            <span>to</span>
            <input type="number" className={`${field} !w-20`} min={1} max={11} value={f.scaleMax} onChange={(e) => setF({ ...f, scaleMax: Number(e.target.value) })} />
          </div>
          <div className="flex gap-2">
            <input className={field} placeholder="Low end label" value={f.low} onChange={(e) => setF({ ...f, low: e.target.value })} />
            <input className={field} placeholder="High end label" value={f.high} onChange={(e) => setF({ ...f, high: e.target.value })} />
          </div>
        </>
      )}
      {f.scope === "clip" && (
        <div className="sm:col-span-2"><p className="mb-1 text-sm font-medium">Ask this for</p><ClipPicker clips={clips} value={clipIds} onChange={setClipIds} /></div>
      )}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} /> Required</label>
      <button className={btn} disabled={busy}>{busy ? "Adding…" : "Add question"}</button>
      {err && <p className="text-sm text-accent sm:col-span-2">{err}</p>}
    </form>
  );
}

export function QuestionRow({ q, n, clips }: {
  clips: ClipOpt[];
  q: { clip_ids: number[] | null; id: number; kind: string; scope: string; prompt: string; scale_min: number; scale_max: number; low_label: string | null; high_label: string | null; required: boolean };
  n: number;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(q.prompt);
  const [busy, setBusy] = useState(false);
  const [ids, setIds] = useState<number[] | null>(q.clip_ids);
  const [idsErr, setIdsErr] = useState("");
  const patch = async (b: object) => { setBusy(true); try { await call("PATCH", "/api/admin/questions", { id: q.id, ...b }); router.refresh(); } finally { setBusy(false); } };
  return (
    <li className="space-y-2 rounded-2xl border border-line bg-card p-4">
      <div className="flex gap-2">
        <input className={field} value={prompt} maxLength={300} onChange={(e) => setPrompt(e.target.value)}
          onBlur={() => prompt.trim() && prompt !== q.prompt && patch({ prompt })} aria-label="Question text" />
        <button className={btn2} disabled={busy} aria-label="Move up" onClick={() => patch({ move: "up" })}>↑</button>
        <button className={btn2} disabled={busy} aria-label="Move down" onClick={() => patch({ move: "down" })}>↓</button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="rounded-full bg-brand-soft px-2.5 py-0.5">{q.kind === "scale" ? `Scale ${q.scale_min}–${q.scale_max}` : "Free text"}</span>
        <label className="flex items-center gap-1">Asked
          <select className={`${field} !w-auto`} disabled={busy} value={q.scope} onChange={(e) => patch({ scope: e.target.value })}>
            <option value="clip">after a recording</option><option value="final">once, at the end</option>
          </select>
        </label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={q.required} disabled={busy} onChange={(e) => patch({ required: e.target.checked })} /> Required</label>
        <span className="text-muted">{n} answer{n === 1 ? "" : "s"}</span>
        <button className={`${btn2} ml-auto`} disabled={busy} onClick={async () => {
          if (!confirm(n ? `Delete this question and its ${n} collected answers?` : "Delete this question?")) return;
          setBusy(true); await call("DELETE", `/api/admin/questions?id=${q.id}`); router.refresh(); setBusy(false);
        }}>Delete</button>
      </div>
      {q.scope === "clip" && (
        <div className="text-sm">
          <p className="mb-1 text-muted">Asked for:</p>
          <ClipPicker clips={clips} value={ids} disabled={busy} onChange={async (v) => {
            setIds(v); setIdsErr("");
            // A "selected clips" list is saved once at least one clip is ticked.
            if (v === null || v.length > 0) {
              try { await patch({ clipIds: v }); } catch (x) { setIdsErr((x as Error).message); }
            } else setIdsErr("Pick at least one clip, or choose every clip.");
          }} />
          {idsErr && <p className="mt-1 text-accent">{idsErr}</p>}
        </div>
      )}
      {q.kind === "scale" && (
        <div className="flex gap-2">
          <input className={field} defaultValue={q.low_label ?? ""} placeholder="Low end label" onBlur={(e) => e.target.value !== (q.low_label ?? "") && patch({ low: e.target.value })} />
          <input className={field} defaultValue={q.high_label ?? ""} placeholder="High end label" onBlur={(e) => e.target.value !== (q.high_label ?? "") && patch({ high: e.target.value })} />
        </div>
      )}
    </li>
  );
}
