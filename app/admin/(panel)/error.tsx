"use client";

import { AlertTriangle } from "lucide-react";

// Production hides server error details; show the digest so it can be matched to the Vercel log line.
export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="surface mx-auto mt-10 max-w-lg rounded-2xl p-6">
      <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent"><AlertTriangle size={20} /></span>
      <h1 className="font-display text-xl font-semibold">This page hit an error</h1>
      <p className="mt-2 text-sm text-muted">
        Most often the database isn’t set up yet or a connection setting is missing. Open Overview and run “Set up database”, then reload.
      </p>
      {error.digest && <p className="mt-3 rounded-lg bg-card2 px-3 py-2 font-mono text-xs">Error digest: {error.digest}</p>}
      <button onClick={reset} className="mt-5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink">Try again</button>
    </div>
  );
}
