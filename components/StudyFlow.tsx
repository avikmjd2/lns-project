"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLocale } from "@/locales";

type Q = {
  id: number; kind: "scale" | "text"; scope: "clip" | "final"; prompt: string;
  min: number; max: number; low: string | null; high: string | null; required: boolean; clipIds: number[] | null;
};
type StudyInfo = {
  slug: string; name: string; locale: string; status: string;
  base_language: string; mix_language: string;
  intro: string | null; debrief: string | null;
  questions: Q[];
};
type Clip = { id: number; url: string };
type Step = "loading" | "closed" | "welcome" | "about" | "clips" | "final" | "done";
type Answers = Record<number, number | string>;
type L = ReturnType<typeof getLocale>;

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function StudyFlow({ slug }: { slug: string }) {
  const [study, setStudy] = useState<StudyInfo | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [pid, setPid] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [idx, setIdx] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `lns_pid_${slug}`;

  const t = useMemo(() => getLocale(study?.locale), [study?.locale]);
  const clipQs = useMemo(() => study?.questions.filter((q) => q.scope === "clip") ?? [], [study]);
  const finalQs = useMemo(() => study?.questions.filter((q) => q.scope === "final") ?? [], [study]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/study/${slug}`);
        if (!r.ok) { setStep("closed"); return; }
        const s: StudyInfo = await r.json();
        setStudy(s);
        if (s.status !== "open") { setStep("closed"); return; }
        let saved: string | null = null;
        try { saved = localStorage.getItem(key); } catch {}
        if (saved) {
          const pr = await fetch(`/api/participant?id=${saved}`);
          if (pr.ok) {
            const p = await pr.json();
            if (p.completed) { setPid(saved); setClips(p.clips); setStep("done"); return; }
            const firstOpen = p.clips.findIndex((c: Clip) => !p.done.includes(c.id));
            const hasFinal = s.questions.some((q) => q.scope === "final");
            if (firstOpen >= 0) {
              setPid(saved); setClips(p.clips); setIdx(firstOpen); setResumed(p.done.length > 0); setStep("clips"); return;
            }
            if (p.clips.length > 0) {
              // All clips answered but not finished: collect final answers, or finish straight away.
              setPid(saved); setClips(p.clips); setResumed(true);
              if (hasFinal) { setStep("final"); return; }
              const cr = await post("/api/complete", { participantId: saved });
              if (cr.ok) { setStep("done"); return; }
            }
          }
        }
        setStep("welcome");
      } catch {
        setStep("closed");
      }
    })();
  }, [slug, key]);

  const start = useCallback(async (gender: string, age: number) => {
    setError(null);
    const r = await post("/api/participant", { slug, gender, age });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error === "no_clips" ? t.noClips : t.saveError);
      return;
    }
    const p = await r.json();
    try { localStorage.setItem(key, p.participantId); } catch {}
    setPid(p.participantId); setClips(p.clips); setIdx(0); setStep("clips");
  }, [slug, key, t]);

  async function finish(answers?: Answers) {
    const r = await post("/api/complete", { participantId: pid, answers });
    if (!r.ok) throw new Error("complete");
    setStep("done"); window.scrollTo({ top: 0 });
  }

  if (step === "loading" || !study) {
    return <Shell><p className="text-muted text-center py-24">…</p></Shell>;
  }
  const total = clips.length || 4;
  const progress = step === "welcome" ? 0.02 : step === "about" ? 0.08 : step === "clips" ? 0.12 + (0.84 * idx) / total : step === "final" ? 0.97 : 1;

  return (
    <Shell progress={step === "closed" ? undefined : progress}>
      {step === "closed" && (
        <Card><h1 className="text-2xl font-semibold">{t.closedTitle}</h1><p className="mt-3 text-muted">{t.closedBody}</p></Card>
      )}
      {step === "welcome" && <Welcome t={t} study={study} onStart={() => setStep("about")} />}
      {step === "about" && <About t={t} onSubmit={start} error={error} />}
      {step === "clips" && pid && clips[idx] && (
        <ClipStep
          key={clips[idx].id}
          t={t} questions={clipQs.filter((q) => !q.clipIds || q.clipIds.includes(clips[idx].id))} pid={pid} clip={clips[idx]} index={idx} total={clips.length}
          resumed={resumed && idx > 0}
          onSaved={async () => {
            if (idx + 1 < clips.length) { setIdx(idx + 1); setResumed(false); window.scrollTo({ top: 0 }); return; }
            if (finalQs.length) { setStep("final"); window.scrollTo({ top: 0 }); return; }
            await finish();
          }}
        />
      )}
      {step === "final" && pid && <FinalStep t={t} questions={finalQs} onDone={finish} />}
      {step === "done" && (
        <Card>
          <div className="text-5xl" aria-hidden>🎧</div>
          <h1 className="mt-4 text-2xl font-semibold">{t.thanksTitle}</h1>
          <p className="mt-2 text-muted">{t.thanksBody}</p>
          <h2 className="mt-8 text-lg font-semibold">{t.debriefTitle}</h2>
          <p className="mt-2 leading-relaxed">{study.debrief || t.defaultDebrief(study.base_language, study.mix_language)}</p>
        </Card>
      )}
    </Shell>
  );
}

function Shell({ children, progress }: { children: React.ReactNode; progress?: number }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-6 sm:pt-12">
      {progress !== undefined && (
        <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      {children}
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rise rounded-3xl border border-line bg-card p-6 shadow-sm sm:p-8">{children}</section>;
}

const primaryBtn = "mt-6 h-14 w-full rounded-2xl bg-brand text-lg font-semibold text-brand-ink transition active:scale-[0.99] disabled:opacity-40";

function Welcome({ t, study, onStart }: { t: L; study: StudyInfo; onStart: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <Card>
      <p className="text-sm font-medium text-brand">{study.name}</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">{t.welcomeTitle}</h1>
      <p className="mt-4 leading-relaxed">{study.intro || t.welcomeLead}</p>
      <ul className="mt-5 space-y-2">
        {t.welcomeFacts.map((f) => (
          <li key={f} className="flex gap-3 text-sm"><span className="mt-0.5 text-brand" aria-hidden>✓</span><span>{f}</span></li>
        ))}
      </ul>
      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-soft p-4 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--brand)]" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>{t.consent}</span>
      </label>
      <button disabled={!ok} onClick={onStart} className={primaryBtn}>{t.start}</button>
    </Card>
  );
}

function About({ t, onSubmit, error }: { t: L; onSubmit: (g: string, a: number) => Promise<void>; error: string | null }) {
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const ageN = Number(age);
  const ageOk = Number.isInteger(ageN) && ageN >= 18 && ageN <= 99;
  return (
    <Card>
      <h1 className="text-2xl font-semibold">{t.aboutYou}</h1>
      <p className="mt-1 text-muted">{t.aboutYouLead}</p>
      <fieldset className="mt-6">
        <legend className="font-medium">{t.genderQ}</legend>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {t.genders.map((g) => (
            <button key={g.v} type="button" onClick={() => setGender(g.v)} aria-pressed={gender === g.v}
              className={`h-14 rounded-2xl border-2 px-3 font-medium transition ${gender === g.v ? "border-brand bg-brand-soft" : "border-line bg-card"}`}>
              {g.t}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-6">
        <label htmlFor="age" className="font-medium">{t.ageQ}</label>
        <input id="age" inputMode="numeric" pattern="[0-9]*" value={age} placeholder={t.agePlaceholder}
          onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))} onBlur={() => setTouched(true)}
          className="mt-3 h-14 w-full rounded-2xl border-2 border-line bg-card px-4 text-lg outline-none focus:border-brand" />
        {touched && !ageOk && <p className="mt-2 text-sm text-accent">{t.ageError}</p>}
      </div>
      {error && <p className="mt-4 text-sm text-accent" role="alert">{error}</p>}
      <button disabled={!gender || !ageOk || busy}
        onClick={async () => { setBusy(true); await onSubmit(gender, ageN); setBusy(false); }}
        className={primaryBtn}>
        {busy ? t.saving : t.continue}
      </button>
    </Card>
  );
}

/** One question: a scale of buttons (any range, e.g. 1-5 or 1-10) or a free-text box. */
function QuestionField({ q, value, disabled, onChange, t }: {
  q: Q; value: number | string | undefined; disabled?: boolean; onChange: (v: number | string) => void; t: L;
}) {
  const id = `q-${q.id}`;
  if (q.kind === "text") {
    return (
      <div>
        <label htmlFor={id} className="mb-2 block font-medium">{q.prompt}{!q.required && <span className="font-normal text-muted"> {t.optional}</span>}</label>
        <textarea id={id} rows={4} maxLength={2000} disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}
          placeholder={t.textPlaceholder}
          className="w-full rounded-2xl border-2 border-line bg-card p-3 text-base outline-none focus:border-brand" />
      </div>
    );
  }
  const n = q.max - q.min + 1;
  const cols = n <= 6 ? n : n <= 10 ? 5 : 6;
  return (
    <div>
      <p className="mb-2 font-medium" id={`${id}-l`}>{q.prompt}{!q.required && <span className="font-normal text-muted"> {t.optional}</span>}</p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="radiogroup" aria-labelledby={`${id}-l`}>
        {Array.from({ length: n }, (_, i) => q.min + i).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} disabled={disabled}
            onClick={() => onChange(v)}
            className={`h-12 rounded-xl border-2 text-lg font-semibold transition active:scale-95 ${value === v ? "border-brand bg-brand text-brand-ink" : "border-line bg-card"}`}>
            {v}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted"><span>{q.low ?? ""}</span><span>{q.high ?? ""}</span></div>
    </div>
  );
}

function answered(q: Q, a: Answers) {
  const v = a[q.id];
  return q.kind === "scale" ? typeof v === "number" : typeof v === "string" && v.trim() !== "";
}
const canSubmit = (qs: Q[], a: Answers) => qs.every((q) => !q.required || answered(q, a));

function ClipStep(props: {
  t: L; questions: Q[]; pid: string; clip: Clip; index: number; total: number; resumed: boolean;
  onSaved: () => Promise<void>;
}) {
  const { t, questions, pid, clip, index, total } = props;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [maxPct, setMaxPct] = useState(0);
  const [audioFailed, setAudioFailed] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const unlocked = maxPct >= 80;
  const complete = canSubmit(questions, answers);

  function toggle() {
    const a = audioRef.current; if (!a) return;
    if (audioFailed) { setAudioFailed(false); a.load(); }
    if (a.paused) {
      a.play().catch((e: DOMException) => { if (e?.name !== "AbortError") setAudioFailed(true); });
    } else a.pause();
  }

  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await post("/api/rating", { participantId: pid, clipId: clip.id, answers, playedPct: maxPct });
      if (!r.ok) throw new Error("rating");
      await props.onSaved();
    } catch {
      setErr(t.saveError); setBusy(false);
    }
  }

  const encouragement = t.encouragement[Math.min(index, t.encouragement.length - 2)];
  const last = index + 1 === total;

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-brand">{t.clipOf(index + 1, total)}</p>
        <p className="text-sm text-muted">{last ? t.encouragement[3] : encouragement}</p>
      </div>
      {props.resumed && <p className="mt-2 rounded-xl bg-brand-soft px-3 py-2 text-sm">{t.resumeNote}</p>}

      <div className="mt-5 rounded-2xl bg-brand-soft p-4">
        <audio ref={audioRef} src={clip.url} preload="auto"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setMaxPct(100); }}
          onError={() => setAudioFailed(true)}
          onTimeUpdate={(e) => {
            const a = e.currentTarget; if (!a.duration) return;
            const pct = (a.currentTime / a.duration) * 100;
            setPos(pct); setMaxPct((m) => Math.max(m, Math.round(pct)));
          }} />
        <div className="flex items-center gap-4">
          <button onClick={toggle} aria-label={playing ? t.pause : t.play}
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand text-2xl text-brand-ink transition active:scale-95">
            {playing ? "❚❚" : maxPct >= 99 ? "↻" : "▶"}
          </button>
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-card">
              <div className="h-full rounded-full bg-brand" style={{ width: `${pos}%` }} />
            </div>
            <p className="mt-2 text-sm">{audioFailed ? t.audioError : unlocked ? t.listenDone : t.listenPrompt}</p>
          </div>
        </div>
      </div>

      <div className={`mt-6 transition-opacity ${unlocked ? "opacity-100" : "pointer-events-none opacity-40"}`} aria-disabled={!unlocked}>
        <div className="space-y-6">
          {questions.map((q) => (
            <QuestionField key={q.id} q={q} t={t} disabled={!unlocked} value={answers[q.id]}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
          ))}
        </div>
      </div>

      {!unlocked && <p className="mt-4 text-sm text-muted">{t.listenLocked}</p>}
      {unlocked && !complete && <p className="mt-4 text-sm text-muted">{t.missing}</p>}
      {err && <p className="mt-4 text-sm text-accent" role="alert">{err}</p>}
      <button disabled={!unlocked || !complete || busy} onClick={save} className={primaryBtn}>
        {busy ? t.saving : last ? t.finish : t.next}
      </button>
    </Card>
  );
}

function FinalStep({ t, questions, onDone }: { t: L; questions: Q[]; onDone: (a: Answers) => Promise<void> }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card>
      <h1 className="text-2xl font-semibold">{t.finalTitle}</h1>
      <p className="mt-1 text-muted">{t.finalLead}</p>
      <div className="mt-6 space-y-6">
        {questions.map((q) => (
          <QuestionField key={q.id} q={q} t={t} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
        ))}
      </div>
      {err && <p className="mt-4 text-sm text-accent" role="alert">{err}</p>}
      <button disabled={!canSubmit(questions, answers) || busy} className={primaryBtn}
        onClick={async () => {
          setBusy(true); setErr(null);
          try { await onDone(answers); } catch { setErr(t.saveError); setBusy(false); }
        }}>
        {busy ? t.saving : t.finish}
      </button>
    </Card>
  );
}
