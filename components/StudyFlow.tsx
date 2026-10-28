"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock, Hand, Headphones, Mic, Pause, PartyPopper, Play, RotateCcw, ShieldCheck } from "lucide-react";
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

const btnPrimary =
  "inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-semibold text-brand-ink shadow-[0_6px_16px_-6px_var(--brand)] transition hover:brightness-110 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none";
const btnGhost =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-base font-medium text-muted transition hover:bg-card2 hover:text-foreground disabled:opacity-40";

export default function StudyFlow({ slug }: { slug: string }) {
  const [study, setStudy] = useState<StudyInfo | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [pid, setPid] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [idx, setIdx] = useState(0);
  const [clipFrac, setClipFrac] = useState(0);
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

  const start = useCallback(async (gender: string, age: number, firstLanguage: string) => {
    setError(null);
    const r = await post("/api/participant", { slug, gender, age, firstLanguage });
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
    return <Shell><div className="grid flex-1 place-items-center py-32"><div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-brand" /></div></Shell>;
  }
  const total = clips.length || 4;
  const progress =
    step === "welcome" ? 0.02 : step === "about" ? 0.07 :
    step === "clips" ? 0.1 + 0.85 * ((idx + clipFrac) / total) :
    step === "final" ? 0.97 : 1;
  const label = step === "clips" ? t.clipOf(idx + 1, total) : step === "final" ? t.finalTitle : step === "done" ? "" : study.name;

  return (
    <Shell progress={step === "closed" ? undefined : progress} label={label}>
      {step === "closed" && (
        <Card><div className="text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand"><Clock /></div>
          <h1 className="font-display text-2xl font-semibold">{t.closedTitle}</h1><p className="mt-2 text-muted">{t.closedBody}</p>
        </div></Card>
      )}
      {step === "welcome" && <Welcome t={t} study={study} onStart={() => setStep("about")} />}
      {step === "about" && <About t={t} onSubmit={start} error={error} />}
      {step === "clips" && pid && clips[idx] && (
        <ClipStep
          key={clips[idx].id}
          t={t} pid={pid} clip={clips[idx]} index={idx} total={clips.length}
          questions={clipQs.filter((q) => !q.clipIds || q.clipIds.includes(clips[idx].id))}
          resumed={resumed && idx > 0}
          onProgress={setClipFrac}
          onSaved={async () => {
            setClipFrac(0);
            if (idx + 1 < clips.length) { setIdx(idx + 1); setResumed(false); window.scrollTo({ top: 0 }); return; }
            if (finalQs.length) { setStep("final"); window.scrollTo({ top: 0 }); return; }
            await finish();
          }}
        />
      )}
      {step === "final" && pid && <FinalStep t={t} questions={finalQs} onDone={finish} />}
      {step === "done" && <Done t={t} study={study} />}
    </Shell>
  );
}

function Shell({ children, progress, label }: { children: React.ReactNode; progress?: number; label?: string }) {
  return (
    <div className="backdrop flex min-h-screen flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-sm"><Mic size={18} /></span>
          <span className="font-display text-lg font-semibold tracking-tight">Voices</span>
        </div>
        {label && <span className="max-w-[55%] truncate text-sm font-medium text-muted">{label}</span>}
      </header>
      {progress !== undefined && (
        <div className="mx-auto mt-4 w-full max-w-xl px-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand transition-all duration-700 ease-out" style={{ width: `${Math.max(2, progress * 100)}%` }} />
          </div>
        </div>
      )}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-16 pt-6 sm:pt-10">{children}</main>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`surface rise rounded-[28px] p-6 sm:p-9 ${className}`}>{children}</section>;
}

function Welcome({ t, study, onStart }: { t: L; study: StudyInfo; onStart: () => void }) {
  const [ok, setOk] = useState(false);
  const icons = [Clock, ShieldCheck, Headphones, Hand];
  return (
    <Card>
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-brand-ink shadow-lg"><Headphones size={30} /></div>
      <h1 className="font-display text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-4xl">{t.welcomeTitle}</h1>
      <p className="mt-4 text-[1.05rem] leading-relaxed text-muted">{study.intro || t.welcomeLead}</p>
      <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {t.welcomeFacts.map((f, i) => {
          const Icon = icons[i % icons.length];
          return (
            <li key={f} className="flex items-start gap-3 rounded-2xl bg-card2 p-3.5 text-sm leading-snug">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={16} /></span>
              <span>{f}</span>
            </li>
          );
        })}
      </ul>
      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-4 text-sm leading-snug transition hover:border-brand">
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${ok ? "border-brand bg-brand text-brand-ink" : "border-line"}`}>
          {ok && <Check size={16} strokeWidth={3} />}
        </span>
        <input type="checkbox" className="sr-only" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>{t.consent}</span>
      </label>
      <button disabled={!ok} onClick={onStart} className={`${btnPrimary} mt-5`}>{t.start} <ArrowRight size={20} /></button>
    </Card>
  );
}

const LANGUAGES = [
  "Afrikaans", "Arabic", "Bengali", "Bulgarian", "Cantonese", "Catalan", "Croatian",
  "Czech", "Danish", "Dutch", "English", "Estonian", "Filipino", "Finnish",
  "French", "German", "Greek", "Gujarati", "Hebrew", "Hindi", "Hungarian",
  "Indonesian", "Italian", "Japanese", "Kannada", "Korean", "Latvian", "Lithuanian",
  "Malay", "Malayalam", "Mandarin", "Marathi", "Norwegian", "Odia", "Persian",
  "Polish", "Portuguese", "Punjabi", "Romanian", "Russian", "Serbian", "Sinhala",
  "Slovak", "Slovenian", "Spanish", "Swahili", "Swedish", "Tamil", "Telugu",
  "Thai", "Turkish", "Ukrainian", "Urdu", "Vietnamese",
];

function About({ t, onSubmit, error }: { t: L; onSubmit: (g: string, a: number, lang: string) => Promise<void>; error: string | null }) {
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [lang, setLang] = useState("");
  const [otherLang, setOtherLang] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const ageN = Number(age);
  const ageOk = Number.isInteger(ageN) && ageN >= 18 && ageN <= 99;
  const effectiveLang = lang === "Other" ? otherLang.trim() : lang;
  const langOk = effectiveLang.length > 0;
  return (
    <Card>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t.aboutYou}</h1>
      <p className="mt-1.5 text-muted">{t.aboutYouLead}</p>
      <fieldset className="mt-7">
        <legend className="mb-3 font-medium">{t.genderQ}</legend>
        <div className="grid grid-cols-2 gap-3">
          {t.genders.map((g) => (
            <button key={g.v} type="button" onClick={() => setGender(g.v)} aria-pressed={gender === g.v}
              className={`h-14 rounded-2xl border-2 px-3 font-medium transition active:scale-[0.98] ${gender === g.v ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-card hover:border-brand/50"}`}>
              {g.t}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-6">
        <label htmlFor="age" className="mb-3 block font-medium">{t.ageQ}</label>
        <input id="age" inputMode="numeric" pattern="[0-9]*" value={age} placeholder={t.agePlaceholder}
          onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))} onBlur={() => setTouched(true)}
          className="h-14 w-full rounded-2xl border-2 border-line bg-card px-4 text-lg outline-none transition focus:border-brand" />
        {touched && !ageOk && <p className="mt-2 text-sm text-accent">{t.ageError}</p>}
      </div>
      {/* First language picker */}
      <div className="mt-6">
        <p className="mb-3 font-medium">What is your first language?</p>
        <div className="max-h-48 overflow-y-auto rounded-2xl border-2 border-line bg-card">
          <div className="grid grid-cols-2 gap-px bg-line">
            {[...LANGUAGES, "Other"].map((l) => (
              <button key={l} type="button" onClick={() => { setLang(l); if (l !== "Other") setOtherLang(""); }}
                className={`px-3 py-2.5 text-left text-sm font-medium transition ${
                  lang === l ? "bg-brand text-brand-ink" : "bg-card hover:bg-brand-soft hover:text-brand-strong"
                }`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {lang === "Other" && (
          <input
            id="lang-other"
            type="text"
            value={otherLang}
            onChange={(e) => setOtherLang(e.target.value.slice(0, 60))}
            placeholder="Please specify your language…"
            className="mt-3 h-12 w-full rounded-2xl border-2 border-brand bg-card px-4 text-base outline-none transition focus:border-brand"
            autoFocus
          />
        )}
      </div>
      {error && <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm text-accent" role="alert">{error}</p>}
      <button disabled={!gender || !ageOk || !langOk || busy}
        onClick={async () => { setBusy(true); await onSubmit(gender, ageN, effectiveLang); setBusy(false); }}
        className={`${btnPrimary} mt-7`}>
        {busy ? t.saving : <>{t.continue} <ArrowRight size={20} /></>}
      </button>
    </Card>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Decorative waveform: bars fill as the clip plays. Heights are seeded per clip so each looks different. */
function Waveform({ seed, progress, playing, compact }: { seed: number; progress: number; playing: boolean; compact?: boolean }) {
  const n = compact ? 36 : 56;
  return (
    <div className={`flex items-center gap-[3px] ${compact ? "h-8" : "h-16"}`} aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const h = 0.22 + 0.78 * Math.abs(Math.sin(i * 1.7 + seed) * Math.cos(i * 0.55 + seed * 2.3));
        const filled = (i + 1) / n <= progress / 100;
        return (
          <span key={i} className={`flex-1 rounded-full transition-colors duration-200 ${filled ? "bg-brand" : "bg-brand/25"}`}
            style={{
              height: `${h * 100}%`, transformOrigin: "center",
              animation: playing && !filled ? `equalize ${0.7 + (i % 5) * 0.12}s ease-in-out ${(i % 7) * 0.05}s infinite` : undefined,
            }} />
        );
      })}
    </div>
  );
}

function ClipStep(props: {
  t: L; questions: Q[]; pid: string; clip: Clip; index: number; total: number; resumed: boolean;
  onSaved: () => Promise<void>; onProgress: (f: number) => void;
}) {
  const { t, questions, pid, clip, index, total } = props;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [maxPct, setMaxPct] = useState(0);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const [audioFailed, setAudioFailed] = useState(false);
  const [phase, setPhase] = useState<"listen" | "ask">("listen");
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unlocked = maxPct >= 80 || audioFailed;
  const nq = questions.length;
  const { onProgress } = props;
  const curAnswered = answered(questions[qi], answers);
  useEffect(() => {
    onProgress(phase === "listen" ? 0 : nq ? 0.1 + 0.9 * Math.min(1, (qi + (curAnswered ? 1 : 0)) / nq) : 1);
  }, [phase, qi, curAnswered, nq, onProgress]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

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

  function goNext() {
    if (timer.current) clearTimeout(timer.current);
    if (qi + 1 < nq) setQi(qi + 1); else save();
  }
  function setAnswer(q: Q, v: number | string) {
    setAnswers((a) => ({ ...a, [q.id]: v }));
  }

  const last = index + 1 === total;
  const q = questions[qi];
  const isLastQ = qi + 1 === nq;
  const ready = !q || !q.required || answered(q, answers);

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={clip.url} preload="auto"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onEnded={() => { setPlaying(false); setMaxPct(100); }}
        onError={() => setAudioFailed(true)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget; setCur(a.currentTime); if (!a.duration) return;
          const pct = (a.currentTime / a.duration) * 100;
          setPos(pct); setMaxPct((m) => Math.max(m, Math.round(pct)));
        }} />

      {props.resumed && phase === "listen" && <p className="surface rounded-2xl bg-brand-soft px-4 py-3 text-sm">{t.resumeNote}</p>}

      {phase === "listen" ? (
        <Card className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">{t.clipOf(index + 1, total)}</p>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t.listenTitle}</h1>
          <div className="mt-7 rounded-3xl bg-card2 p-5">
            <Waveform seed={clip.id * 1.3} progress={pos} playing={playing} />
            <div className="mt-2 flex justify-between text-xs tabular-nums text-muted"><span>{mmss(cur)}</span><span>{dur ? mmss(dur) : "–:––"}</span></div>
          </div>
          <button onClick={toggle} aria-label={playing ? t.pause : t.play}
            className="pop mx-auto mt-6 grid h-20 w-20 place-items-center rounded-full bg-brand text-brand-ink shadow-[0_10px_24px_-8px_var(--brand)] transition hover:brightness-110 active:scale-95">
            {playing ? <Pause size={32} fill="currentColor" /> : maxPct >= 99 ? <RotateCcw size={30} /> : <Play size={32} fill="currentColor" className="ml-1" />}
          </button>
          <p className={`mt-4 min-h-10 text-sm ${audioFailed ? "text-accent" : "text-muted"}`}>
            {audioFailed ? t.audioError : unlocked ? t.listenDone : t.listenPrompt}
          </p>
          {err && <p className="mb-2 text-sm text-accent" role="alert">{err}</p>}
          <button disabled={!unlocked || busy} onClick={() => (nq ? setPhase("ask") : save())} className={`${btnPrimary} mt-2`}>
            {busy ? t.saving : nq ? <>{t.toQuestions} <ArrowRight size={20} /></> : last ? t.finish : t.next}
          </button>
        </Card>
      ) : (
        <>
          <div className="surface flex items-center gap-3 rounded-2xl p-3">
            <button onClick={toggle} aria-label={playing ? t.pause : t.replay}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand transition hover:brightness-95 active:scale-95">
              {playing ? <Pause size={18} fill="currentColor" /> : <RotateCcw size={18} />}
            </button>
            <div className="min-w-0 flex-1"><Waveform compact seed={clip.id * 1.3} progress={pos} playing={playing} /></div>
            <span className="pr-1 text-xs font-medium text-muted">{t.replay}</span>
          </div>

          <Card className="!p-6 sm:!p-8">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-wider text-brand">{t.questionOf(qi + 1, nq)}</span>
              <div className="flex gap-1.5" aria-hidden>
                {questions.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === qi ? "w-6 bg-brand" : i < qi ? "w-3 bg-brand/60" : "w-3 bg-line"}`} />)}
              </div>
            </div>
            <div key={q.id} className="slide-in">
              <QuestionField
                q={q} t={t} value={answers[q.id]} onChange={(v) => setAnswer(q, v)} big
                feedbackValue={q.kind === "scale" ? (feedbacks[q.id] ?? "") : undefined}
                onFeedbackChange={q.kind === "scale" ? (v) => setFeedbacks((f) => ({ ...f, [q.id]: v })) : undefined}
              />
            </div>
            {err && <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm text-accent" role="alert">{err}</p>}
            <div className="mt-7 flex items-center gap-2">
              {qi > 0 && <button className={btnGhost} onClick={() => { if (timer.current) clearTimeout(timer.current); setQi(qi - 1); }}><ArrowLeft size={18} /> {t.back}</button>}
              <div className="flex-1" />
              {!q.required && !answered(q, answers) && !isLastQ && (
                <button className={btnGhost} onClick={goNext}>{t.skip}</button>
              )}
              <button disabled={!ready || busy} onClick={goNext} className={`${btnPrimary} !w-auto px-7`}>
                {busy ? t.saving : isLastQ ? (last ? t.finish : t.next) : t.next} {!busy && <ArrowRight size={20} />}
              </button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/** One question: a range slider (scale) or a free-text box. */
function QuestionField({ q, value, onChange, t, big, feedbackValue, onFeedbackChange }: {
  q: Q; value: number | string | undefined; onChange: (v: number | string) => void; t: L; big?: boolean;
  feedbackValue?: string; onFeedbackChange?: (v: string) => void;
}) {
  const id = `q-${q.id}`;
  const title = (
    <h2 className={`font-display font-semibold leading-snug tracking-tight ${big ? "text-2xl sm:text-[1.7rem]" : "text-lg"}`} id={`${id}-l`}>
      {q.prompt}{!q.required && <span className="ml-2 align-middle font-sans text-sm font-normal text-muted">{t.optional}</span>}
    </h2>
  );
  if (q.kind === "text") {
    return (
      <div>
        {title}
        <textarea id={id} rows={5} maxLength={2000} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}
          aria-labelledby={`${id}-l`} placeholder={t.textPlaceholder}
          className="mt-5 w-full resize-none rounded-2xl border-2 border-line bg-card p-4 text-base outline-none transition focus:border-brand" />
        <p className="mt-1 text-right text-xs text-muted">{((value as string) ?? "").length}/2000</p>
      </div>
    );
  }
  const sliderVal = typeof value === "number" ? value : Math.round((q.min + q.max) / 2);
  const pct = ((sliderVal - q.min) / (q.max - q.min)) * 100;
  return (
    <div>
      {title}
      <div className="mt-7">
        {/* Current value badge */}
        <div className="mb-4 flex justify-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand text-xl font-bold text-brand-ink shadow-[0_6px_18px_-6px_var(--brand)]">
            {sliderVal}
          </span>
        </div>
        {/* Slider */}
        <div className="relative px-1">
          <input
            id={id}
            type="range"
            min={q.min}
            max={q.max}
            step={1}
            value={sliderVal}
            aria-labelledby={`${id}-l`}
            onChange={(e) => onChange(Number(e.target.value))}
            className="slider-input w-full"
            style={{ "--pct": `${pct}%` } as React.CSSProperties}
          />
          {/* Tick marks */}
          <div className="pointer-events-none mt-2 flex justify-between px-0.5" aria-hidden>
            {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((v) => (
              <span key={v} className={`text-[11px] tabular-nums font-medium transition-colors ${
                v === sliderVal ? "text-brand" : "text-muted/60"
              }`}>{v}</span>
            ))}
          </div>
        </div>
        {/* Low / high labels */}
        {(q.low || q.high) && (
          <div className="mt-3 flex justify-between gap-4 text-sm font-medium text-muted">
            <span>{q.low}</span><span className="text-right">{q.high}</span>
          </div>
        )}
        {/* Feedback textarea */}
        {onFeedbackChange !== undefined && (
          <div className="mt-5">
            <label htmlFor={`${id}-fb`} className="mb-1.5 block text-sm font-medium text-muted">Your feedback <span className="font-normal">(optional)</span></label>
            <textarea
              id={`${id}-fb`}
              rows={3}
              maxLength={1000}
              value={feedbackValue ?? ""}
              onChange={(e) => onFeedbackChange(e.target.value)}
              placeholder="Any thoughts on this rating…"
              className="w-full resize-none rounded-2xl border-2 border-line bg-card p-3.5 text-sm outline-none transition focus:border-brand"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function answered(q: Q | undefined, a: Answers) {
  if (!q) return false;
  const v = a[q.id];
  return q.kind === "scale" ? typeof v === "number" : typeof v === "string" && v.trim() !== "";
}
const canSubmit = (qs: Q[], a: Answers) => qs.every((q) => !q.required || answered(q, a));

function FinalStep({ t, questions, onDone }: { t: L; questions: Q[]; onDone: (a: Answers) => Promise<void> }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t.finalTitle}</h1>
      <p className="mt-1.5 text-muted">{t.finalLead}</p>
      <div className="mt-7 space-y-8">
        {questions.map((q) => (
          <QuestionField key={q.id} q={q} t={t} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
        ))}
      </div>
      {err && <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm text-accent" role="alert">{err}</p>}
      <button disabled={!canSubmit(questions, answers) || busy} className={`${btnPrimary} mt-8`}
        onClick={async () => {
          setBusy(true); setErr(null);
          try { await onDone(answers); } catch { setErr(t.saveError); setBusy(false); }
        }}>
        {busy ? t.saving : <>{t.finish} <Check size={20} /></>}
      </button>
    </Card>
  );
}

function Done({ t, study }: { t: L; study: StudyInfo }) {
  const colors = ["var(--brand)", "var(--accent)", "#f2c14e", "#7aa2f7", "#e8838f"];
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full" aria-hidden>
        {Array.from({ length: 26 }, (_, i) => (
          <span key={i} className="confetti-piece" style={{
            left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 9) * 0.12}s`,
            ["--dx" as string]: `${((i % 7) - 3) * 24}px`, ["--rot" as string]: `${200 + i * 40}deg`,
          } as React.CSSProperties} />
        ))}
      </div>
      <div className="relative text-center">
        <div className="pop mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-brand to-brand-strong text-brand-ink shadow-lg"><PartyPopper size={36} /></div>
        <h1 className="font-display mt-5 text-3xl font-semibold tracking-tight">{t.thanksTitle}</h1>
        <p className="mt-2 text-muted">{t.thanksBody}</p>
      </div>
      <div className="relative mt-8 rounded-2xl bg-card2 p-5">
        <h2 className="font-display text-lg font-semibold">{t.debriefTitle}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{study.debrief || t.defaultDebrief(study.base_language, study.mix_language)}</p>
      </div>
    </Card>
  );
}
