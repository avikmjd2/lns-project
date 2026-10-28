"use client";

// Production hides server error details; show the digest so it can be matched to the Vercel log line.
export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-lg border-t-2 border-signal pt-5">
      <p className="label !text-signal">Error</p>
      <h1 className="mt-2 text-[1.9rem] font-medium leading-tight">This page hit an error</h1>
      <p className="mt-3 text-muted">
        Most often the database isn’t set up yet or a connection setting is missing. Open Overview and run “Set up database”, then reload.
      </p>
      {error.digest && <p className="numeral mt-4 border border-rule bg-sunk px-3 py-2 text-[13px]">Error digest: {error.digest}</p>}
      <button onClick={reset} className="btn mt-6">Try again</button>
    </div>
  );
}
