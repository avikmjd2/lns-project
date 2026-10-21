"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { upload } from "@vercel/blob/client";
import {
  AudioLines, BarChart3, Check, ChevronDown, Copy, FileAudio, LayoutDashboard, ListChecks, LogOut, Mic, Plus, Trash2, Users, ArrowUp, ArrowDown, UploadCloud, ExternalLink,
} from "lucide-react";

export const btn = "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
export const btn2 = "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-medium transition hover:bg-brand-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
export const field = "w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-[var(--ring)]";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

async function call(method: string, url: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

/* ---------- shell / navigation ---------- */

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/recordings", label: "Recordings", icon: AudioLines },
  { href: "/admin/questions", label: "Questions", icon: ListChecks },
  { href: "/admin/responses", label: "Responses", icon: Users },
  { href: "/admin/results", label: "Results", icon: BarChart3 },
];

function ShellInner({ slugs, children }: { slugs: { slug: string; name: string }[]; children: React.ReactNode }) {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const study = sp.get("study") ?? slugs[0]?.slug ?? "";
  const q = study ? `?study=${study}` : "";
  const logout = async () => { await call("POST", "/api/admin/logout"); router.push("/admin/login"); };
  const switcher = slugs.length > 0 && (
    <div className="relative">
      <select value={study} onChange={(e) => router.push(`${path}?study=${e.target.value}`)} aria-label="Study"
        className={`${field} appearance-none pr-9 font-medium`}>
        {slugs.map((s) => <option key={s.slug} value={s.slug}>{s.name} ({s.slug})</option>)}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
  return (
    <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
      {/* desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-card lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink"><Mic size={18} /></span>
          <div><div className="font-display text-lg font-semibold leading-none">Voices</div><div className="text-xs text-muted">Admin panel</div></div>
        </div>
        <div className="px-4 pb-3"><p className={label}>Study</p>{switcher}</div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ href, label: l, icon: Icon }) => {
            const on = path === href;
            return (
              <Link key={href} href={`${href}${q}`}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${on ? "bg-brand text-brand-ink shadow-sm" : "text-muted hover:bg-brand-soft hover:text-foreground"}`}>
                <Icon size={18} /> {l}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-line p-3">
          {study && <a href={`/s/${study}`} target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-brand-soft hover:text-foreground"><ExternalLink size={18} /> View survey</a>}
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-accent-soft hover:text-accent"><LogOut size={18} /> Log out</button>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-ink"><Mic size={16} /></span><span className="font-display font-semibold">Admin</span></div>
          <div className="flex min-w-0 items-center gap-2"><div className="min-w-0 max-w-[55vw]">{switcher}</div>
            <button onClick={logout} aria-label="Log out" className={btn2}><LogOut size={16} /></button></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ href, label: l, icon: Icon }) => (
            <Link key={href} href={`${href}${q}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${path === href ? "bg-brand text-brand-ink" : "text-muted"}`}><Icon size={15} /> {l}</Link>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-9"><div className="mx-auto max-w-5xl">{children}</div></main>
    </div>
  );
}
export function AdminShell(props: { slugs: { slug: string; name: string }[]; children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen" />}><ShellInner {...props} /></Suspense>;
}

/* ---------- auth / setup ---------- */

export function LoginForm() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setErr(""); setBusy(true);
      try { await call("POST", "/api/admin/login", { password: pw }); router.push("/admin"); router.refresh(); }
      catch (x) { setErr((x as Error).message); setBusy(false); }
    }}>
      <div>
        <label htmlFor="pw" className={label}>Password</label>
        <input id="pw" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter admin password" className={`${field} h-12`} />
      </div>
      {err && <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent" role="alert">{err}</p>}
      <button className={`${btn} h-12 w-full`} disabled={busy || !pw}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function InitButton({ label: text = "Set up database" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  return (
    <div>
      <button className={btn} disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        try { await call("POST", "/api/admin/init"); router.refresh(); } catch (x) { setErr((x as Error).message); }
        setBusy(false);
      }}>{busy ? "Working…" : text}</button>
      {err && <p className="mt-2 text-sm text-accent">{err}</p>}
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className={btn2} onClick={async () => {
      try { await navigator.clipboard.writeText(new URL(text, location.origin).toString()); setDone(true); setTimeout(() => setDone(false), 1500); } catch {}
    }}>{done ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy link</>}</button>
  );
}

/* ---------- study settings ---------- */

export function StudyControls({ study }: { study: { id: number; status: string; intro: string | null; debrief: string | null } }) {
  const router = useRouter();
  const [intro, setIntro] = useState(study.intro ?? "");
  const [debrief, setDebrief] = useState(study.debrief ?? "");
  const [msg, setMsg] = useState("");
  async function patch(b: object) { await call("PATCH", "/api/admin/studies", { id: study.id, ...b }); router.refresh(); setMsg("Saved"); setTimeout(() => setMsg(""), 1500); }
  const tones: Record<string, string> = { draft: "Not visible to participants", open: "Accepting participants", closed: "No longer accepting" };
  return (
    <div className="space-y-5">
      <div>
        <p className={label}>Status</p>
        <div className="inline-flex rounded-xl border border-line bg-card2 p-1">
          {["draft", "open", "closed"].map((s) => (
            <button key={s} onClick={() => patch({ status: s })}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition ${study.status === s ? "bg-brand text-brand-ink shadow-sm" : "text-muted hover:text-foreground"}`}>{s}</button>
          ))}
        </div>
        <span className="ml-3 text-sm text-muted">{tones[study.status]} {msg && <b className="text-brand">· {msg}</b>}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className={label}>Intro text <span className="normal-case">(blank = default)</span></label>
          <textarea className={field} rows={4} value={intro} onChange={(e) => setIntro(e.target.value)} /></div>
        <div><label className={label}>Debrief text <span className="normal-case">(blank = default)</span></label>
          <textarea className={field} rows={4} value={debrief} onChange={(e) => setDebrief(e.target.value)} /></div>
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
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault(); setErr("");
      try { await call("POST", "/api/admin/studies", f); router.push(`/admin?study=${f.slug}`); router.refresh(); }
      catch (x) { setErr((x as Error).message); }
    }}>
      <div><label className={label}>URL slug</label><input className={field} placeholder="bangla" value={f.slug} onChange={set("slug")} required /></div>
      <div><label className={label}>Study name</label><input className={field} placeholder="Voices & Speaking Styles (Bangla)" value={f.name} onChange={set("name")} required /></div>
      <div><label className={label}>Base language</label><input className={field} placeholder="Bangla" value={f.baseLanguage} onChange={set("baseLanguage")} required /></div>
      <div><label className={label}>Mixed-in language</label><input className={field} value={f.mixLanguage} onChange={set("mixLanguage")} /></div>
      <div><label className={label}>UI locale</label><input className={field} value={f.locale} onChange={set("locale")} /></div>
      <div className="flex items-end"><button className={`${btn} w-full`}><Plus size={16} /> Create study (draft)</button></div>
      {err && <p className="text-sm text-accent sm:col-span-2">{err}</p>}
    </form>
  );
}

/* ---------- recordings ---------- */

export function UploadForm({ studyId }: { studyId: number }) {
  const router = useRouter();
  const [f, setF] = useState({ speakerId: "", speakerGender: "female", guise: "mixed", formA: false, formB: false });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const chip = (on: boolean) => `cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-medium transition ${on ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-card hover:border-brand/50"}`;
  return (
    <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault(); if (!file) return; setBusy(true); setErr("");
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
        const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const blob = await upload(`clips/${rand}.${ext}`, file, { access: "public", handleUploadUrl: "/api/admin/upload", contentType: file.type || undefined });
        await call("POST", "/api/admin/clips", { studyId, url: blob.url, label: `S${rand.slice(0, 4)}`, ...f });
        setFile(null); setF({ ...f, speakerId: "" }); router.refresh();
      } catch (x) {
        let msg = (x as Error).message;
        // The Blob client hides the server's reason; ask the endpoint directly for it.
        if (/client token/i.test(msg)) {
          try {
            const r = await fetch("/api/admin/upload", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname: "clips/diagnostic.mp3", clientPayload: null, multipart: false } }) });
            if (!r.ok) msg = (await r.json().catch(() => ({}))).error || msg;
          } catch {}
        }
        setErr(msg);
      }
      setBusy(false);
    }}>
      <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${file ? "border-brand bg-brand-soft" : "border-line hover:border-brand/60 hover:bg-card2"}`}>
        {file ? <FileAudio className="text-brand" size={28} /> : <UploadCloud className="text-muted" size={28} />}
        <span className="text-sm font-medium">{file ? file.name : "Choose an audio file"}</span>
        <span className="text-xs text-muted">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "mp3, wav, m4a, ogg · up to 50 MB"}</span>
        <input type="file" accept="audio/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className={label}>Speaker ID</label>
          <input className={field} placeholder="e.g. M1, F2" value={f.speakerId} onChange={(e) => setF({ ...f, speakerId: e.target.value })} required /></div>
        <div><label className={label}>Speaker gender</label>
          <div className="flex gap-2">{(["female", "male"] as const).map((g) => <button type="button" key={g} onClick={() => setF({ ...f, speakerGender: g })} className={`${chip(f.speakerGender === g)} flex-1 capitalize`}>{g}</button>)}</div></div>
        <div><label className={label}>Style</label>
          <div className="flex gap-2">{([["mixed", "Code-mixed"], ["pure", "Pure"]] as const).map(([v, t]) => <button type="button" key={v} onClick={() => setF({ ...f, guise: v })} className={`${chip(f.guise === v)} flex-1`}>{t}</button>)}</div></div>
      </div>
      <div>
        <p className={label}>Include in</p>
        <div className="flex flex-wrap gap-2">
          <label className={chip(f.formA)}><input type="checkbox" className="sr-only" checked={f.formA} onChange={(e) => setF({ ...f, formA: e.target.checked })} /> Form A</label>
          <label className={chip(f.formB)}><input type="checkbox" className="sr-only" checked={f.formB} onChange={(e) => setF({ ...f, formB: e.target.checked })} /> Form B</label>
        </div>
      </div>
      {err && <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">{err}</p>}
      <button className={btn} disabled={busy || !file}>{busy ? "Uploading…" : <><UploadCloud size={16} /> Upload clip</>}</button>
    </form>
  );
}

export function ClipActions({ id, formA, formB }: { id: number; formA: boolean; formB: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const patch = async (b: object) => { setBusy(true); await call("PATCH", "/api/admin/clips", { id, ...b }); router.refresh(); setBusy(false); };
  const chip = (on: boolean) => `cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${on ? "border-brand bg-brand text-brand-ink" : "border-line text-muted hover:border-brand/50"}`;
  return (
    <div className="flex items-center gap-2">
      <label className={chip(formA)}><input type="checkbox" className="sr-only" checked={formA} disabled={busy} onChange={(e) => patch({ formA: e.target.checked })} />Form A</label>
      <label className={chip(formB)}><input type="checkbox" className="sr-only" checked={formB} disabled={busy} onChange={(e) => patch({ formB: e.target.checked })} />Form B</label>
      <button className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-accent-soft hover:text-accent" disabled={busy} aria-label="Delete clip" onClick={async () => {
        if (!confirm("Delete this clip and all answers for it?")) return;
        setBusy(true); await call("DELETE", `/api/admin/clips?id=${id}`); router.refresh(); setBusy(false);
      }}><Trash2 size={16} /></button>
    </div>
  );
}

export function DeleteParticipant({ id, studyId, all }: { id?: string; studyId?: number; all?: boolean }) {
  const router = useRouter();
  return (
    <button className={all ? btn2 : "grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-accent-soft hover:text-accent"} aria-label={all ? "Clear all test data" : "Delete participant"}
      onClick={async () => {
        if (!confirm(all ? "Delete ALL participants and answers in this study?" : "Delete this participant?")) return;
        await call("DELETE", all ? `/api/admin/participants?studyId=${studyId}&all=1` : `/api/admin/participants?id=${id}`);
        router.refresh();
      }}>{all ? <><Trash2 size={15} /> Clear all test data</> : <Trash2 size={16} />}</button>
  );
}

/* ---------- questions ---------- */

export type ClipOpt = { id: number; label: string };

/** "Every clip" or a checklist of specific clips. value null = every clip. */
function ClipPicker({ clips, value, onChange, disabled }: { clips: ClipOpt[]; value: number[] | null; onChange: (v: number[] | null) => void; disabled?: boolean }) {
  const chip = (on: boolean) => `rounded-lg border px-3 py-1.5 text-sm font-medium transition ${on ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-card text-muted hover:border-brand/50"}`;
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl border border-line bg-card2 p-1">
        <button type="button" disabled={disabled} onClick={() => onChange(null)} className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${!value ? "bg-brand text-brand-ink shadow-sm" : "text-muted"}`}>Every clip</button>
        <button type="button" disabled={disabled} onClick={() => onChange(value ?? clips.slice(0, 1).map((c) => c.id))} className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${value ? "bg-brand text-brand-ink shadow-sm" : "text-muted"}`}>Selected clips</button>
      </div>
      {value && (
        <div className="flex flex-wrap gap-2">
          {clips.length === 0 && <p className="text-sm text-muted">Upload clips first.</p>}
          {clips.map((c) => (
            <label key={c.id} className={`cursor-pointer ${chip(value.includes(c.id))}`}>
              <input type="checkbox" className="sr-only" disabled={disabled} checked={value.includes(c.id)}
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
  const seg = (on: boolean) => `flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${on ? "bg-brand text-brand-ink shadow-sm" : "text-muted hover:text-foreground"}`;
  return (
    <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      try {
        await call("POST", "/api/admin/questions", { studyId, ...f, clipIds: f.scope === "clip" ? clipIds : null });
        setF({ ...f, prompt: "" }); router.refresh();
      } catch (x) { setErr((x as Error).message); }
      setBusy(false);
    }}>
      <div><label className={label}>Question</label>
        <input className={`${field} h-12 text-base`} placeholder="e.g. How friendly does this speaker sound?" value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} required maxLength={300} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><p className={label}>Answer type</p>
          <div className="flex rounded-xl border border-line bg-card2 p-1">
            <button type="button" className={seg(f.kind === "scale")} onClick={() => setF({ ...f, kind: "scale" })}>Scale</button>
            <button type="button" className={seg(f.kind === "text")} onClick={() => setF({ ...f, kind: "text" })}>Free text</button></div></div>
        <div><p className={label}>Ask</p>
          <div className="flex rounded-xl border border-line bg-card2 p-1">
            <button type="button" className={seg(f.scope === "clip")} onClick={() => setF({ ...f, scope: "clip" })}>After a recording</button>
            <button type="button" className={seg(f.scope === "final")} onClick={() => setF({ ...f, scope: "final" })}>Once, at the end</button></div></div>
      </div>
      {isScale && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div><label className={label}>From</label><input type="number" className={field} min={0} max={10} value={f.scaleMin} onChange={(e) => setF({ ...f, scaleMin: Number(e.target.value) })} /></div>
          <div><label className={label}>To</label><input type="number" className={field} min={1} max={11} value={f.scaleMax} onChange={(e) => setF({ ...f, scaleMax: Number(e.target.value) })} /></div>
          <div><label className={label}>Low-end label</label><input className={field} value={f.low} onChange={(e) => setF({ ...f, low: e.target.value })} /></div>
          <div><label className={label}>High-end label</label><input className={field} value={f.high} onChange={(e) => setF({ ...f, high: e.target.value })} /></div>
        </div>
      )}
      {f.scope === "clip" && <div><p className={label}>Ask this for</p><ClipPicker clips={clips} value={clipIds} onChange={setClipIds} /></div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} /> Required</label>
        <button className={btn} disabled={busy}>{busy ? "Adding…" : <><Plus size={16} /> Add question</>}</button>
      </div>
      {err && <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">{err}</p>}
    </form>
  );
}

export function QuestionRow({ q, n, clips, index }: {
  clips: ClipOpt[]; index: number;
  q: { clip_ids: number[] | null; id: number; kind: string; scope: string; prompt: string; scale_min: number; scale_max: number; low_label: string | null; high_label: string | null; required: boolean };
  n: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(q.prompt);
  const [busy, setBusy] = useState(false);
  const [ids, setIds] = useState<number[] | null>(q.clip_ids);
  const [idsErr, setIdsErr] = useState("");
  const patch = async (b: object) => { setBusy(true); try { await call("PATCH", "/api/admin/questions", { id: q.id, ...b }); router.refresh(); } finally { setBusy(false); } };
  const applies = q.scope === "final" ? "Once, at the end" : q.clip_ids ? `${q.clip_ids.length} clip${q.clip_ids.length === 1 ? "" : "s"}` : "Every clip";
  const pill = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  return (
    <li className="surface rounded-2xl">
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-card2 text-sm font-semibold text-muted">{index}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{q.prompt}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className={`${pill} bg-brand-soft text-brand-strong`}>{q.kind === "scale" ? `Scale ${q.scale_min}–${q.scale_max}` : "Free text"}</span>
            <span className={`${pill} border border-line text-muted`}>{applies}</span>
            {!q.required && <span className={`${pill} border border-line text-muted`}>Optional</span>}
            <span className={`${pill} text-muted`}>{n} answer{n === 1 ? "" : "s"}</span>
          </div>
        </div>
        <button className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-card2 disabled:opacity-30" disabled={busy} aria-label="Move up" onClick={() => patch({ move: "up" })}><ArrowUp size={16} /></button>
        <button className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-card2 disabled:opacity-30" disabled={busy} aria-label="Move down" onClick={() => patch({ move: "down" })}><ArrowDown size={16} /></button>
        <button className={btn2} onClick={() => setOpen(!open)} aria-expanded={open}>Edit <ChevronDown size={15} className={`transition ${open ? "rotate-180" : ""}`} /></button>
      </div>
      {open && (
        <div className="space-y-5 border-t border-line p-4 sm:p-5">
          <div><label className={label}>Question text</label>
            <input className={field} value={prompt} maxLength={300} onChange={(e) => setPrompt(e.target.value)}
              onBlur={() => prompt.trim() && prompt !== q.prompt && patch({ prompt })} /></div>
          {q.kind === "scale" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={label}>Low-end label</label><input className={field} defaultValue={q.low_label ?? ""} onBlur={(e) => e.target.value !== (q.low_label ?? "") && patch({ low: e.target.value })} /></div>
              <div><label className={label}>High-end label</label><input className={field} defaultValue={q.high_label ?? ""} onBlur={(e) => e.target.value !== (q.high_label ?? "") && patch({ high: e.target.value })} /></div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <div className="inline-flex rounded-xl border border-line bg-card2 p-1">
              {([["clip", "After a recording"], ["final", "Once, at the end"]] as const).map(([v, t]) => (
                <button key={v} disabled={busy} onClick={() => patch({ scope: v })} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${q.scope === v ? "bg-brand text-brand-ink shadow-sm" : "text-muted"}`}>{t}</button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={q.required} disabled={busy} onChange={(e) => patch({ required: e.target.checked })} /> Required</label>
          </div>
          {q.scope === "clip" && (
            <div><p className={label}>Asked for</p>
              <ClipPicker clips={clips} value={ids} disabled={busy} onChange={async (v) => {
                setIds(v); setIdsErr("");
                if (v === null || v.length > 0) { try { await patch({ clipIds: v }); } catch (x) { setIdsErr((x as Error).message); } }
                else setIdsErr("Pick at least one clip, or choose every clip.");
              }} />
              {idsErr && <p className="mt-2 text-sm text-accent">{idsErr}</p>}
            </div>
          )}
          <div className="flex justify-end border-t border-line pt-4">
            <button className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-accent transition hover:bg-accent-soft" disabled={busy} onClick={async () => {
              if (!confirm(n ? `Delete this question and its ${n} collected answers?` : "Delete this question?")) return;
              setBusy(true); await call("DELETE", `/api/admin/questions?id=${q.id}`); router.refresh(); setBusy(false);
            }}><Trash2 size={15} /> Delete question</button>
          </div>
        </div>
      )}
    </li>
  );
}
