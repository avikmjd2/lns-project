"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { upload } from "@vercel/blob/client";
import { ArrowDown, ArrowUp, ArrowUpRight, Check, Copy, Plus, Trash2, UploadCloud, AudioLines } from "lucide-react";

// Button / field class names. The styles live in globals.css (.btn, .btn-outline, .field, .choice).
export const btn = "btn btn-sm";
export const btn2 = "btn btn-sm btn-outline";
export const field = "field";
const label = "label mb-1.5 block";

async function call(method: string, url: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

/** Segmented control made of joined rectangles. */
function Seg<T extends string>({ value, options, onChange, disabled }: { value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex" role="group">
      {options.map(([v, text], i) => (
        <button key={v} type="button" disabled={disabled} aria-pressed={value === v} onClick={() => onChange(v)}
          className={`choice !px-3.5 !py-2 text-[0.95rem] ${i > 0 ? "-ml-px" : ""}`}>{text}</button>
      ))}
    </div>
  );
}

/* ---------- shell / navigation ---------- */

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/recordings", label: "Recordings" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/responses", label: "Responses" },
  { href: "/admin/results", label: "Results" },
];

function ShellInner({ slugs, children }: { slugs: { slug: string; name: string }[]; children: React.ReactNode }) {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const study = sp.get("study") ?? slugs[0]?.slug ?? "";
  const q = study ? `?study=${study}` : "";
  const logout = async () => { await call("POST", "/api/admin/logout"); router.push("/admin/login"); };
  const switcher = slugs.length > 0 && (
    <select value={study} onChange={(e) => router.push(`${path}?study=${e.target.value}`)} aria-label="Study" className="field min-h-11 !py-2.5 !text-[1rem]">
      {slugs.map((s) => <option key={s.slug} value={s.slug}>{s.name} ({s.slug})</option>)}
    </select>
  );
  return (
    <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
      {/* desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink lg:flex">
        <div className="border-b border-ink px-6 py-6">
          <div className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 bg-signal" aria-hidden /><span className="text-[1.6rem] font-medium leading-none tracking-[-0.02em]">Voices</span></div>
          <p className="label mt-2">Admin</p>
        </div>
        <div className="border-b border-rule px-6 py-5"><p className="label mb-2">Study</p>{switcher}</div>
        <nav className="flex-1 py-3">
          {NAV.map(({ href, label: l }, i) => {
            const on = path === href;
            return (
              <Link key={href} href={`${href}${q}`}
                className={`grid grid-cols-[2.2rem_1fr] items-baseline border-l-[3px] py-2.5 pl-[21px] pr-6 text-[1.1rem] transition-colors ${on ? "border-signal bg-sunk" : "border-transparent text-ink/75 hover:bg-sunk hover:text-ink"}`}>
                <span className={`numeral text-[12px] ${on ? "text-signal" : "text-muted"}`}>{String(i + 1).padStart(2, "0")}</span>{l}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-rule px-6 py-4">
          {study && <a href={`/s/${study}`} target="_blank" className="btn-quiet">View survey <ArrowUpRight size={13} /></a>}
          <div><button onClick={logout} className="btn-quiet">Log out</button></div>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-20 border-b border-ink bg-paper lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2"><i className="inline-block h-2 w-2 bg-signal" aria-hidden /><span className="text-[1.25rem] font-medium">Voices</span><span className="label">Admin</span></div>
          <div className="flex min-w-0 items-center gap-3"><div className="min-w-0 max-w-[45vw]">{switcher}</div><button onClick={logout} className="btn-quiet">Out</button></div>
        </div>
        <nav className="flex gap-5 overflow-x-auto px-4">
          {NAV.map(({ href, label: l }) => (
            <Link key={href} href={`${href}${q}`}
              className={`shrink-0 border-b-2 py-3 text-[1rem] ${path === href ? "border-signal text-ink" : "border-transparent text-muted"}`}>{l}</Link>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-5 py-8 sm:px-10 sm:py-12"><div className="mx-auto max-w-5xl">{children}</div></main>
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
    <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault(); setErr(""); setBusy(true);
      try { await call("POST", "/api/admin/login", { password: pw }); router.push("/admin"); router.refresh(); }
      catch (x) { setErr((x as Error).message); setBusy(false); }
    }}>
      <div>
        <label htmlFor="pw" className={label}>Password</label>
        <input id="pw" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} className="field !py-3" />
      </div>
      {err && <p className="border-l-2 border-signal pl-3 text-[1rem] text-signal" role="alert">{err}</p>}
      <button className="btn w-full" disabled={busy || !pw}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function InitButton({ label: text = "Set up database" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  return (
    <div>
      <button className="btn" disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        try { await call("POST", "/api/admin/init"); router.refresh(); } catch (x) { setErr((x as Error).message); }
        setBusy(false);
      }}>{busy ? "Working…" : text}</button>
      {err && <p className="mt-2 text-signal">{err}</p>}
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className={btn2} onClick={async () => {
      try { await navigator.clipboard.writeText(new URL(text, location.origin).toString()); setDone(true); setTimeout(() => setDone(false), 1500); } catch {}
    }}>{done ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}</button>
  );
}

/* ---------- study settings ---------- */

export function StudyControls({ study }: { study: { id: number; status: string; intro: string | null; debrief: string | null } }) {
  const router = useRouter();
  const [intro, setIntro] = useState(study.intro ?? "");
  const [debrief, setDebrief] = useState(study.debrief ?? "");
  const [msg, setMsg] = useState("");
  async function patch(b: object) { await call("PATCH", "/api/admin/studies", { id: study.id, ...b }); router.refresh(); setMsg("Saved"); setTimeout(() => setMsg(""), 1500); }
  const notes: Record<string, string> = { draft: "Not visible to participants.", open: "Accepting participants.", closed: "No longer accepting participants." };
  return (
    <div className="space-y-7">
      <div>
        <p className={label}>Status</p>
        <div className="flex flex-wrap items-center gap-4">
          <Seg value={study.status as "draft"} options={[["draft", "Draft"], ["open", "Open"], ["closed", "Closed"]]} onChange={(s) => patch({ status: s })} />
          <span className="text-muted">{notes[study.status]} {msg && <b className="text-signal">{msg}</b>}</span>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div><label className={label}>Intro text (blank = default)</label><textarea aria-label="Intro text (blank = default)" className="field" rows={5} value={intro} onChange={(e) => setIntro(e.target.value)} /></div>
        <div><label className={label}>Debrief text (blank = default)</label><textarea aria-label="Debrief text (blank = default)" className="field" rows={5} value={debrief} onChange={(e) => setDebrief(e.target.value)} /></div>
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
    <form className="grid gap-5 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault(); setErr("");
      try { await call("POST", "/api/admin/studies", f); router.push(`/admin?study=${f.slug}`); router.refresh(); }
      catch (x) { setErr((x as Error).message); }
    }}>
      <div><label className={label}>URL slug</label><input aria-label="URL slug" className="field" placeholder="bangla" value={f.slug} onChange={set("slug")} required /></div>
      <div><label className={label}>Study name</label><input aria-label="Study name" className="field" placeholder="Voices & Speaking Styles (Bangla)" value={f.name} onChange={set("name")} required /></div>
      <div><label className={label}>Base language</label><input aria-label="Base language" className="field" placeholder="Bangla" value={f.baseLanguage} onChange={set("baseLanguage")} required /></div>
      <div><label className={label}>Mixed-in language</label><input aria-label="Mixed-in language" className="field" value={f.mixLanguage} onChange={set("mixLanguage")} /></div>
      <div><label className={label}>UI locale</label><input aria-label="UI locale" className="field" value={f.locale} onChange={set("locale")} /></div>
      <div className="flex items-end"><button className="btn btn-sm w-full"><Plus size={14} /> Create study (draft)</button></div>
      {err && <p className="text-signal sm:col-span-2">{err}</p>}
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
  return (
    <form className="space-y-6" onSubmit={async (e) => {
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
      <label className={`flex cursor-pointer flex-col items-center gap-2 border border-dashed px-4 py-9 text-center transition-colors ${file ? "border-ink bg-sunk" : "border-ink/40 hover:border-ink hover:bg-sunk"}`}>
        <UploadCloud size={22} className="text-muted" />
        <span className="text-[1.05rem]">{file ? file.name : "Choose an audio file"}</span>
        <span className="label">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "mp3, wav, m4a, ogg · up to 50 MB"}</span>
        <input type="file" accept="audio/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="grid gap-5 sm:grid-cols-3">
        <div><label className={label}>Speaker ID</label>
          <input aria-label="Speaker ID" className="field" placeholder="e.g. M1, F2" value={f.speakerId} onChange={(e) => setF({ ...f, speakerId: e.target.value })} required /></div>
        <div><p className={label}>Speaker gender</p><Seg value={f.speakerGender as "female"} options={[["female", "Female"], ["male", "Male"]]} onChange={(v) => setF({ ...f, speakerGender: v })} /></div>
        <div><p className={label}>Style</p><Seg value={f.guise as "mixed"} options={[["mixed", "Code-mixed"], ["pure", "Pure"]]} onChange={(v) => setF({ ...f, guise: v })} /></div>
      </div>
      <div>
        <p className={label}>Include in</p>
        <div className="flex gap-2">
          <button type="button" aria-pressed={f.formA} onClick={() => setF({ ...f, formA: !f.formA })} className="choice !py-2">Form A</button>
          <button type="button" aria-pressed={f.formB} onClick={() => setF({ ...f, formB: !f.formB })} className="choice !py-2">Form B</button>
        </div>
      </div>
      {err && <p className="border-l-2 border-signal pl-3 text-signal">{err}</p>}
      <button className="btn" disabled={busy || !file}>{busy ? "Uploading…" : <><UploadCloud size={15} /> Upload clip</>}</button>
    </form>
  );
}

export function ClipActions({ id, formA, formB }: { id: number; formA: boolean; formB: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const patch = async (b: object) => { setBusy(true); await call("PATCH", "/api/admin/clips", { id, ...b }); router.refresh(); setBusy(false); };
  return (
    <div className="flex items-center gap-2">
      <button className="choice !px-2.5 !py-1 !text-[0.85rem]" aria-pressed={formA} disabled={busy} onClick={() => patch({ formA: !formA })}>Form A</button>
      <button className="choice !px-2.5 !py-1 !text-[0.85rem]" aria-pressed={formB} disabled={busy} onClick={() => patch({ formB: !formB })}>Form B</button>
      <button className="btn-quiet !p-1 hover:!text-signal" disabled={busy} aria-label="Delete clip" onClick={async () => {
        if (!confirm("Delete this clip and all answers for it?")) return;
        setBusy(true); await call("DELETE", `/api/admin/clips?id=${id}`); router.refresh(); setBusy(false);
      }}><Trash2 size={15} /></button>
    </div>
  );
}

export function SyncButton({ studyId }: { studyId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-3">
      <button className={btn} disabled={busy} onClick={async () => {
        setBusy(true); setMsg("");
        try { await call("POST", "/api/admin/sync-recordings", { studyId }); setMsg("Synced."); router.refresh(); }
        catch (e) { setMsg((e as Error).message); }
        setBusy(false);
      }}><AudioLines size={14} /> {busy ? "Syncing…" : "Sync recordings"}</button>
      {msg && <span className="text-muted">{msg}</span>}
    </div>
  );
}

export function DeleteParticipant({ id, studyId, all }: { id?: string; studyId?: number; all?: boolean }) {
  const router = useRouter();
  return (
    <button className={all ? btn2 : "btn-quiet !p-1 hover:!text-signal"} aria-label={all ? "Clear all test data" : "Delete participant"}
      onClick={async () => {
        if (!confirm(all ? "Delete ALL participants and answers in this study?" : "Delete this participant?")) return;
        await call("DELETE", all ? `/api/admin/participants?studyId=${studyId}&all=1` : `/api/admin/participants?id=${id}`);
        router.refresh();
      }}>{all ? <><Trash2 size={14} /> Clear all test data</> : <Trash2 size={15} />}</button>
  );
}

/* ---------- questions ---------- */

export type ClipOpt = { id: number; label: string };

/** "Every clip" or a checklist of specific clips. value null = every clip. */
function ClipPicker({ clips, value, onChange, disabled }: { clips: ClipOpt[]; value: number[] | null; onChange: (v: number[] | null) => void; disabled?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="inline-flex" role="group">
        <button type="button" disabled={disabled} aria-pressed={!value} onClick={() => onChange(null)} className="choice !px-3.5 !py-2 text-[0.95rem]">Every clip</button>
        <button type="button" disabled={disabled} aria-pressed={!!value} onClick={() => onChange(value ?? clips.slice(0, 1).map((c) => c.id))} className="choice -ml-px !px-3.5 !py-2 text-[0.95rem]">Selected clips</button>
      </div>
      {value && (
        <div className="flex flex-wrap gap-2">
          {clips.length === 0 && <p className="text-muted">Upload clips first.</p>}
          {clips.map((c) => {
            const on = value.includes(c.id);
            return (
              <button key={c.id} type="button" disabled={disabled} aria-pressed={on}
                onClick={() => onChange(on ? value.filter((x) => x !== c.id) : [...value, c.id])} className="choice !px-3 !py-1.5 !text-[0.92rem]">{c.label}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function QuestionForm({ studyId, clips }: { studyId: number; clips: ClipOpt[] }) {
  const router = useRouter();
  const [f, setF] = useState({ prompt: "", kind: "scale", scope: "clip", scaleMin: 1, scaleMax: 5, low: "Not at all", high: "Very", required: true });
  const [optionsText, setOptionsText] = useState("");
  const [clipIds, setClipIds] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <form className="space-y-6" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      try {
        await call("POST", "/api/admin/questions", { studyId, ...f, clipIds: f.scope === "clip" ? clipIds : null, options: f.kind === "choice" ? optionsText.split("\n") : undefined });
        setF({ ...f, prompt: "" }); setOptionsText(""); router.refresh();
      } catch (x) { setErr((x as Error).message); }
      setBusy(false);
    }}>
      <div><label className={label}>Question</label>
        <input aria-label="Question" className="field !py-3 !text-[1.1rem]" placeholder="e.g. How friendly does this speaker sound?" value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} required maxLength={300} /></div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div><p className={label}>Answer type</p><Seg value={f.kind as "scale"} options={[["scale", "Scale"], ["choice", "Choice"], ["text", "Free text"]]} onChange={(v) => setF({ ...f, kind: v })} /></div>
        <div><p className={label}>Ask</p><Seg value={f.scope as "clip"} options={[["clip", "After a recording"], ["final", "Once, at the end"]]} onChange={(v) => setF({ ...f, scope: v })} /></div>
      </div>
      {f.kind === "choice" && (
        <div><label className={label}>Options (one per line, 2 to 8)</label>
          <textarea aria-label="Options" className="field" rows={5} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder={"English\nHindi\nAnother language"} /></div>
      )}
      {f.kind === "scale" && (
        <div className="grid gap-5 sm:grid-cols-4">
          <div><label className={label}>From</label><input aria-label="From" type="number" className="field" min={0} max={10} value={f.scaleMin} onChange={(e) => setF({ ...f, scaleMin: Number(e.target.value) })} /></div>
          <div><label className={label}>To</label><input aria-label="To" type="number" className="field" min={1} max={11} value={f.scaleMax} onChange={(e) => setF({ ...f, scaleMax: Number(e.target.value) })} /></div>
          <div><label className={label}>Low-end label</label><input aria-label="Low-end label" className="field" value={f.low} onChange={(e) => setF({ ...f, low: e.target.value })} /></div>
          <div><label className={label}>High-end label</label><input aria-label="High-end label" className="field" value={f.high} onChange={(e) => setF({ ...f, high: e.target.value })} /></div>
        </div>
      )}
      {f.scope === "clip" && <div><p className={label}>Ask this for</p><ClipPicker clips={clips} value={clipIds} onChange={setClipIds} /></div>}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-5">
        <label className="flex cursor-pointer items-center gap-2.5"><input type="checkbox" className="h-4 w-4 accent-[var(--signal)]" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} /> Required</label>
        <button className="btn" disabled={busy}>{busy ? "Adding…" : <><Plus size={15} /> Add question</>}</button>
      </div>
      {err && <p className="border-l-2 border-signal pl-3 text-signal">{err}</p>}
    </form>
  );
}

export function QuestionRow({ q, n, clips, index }: {
  clips: ClipOpt[]; index: number;
  q: { clip_ids: number[] | null; id: number; kind: string; scope: string; prompt: string; scale_min: number; scale_max: number; low_label: string | null; high_label: string | null; required: boolean; options?: string[] | null };
  n: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(q.prompt);
  const [busy, setBusy] = useState(false);
  const [ids, setIds] = useState<number[] | null>(q.clip_ids);
  const [idsErr, setIdsErr] = useState("");
  const patch = async (b: object) => { setBusy(true); try { await call("PATCH", "/api/admin/questions", { id: q.id, ...b }); router.refresh(); } finally { setBusy(false); } };
  const applies = q.scope === "final" ? "once, at the end" : q.clip_ids ? `${q.clip_ids.length} clip${q.clip_ids.length === 1 ? "" : "s"}` : "every clip";
  return (
    <li className="border-b border-rule">
      <div className="grid grid-cols-[2.2rem_1fr_auto] items-start gap-x-3 py-4">
        <span className="numeral pt-1 text-[12px] text-signal">{String(index).padStart(2, "0")}</span>
        <div className="min-w-0">
          <p className="text-[1.15rem] leading-snug">{q.prompt}</p>
          <p className="label mt-1.5">
            {q.kind === "scale" ? `Scale ${q.scale_min}–${q.scale_max}` : q.kind === "choice" ? `Choice of ${q.options?.length ?? 0}` : "Free text"} · {applies}{!q.required && " · optional"} · <span className="numeral">{n}</span> answer{n === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-quiet !p-1.5" disabled={busy} aria-label="Move up" onClick={() => patch({ move: "up" })}><ArrowUp size={15} /></button>
          <button className="btn-quiet !p-1.5" disabled={busy} aria-label="Move down" onClick={() => patch({ move: "down" })}><ArrowDown size={15} /></button>
          <button className="btn btn-sm btn-outline ml-1" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Close" : "Edit"}</button>
        </div>
      </div>
      {open && (
        <div className="space-y-6 bg-sunk px-5 py-6">
          <div><label className={label}>Question text</label>
            <input aria-label="Question text" className="field" value={prompt} maxLength={300} onChange={(e) => setPrompt(e.target.value)}
              onBlur={() => prompt.trim() && prompt !== q.prompt && patch({ prompt })} /></div>
          {q.kind === "choice" && (
            <div><p className={label}>Options (fixed once created)</p><p className="text-[1.02rem] leading-relaxed">{(q.options ?? []).join(" · ")}</p></div>
          )}
          {q.kind === "scale" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className={label}>Low-end label</label><input aria-label="Low-end label" className="field" defaultValue={q.low_label ?? ""} onBlur={(e) => e.target.value !== (q.low_label ?? "") && patch({ low: e.target.value })} /></div>
              <div><label className={label}>High-end label</label><input aria-label="High-end label" className="field" defaultValue={q.high_label ?? ""} onBlur={(e) => e.target.value !== (q.high_label ?? "") && patch({ high: e.target.value })} /></div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-6">
            <Seg value={q.scope as "clip"} disabled={busy} options={[["clip", "After a recording"], ["final", "Once, at the end"]]} onChange={(v) => patch({ scope: v })} />
            <label className="flex cursor-pointer items-center gap-2.5"><input type="checkbox" className="h-4 w-4 accent-[var(--signal)]" checked={q.required} disabled={busy} onChange={(e) => patch({ required: e.target.checked })} /> Required</label>
          </div>
          {q.scope === "clip" && (
            <div><p className={label}>Asked for</p>
              <ClipPicker clips={clips} value={ids} disabled={busy} onChange={async (v) => {
                setIds(v); setIdsErr("");
                if (v === null || v.length > 0) { try { await patch({ clipIds: v }); } catch (x) { setIdsErr((x as Error).message); } }
                else setIdsErr("Pick at least one clip, or choose every clip.");
              }} />
              {idsErr && <p className="mt-2 text-signal">{idsErr}</p>}
            </div>
          )}
          <div className="flex justify-end border-t border-rule pt-4">
            <button className="btn-quiet hover:!text-signal" disabled={busy} onClick={async () => {
              if (!confirm(n ? `Delete this question and its ${n} collected answers?` : "Delete this question?")) return;
              setBusy(true); await call("DELETE", `/api/admin/questions?id=${q.id}`); router.refresh(); setBusy(false);
            }}><Trash2 size={13} /> Delete question</button>
          </div>
        </div>
      )}
    </li>
  );
}
