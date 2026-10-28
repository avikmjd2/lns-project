"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Pause, Play, RotateCcw } from "lucide-react";
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
    return <Shell><p className="label rise pt-24 text-center">Loading…</p></Shell>;
  }
  const total = clips.length || 4;
  const progress =
    step === "welcome" ? 0.02 : step === "about" ? 0.07 :
    step === "clips" ? 0.1 + 0.85 * ((idx + clipFrac) / total) :
    step === "final" ? 0.97 : 1;
  const label = step === "final" ? t.finalTitle : step === "clips" || step === "done" ? "" : study.name;

  return (
    <Shell progress={step === "closed" ? undefined : progress} label={label}>
      {step === "closed" && (
        <section className="rise">
          <p className="label">Voices &amp; speaking styles</p>
          <h1 className="mt-3 text-[2.4rem] font-medium leading-[1.05] tracking-[-0.02em]">{t.closedTitle}</h1>
          <p className="mt-4 text-[1.15rem] text-muted">{t.closedBody}</p>
        </section>
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
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-[660px] items-baseline justify-between gap-6 px-5 pt-6">
        <span className="label !text-ink flex items-center gap-2"><i className="inline-block h-2 w-2 bg-signal" aria-hidden />Voices</span>
        {label && <span className="label truncate">{label}</span>}
      </header>
      {progress !== undefined && (
        <div className="mx-auto mt-4 w-full max-w-[660px] px-5">
          <div className="h-[2px] w-full bg-rule" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-ink transition-all duration-700 ease-out" style={{ width: `${Math.max(1, progress * 100)}%` }} />
          </div>
        </div>
      )}
      <main className="mx-auto flex w-full max-w-[660px] flex-1 flex-col px-5 pb-24 pt-10 sm:pt-14">{children}</main>
    </div>
  );
}

function Welcome({ t, study, onStart }: { t: L; study: StudyInfo; onStart: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <section className="rise">
      <p className="label">{study.name}</p>
      <h1 className="mt-4 text-[2.7rem] font-medium leading-[1.02] tracking-[-0.025em] sm:text-[3.6rem]">{t.welcomeTitle}</h1>
      <p className="mt-6 text-[1.2rem] leading-[1.55] text-ink/80">{study.intro || t.welcomeLead}</p>
      <ol className="mt-9 border-b border-rule">
        {t.welcomeFacts.map((f, i) => (
          <li key={f} className="grid grid-cols-[2.8rem_1fr] items-baseline border-t border-rule py-3.5">
            <span className="numeral text-[13px] text-signal">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-[1.05rem]">{f}</span>
          </li>
        ))}
      </ol>
      <label className="mt-8 flex cursor-pointer items-start gap-4">
        <span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center border-[1.5px] border-ink ${ok ? "bg-ink text-paper" : ""}`}>
          {ok && <Check size={14} strokeWidth={3} />}
        </span>
        <input type="checkbox" className="sr-only" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span className="text-[1.02rem] leading-snug">{t.consent}</span>
      </label>
      <button disabled={!ok} onClick={onStart} className="btn mt-8 w-full sm:w-auto sm:min-w-[14rem]">{t.start} <ArrowRight size={16} /></button>
    </section>
  );
}

const LANGUAGES = [
  // English first, then all 22 scheduled Indian languages alphabetically
  "English",
  "Assamese", "Bengali", "Bodo", "Dogri", "Gujarati", "Hindi", "Kannada",
  "Kashmiri", "Konkani", "Maithili", "Malayalam", "Manipuri", "Marathi",
  "Nepali", "Odia", "Punjabi", "Sanskrit", "Santali", "Sindhi",
  "Tamil", "Telugu", "Urdu",
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
    <section className="rise">
      <h1 className="text-[2.4rem] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[3rem]">{t.aboutYou}</h1>
      <p className="mt-3 text-[1.15rem] text-muted">{t.aboutYouLead}</p>

      <fieldset className="mt-10">
        <legend className="label mb-3">01 &nbsp;{t.genderQ}</legend>
        <div className="grid grid-cols-2 gap-2">
          {t.genders.map((g) => (
            <button key={g.v} type="button" onClick={() => setGender(g.v)} aria-pressed={gender === g.v} className="choice">{g.t}</button>
          ))}
        </div>
      </fieldset>

      <div className="mt-9">
        <label htmlFor="age" className="label mb-1 block">02 &nbsp;{t.ageQ}</label>
        <input id="age" inputMode="numeric" pattern="[0-9]*" value={age} placeholder={t.agePlaceholder}
          onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))} onBlur={() => setTouched(true)}
          className="w-full border-0 border-b border-ink bg-transparent py-2 text-[2rem] outline-none placeholder:text-rule focus:border-signal" />
        {touched && !ageOk && <p className="mt-2 text-[0.95rem] text-signal">{t.ageError}</p>}
      </div>

      <div className="mt-9">
        <p className="label mb-3">03 &nbsp;What is your first language?</p>
        <div className="max-h-52 overflow-y-auto border border-ink/35">
          <div className="grid grid-cols-2 gap-px bg-rule">
            {[...LANGUAGES, "Other"].map((l) => (
              <button key={l} type="button" onClick={() => { setLang(l); if (l !== "Other") setOtherLang(""); }}
                className={`px-3 py-2.5 text-left text-[1rem] transition-colors ${lang === l ? "bg-ink text-paper" : "bg-paper hover:bg-sunk"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {lang === "Other" && (
          <input id="lang-other" type="text" value={otherLang} onChange={(e) => setOtherLang(e.target.value.slice(0, 60))}
            placeholder="Please specify your language…" className="field mt-3" autoFocus />
        )}
      </div>

      {error && <p className="mt-6 border-l-2 border-signal pl-3 text-[1rem] text-signal" role="alert">{error}</p>}
      <button disabled={!gender || !ageOk || !langOk || busy}
        onClick={async () => { setBusy(true); await onSubmit(gender, ageN, effectiveLang); setBusy(false); }}
        className="btn mt-10 w-full sm:w-auto sm:min-w-[14rem]">
        {busy ? t.saving : <>{t.continue} <ArrowRight size={16} /></>}
      </button>
    </section>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Thin printed waveform: played bars are inked in, the rest stay faint. Seeded per clip so each differs. */
function Waveform({ seed, progress, compact }: { seed: number; progress: number; compact?: boolean }) {
  const n = compact ? 44 : 72;
  return (
    <div className={`flex items-center gap-[2px] ${compact ? "h-8" : "h-20"}`} aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const h = 0.18 + 0.82 * Math.abs(Math.sin(i * 1.7 + seed) * Math.cos(i * 0.55 + seed * 2.3));
        return <span key={i} className={`flex-1 ${(i + 1) / n <= progress / 100 ? "bg-ink" : "bg-rule"}`} style={{ height: `${h * 100}%` }} />;
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
  const [scrubPos, setScrubPos] = useState(0);   // controlled while dragging
  const [isDragging, setIsDragging] = useState(false);
  const [maxPct, setMaxPct] = useState(0);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const [audioFailed, setAudioFailed] = useState(false);
  const [phase, setPhase] = useState<"listen" | "ask">("listen");
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const unlocked = maxPct >= 80 || audioFailed;
  const nq = questions.length;
  const { onProgress } = props;
  const curAnswered = answered(questions[qi], answers);
  useEffect(() => {
    onProgress(phase === "listen" ? 0 : nq ? 0.1 + 0.9 * Math.min(1, (qi + (curAnswered ? 1 : 0)) / nq) : 1);
  }, [phase, qi, curAnswered, nq, onProgress]);

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

  function goNext() { if (qi + 1 < nq) setQi(qi + 1); else save(); }

  const last = index + 1 === total;
  const q = questions[qi];
  const isLastQ = qi + 1 === nq;
  const ready = !q || !q.required || answered(q, answers);

  /** Seek bar shared by both phases (draggable, committed on release). */
  const scrubber = (
    <input
      type="range" min={0} max={100} step={0.1}
      value={isDragging ? scrubPos : pos}
      disabled={!dur}
      aria-label="Audio seek"
      className="slider-input slider-thin"
      style={{ "--pct": `${isDragging ? scrubPos : pos}%` } as React.CSSProperties}
      onMouseDown={() => { setIsDragging(true); setScrubPos(pos); }}
      onTouchStart={() => { setIsDragging(true); setScrubPos(pos); }}
      onChange={(e) => setScrubPos(Number(e.target.value))}
      onMouseUp={(e) => {
        const v = Number((e.target as HTMLInputElement).value);
        if (audioRef.current && dur) audioRef.current.currentTime = (v / 100) * dur;
        setPos(v); setIsDragging(false);
      }}
      onTouchEnd={(e) => {
        const v = Number((e.currentTarget as HTMLInputElement).value);
        if (audioRef.current && dur) audioRef.current.currentTime = (v / 100) * dur;
        setPos(v); setIsDragging(false);
      }}
    />
  );

  return (
    <div>
      <audio ref={audioRef} src={clip.url} preload="auto"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onEnded={() => { setPlaying(false); setMaxPct(100); }}
        onError={() => setAudioFailed(true)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget; setCur(a.currentTime); if (!a.duration) return;
          const pct = (a.currentTime / a.duration) * 100;
          if (!isDragging) { setPos(pct); setScrubPos(pct); }
          setMaxPct((m) => Math.max(m, Math.round(pct)));
        }} />

      {props.resumed && phase === "listen" && <p className="mb-6 border-l-2 border-signal pl-3 text-[1rem]">{t.resumeNote}</p>}

      {phase === "listen" ? (
        <section className="rise">
          <div className="flex items-baseline justify-between">
            <span className="label !text-ink">{t.clipOf(index + 1, total)}</span>
            <span className="label numeral">{mmss(isDragging ? (scrubPos / 100) * dur : cur)} / {dur ? mmss(dur) : "–:––"}</span>
          </div>
          <h1 className="mt-4 text-[2.4rem] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[3rem]">{t.listenTitle}</h1>

          <div className="mt-9 border-y border-ink py-6">
            <Waveform seed={clip.id * 1.3} progress={pos} />
            <div className="mt-3">{scrubber}</div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button onClick={toggle} aria-label={playing ? t.pause : t.play} className="btn btn-outline min-w-[10rem]">
              {playing ? <Pause size={16} fill="currentColor" /> : maxPct >= 99 ? <RotateCcw size={16} /> : <Play size={16} fill="currentColor" />}
              {playing ? t.pause : maxPct >= 99 ? t.replay : t.play}
            </button>
            <p className={`min-w-0 flex-1 text-[1.02rem] italic leading-snug ${audioFailed ? "text-signal not-italic" : "text-muted"}`}>
              {audioFailed ? t.audioError : unlocked ? t.listenDone : t.listenPrompt}
            </p>
          </div>

          {err && <p className="mt-5 border-l-2 border-signal pl-3 text-signal" role="alert">{err}</p>}
          <button disabled={busy} onClick={() => (nq ? setPhase("ask") : save())} className="btn mt-10 w-full sm:w-auto sm:min-w-[16rem]">
            {busy ? t.saving : nq ? <>{t.toQuestions} <ArrowRight size={16} /></> : last ? t.finish : t.next}
          </button>
        </section>
      ) : (
        <section>
          {/* compact player, kept above the questions so the clip can be replayed or scrubbed */}
          <div className="border-y border-ink py-3">
            <div className="flex items-center gap-4">
              <button onClick={toggle} aria-label={playing ? t.pause : t.replay} className="btn btn-outline !min-h-10 !px-3">
                {playing ? <Pause size={14} fill="currentColor" /> : <RotateCcw size={14} />}
              </button>
              <div className="min-w-0 flex-1"><Waveform compact seed={clip.id * 1.3} progress={pos} /></div>
              <span className="label numeral shrink-0">{mmss(cur)}{dur ? ` / ${mmss(dur)}` : ""}</span>
            </div>
            <div className="mt-1">{scrubber}</div>
            <div className="flex items-center justify-between">
              <button onClick={() => { if (audioRef.current) audioRef.current.pause(); setPhase("listen"); }} className="btn-quiet !py-1">
                <ArrowLeft size={13} /> Back to audio
              </button>
              <span className="label">{t.clipOf(index + 1, total)}</span>
            </div>
          </div>

          <div className="mt-10">
            <div className="flex items-center justify-between">
              <span className="label !text-ink">{t.questionOf(qi + 1, nq)}</span>
              <div className="flex gap-1" aria-hidden>
                {questions.map((_, i) => <span key={i} className={`h-[3px] w-4 ${i === qi ? "bg-signal" : i < qi ? "bg-ink" : "bg-rule"}`} />)}
              </div>
            </div>
            <div key={q.id} className="slide-in mt-5">
              <QuestionField q={q} t={t} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} big />
            </div>
            {err && <p className="mt-5 border-l-2 border-signal pl-3 text-signal" role="alert">{err}</p>}
            <div className="mt-10 flex items-center gap-4 border-t border-rule pt-5">
              {qi > 0 && <button className="btn-quiet" onClick={() => setQi(qi - 1)}><ArrowLeft size={13} /> {t.back}</button>}
              <div className="flex-1" />
              {!q.required && !answered(q, answers) && !isLastQ && <button className="btn-quiet" onClick={goNext}>{t.skip}</button>}
              <button disabled={!ready || busy} onClick={goNext} className="btn">
                {busy ? t.saving : isLastQ ? (last ? t.finish : t.next) : t.nextQuestion} {!busy && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/** One question: a ruler-style slider (scale) or ruled notebook lines (free text). */
function QuestionField({ q, value, onChange, t, big }: {
  q: Q; value: number | string | undefined; onChange: (v: number | string) => void; t: L; big?: boolean;
}) {
  const id = `q-${q.id}`;
  const title = (
    <h2 className={`font-medium leading-[1.12] tracking-[-0.015em] ${big ? "text-[2rem] sm:text-[2.35rem]" : "text-[1.5rem]"}`} id={`${id}-l`}>
      {q.prompt}{!q.required && <span className="label ml-3 align-middle">{t.optional}</span>}
    </h2>
  );
  if (q.kind === "text") {
    return (
      <div>
        {title}
        <textarea id={id} rows={5} maxLength={2000} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}
          aria-labelledby={`${id}-l`} placeholder={t.textPlaceholder} className="ruled mt-6" />
        <p className="label numeral mt-2 text-right">{((value as string) ?? "").length} / 2000</p>
      </div>
    );
  }
  const isSet = typeof value === "number";
  // Until touched, the marker rests at the middle but is shown hollow and no value is displayed.
  const sliderVal = isSet ? value : Math.round((q.min + q.max) / 2);
  const pct = ((sliderVal - q.min) / (q.max - q.min)) * 100;
  return (
    <div>
      {title}
      <div className="mt-8">
        <div className="flex items-end justify-between">
          <span className={`numeral text-[5.5rem] leading-[0.85] tracking-[-0.04em] ${isSet ? "text-signal" : "text-rule"}`} aria-live="polite">{isSet ? sliderVal : "–"}</span>
          <span className="label pb-1">{isSet ? `out of ${q.max}` : "Tap or drag the ruler"}</span>
        </div>
        <div className="mt-5">
          <input
            id={id} type="range" min={q.min} max={q.max} step={1} value={sliderVal}
            aria-labelledby={`${id}-l`}
            onChange={(e) => onChange(Number(e.target.value))}
            // Tapping exactly where the marker rests fires no change event, so record the value on release too.
            onPointerUp={(e) => { if (!isSet) onChange(Number(e.currentTarget.value)); }}
            onKeyUp={(e) => { if (!isSet) onChange(Number(e.currentTarget.value)); }}
            className={`slider-input ${isSet ? "" : "slider-unset"}`}
            style={{ "--pct": `${pct}%` } as React.CSSProperties}
          />
          <div className="pointer-events-none flex justify-between px-[11px]" aria-hidden>
            {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((v) => (
              <span key={v} className="flex w-0 flex-col items-center">
                <i className={`block w-px ${isSet && v === sliderVal ? "h-3 bg-signal" : "h-2 bg-ink/50"}`} />
                <span className={`numeral mt-1 text-[11px] ${isSet && v === sliderVal ? "text-signal" : "text-muted"}`}>{v}</span>
              </span>
            ))}
          </div>
        </div>
        {(q.low || q.high) && (
          <div className="mt-4 flex justify-between gap-6 text-[1.02rem] italic text-muted">
            <span>{q.low}</span><span className="text-right">{q.high}</span>
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
    <section className="rise">
      <h1 className="text-[2.4rem] font-medium leading-[1.05] tracking-[-0.02em] sm:text-[3rem]">{t.finalTitle}</h1>
      <p className="mt-3 text-[1.15rem] text-muted">{t.finalLead}</p>
      <div className="mt-8">
        {questions.map((q) => (
          <div key={q.id} className="border-t border-rule py-8">
            <QuestionField q={q} t={t} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
          </div>
        ))}
      </div>
      {err && <p className="border-l-2 border-signal pl-3 text-signal" role="alert">{err}</p>}
      <button disabled={!canSubmit(questions, answers) || busy} className="btn mt-4 w-full sm:w-auto sm:min-w-[14rem]"
        onClick={async () => {
          setBusy(true); setErr(null);
          try { await onDone(answers); } catch { setErr(t.saveError); setBusy(false); }
        }}>
        {busy ? t.saving : <>{t.finish} <Check size={16} /></>}
      </button>
    </section>
  );
}

function Done({ t, study }: { t: L; study: StudyInfo }) {
  return (
    <section className="rise">
      <span className="stamp label !text-signal inline-block border-2 border-signal px-3 py-1.5 tracking-[0.18em]">Received</span>
      <h1 className="mt-7 text-[2.6rem] font-medium leading-[1.04] tracking-[-0.025em] sm:text-[3.4rem]">{t.thanksTitle}</h1>
      <p className="mt-4 text-[1.2rem] text-muted">{t.thanksBody}</p>
      <div className="mt-12 border-t border-ink pt-5">
        <p className="label !text-ink">{t.debriefTitle}</p>
        <p className="mt-3 text-[1.08rem] leading-[1.6] text-ink/85">{study.debrief || t.defaultDebrief(study.base_language, study.mix_language)}</p>
      </div>
    </section>
  );
}
