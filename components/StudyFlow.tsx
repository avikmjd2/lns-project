"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLocale } from "@/locales";

type StudyInfo = {
  slug: string; name: string; locale: string; status: string;
  base_language: string; mix_language: string;
  intro: string | null; debrief: string | null;
  traits: { key: string; label: string }[];
};
type Clip = { id: number; url: string };
type Step = "loading" | "closed" | "welcome" | "about" | "clips" | "done";

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
            if (firstOpen < 0 && p.clips.length > 0) {
              // Everything rated but completion didn't register: finish it now.
              const cr = await fetch("/api/complete", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ participantId: saved }),
              });
              if (cr.ok) { setPid(saved); setClips(p.clips); setStep("done"); return; }
            } else if (firstOpen >= 0) {
              setPid(saved); setClips(p.clips); setIdx(firstOpen); setResumed(p.done.length > 0); setStep("clips"); return;
            }
          }
        }
        setStep("welcome");
      } catch {
        setStep("welcome");
      }
    })();
  }, [slug, key]);

  const start = useCallback(async (gender: string, age: number) => {
    setError(null);
    const r = await fetch("/api/participant", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, gender, age }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error === "no_clips" ? t.noClips : t.saveError);
      return;
    }
    const p = await r.json();
    try { localStorage.setItem(key, p.participantId); } catch {}
    setPid(p.participantId); setClips(p.clips); setIdx(0); setStep("clips");
  }, [slug, key, t]);

  if (step === "loading" || !study) {
    return <Shell><p className="text-muted text-center py-24">…</p></Shell>;
  }
  const total = clips.length || 4;
  // welcome = 0, about = 1/(total+2), clips advance, done = 1
  const progress = step === "welcome" ? 0.02 : step === "about" ? 0.08 : step === "clips" ? 0.12 + (0.86 * idx) / total : 1;

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
          t={t} traits={study.traits} pid={pid} clip={clips[idx]} index={idx} total={clips.length}
          resumed={resumed && idx > 0}
          onSaved={async () => {
            if (idx + 1 < clips.length) { setIdx(idx + 1); setResumed(false); window.scrollTo({ top: 0 }); return; }
            const r = await fetch("/api/complete", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ participantId: pid }),
            });
            if (r.ok) { setStep("done"); window.scrollTo({ top: 0 }); } else throw new Error("complete");
          }}
        />
      )}
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

function Welcome({ t, study, onStart }: { t: ReturnType<typeof getLocale>; study: StudyInfo; onStart: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <Card>
      <p className="text-sm font-medium text-brand">{study.name}</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">{t.welcomeTitle}</h1>
      <p className="mt-4 leading-relaxed">{study.intro || t.welcomeLead}</p>
      <ul className="mt-5 space-y-2">
        {t.welcomeFacts(4).map((f) => (
          <li key={f} className="flex gap-3 text-sm"><span className="mt-0.5 text-brand" aria-hidden>✓</span><span>{f}</span></li>
        ))}
      </ul>
      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-soft p-4 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--brand)]" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>{t.consent}</span>
      </label>
      <button disabled={!ok} onClick={onStart}
        className="mt-6 h-14 w-full rounded-2xl bg-brand text-lg font-semibold text-brand-ink transition active:scale-[0.99] disabled:opacity-40">
        {t.start}
      </button>
    </Card>
  );
}

function About({ t, onSubmit, error }: { t: ReturnType<typeof getLocale>; onSubmit: (g: string, a: number) => Promise<void>; error: string | null }) {
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
        className="mt-6 h-14 w-full rounded-2xl bg-brand text-lg font-semibold text-brand-ink transition active:scale-[0.99] disabled:opacity-40">
        {busy ? t.saving : t.continue}
      </button>
    </Card>
  );
}

function ClipStep(props: {
  t: ReturnType<typeof getLocale>; traits: { key: string; label: string }[];
  pid: string; clip: Clip; index: number; total: number; resumed: boolean;
  onSaved: () => Promise<void>;
}) {
  const { t, traits, pid, clip, index, total } = props;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [maxPct, setMaxPct] = useState(0);
  const [audioFailed, setAudioFailed] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const unlocked = maxPct >= 80;
  const complete = traits.every((tr) => scores[tr.key]);

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
      const r = await fetch("/api/rating", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: pid, clipId: clip.id, scores, playedPct: maxPct }),
      });
      if (!r.ok) throw new Error("rating");
      await props.onSaved();
    } catch {
      setErr(t.saveError); setBusy(false);
    }
  }

  const encouragement = t.encouragement[Math.min(index, t.encouragement.length - 1)];
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
        <h2 className="font-medium">{t.ratePrompt}</h2>
        <div className="mt-4 space-y-5">
          {traits.map((tr) => (
            <div key={tr.key}>
              <p className="mb-2 font-medium" id={`l-${tr.key}`}>{tr.label}</p>
              <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-labelledby={`l-${tr.key}`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={scores[tr.key] === n} disabled={!unlocked}
                    onClick={() => setScores((s) => ({ ...s, [tr.key]: n }))}
                    className={`h-12 rounded-xl border-2 text-lg font-semibold transition active:scale-95 ${scores[tr.key] === n ? "border-brand bg-brand text-brand-ink" : "border-line bg-card"}`}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted"><span>{t.scaleLow}</span><span>{t.scaleHigh}</span></div>
            </div>
          ))}
        </div>
      </div>

      {!unlocked && <p className="mt-4 text-sm text-muted">{t.listenLocked}</p>}
      {unlocked && !complete && <p className="mt-4 text-sm text-muted">{t.missing}</p>}
      {err && <p className="mt-4 text-sm text-accent" role="alert">{err}</p>}
      <button disabled={!unlocked || !complete || busy} onClick={save}
        className="mt-6 h-14 w-full rounded-2xl bg-brand text-lg font-semibold text-brand-ink transition active:scale-[0.99] disabled:opacity-40">
        {busy ? t.saving : last ? t.finish : t.next}
      </button>
    </Card>
  );
}
