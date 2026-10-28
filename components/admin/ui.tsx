import type { ReactNode } from "react";

// Server-safe presentational pieces for the admin pages ("field notebook" system: rules, not boxes).

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-ink pb-6">
      <div className="min-w-0">
        <h1 className="text-[2.5rem] font-medium leading-[1.02] tracking-[-0.025em]">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-[1.05rem] leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, description, children, className = "", right }: {
  title?: string; description?: ReactNode; children: ReactNode; className?: string; right?: ReactNode;
}) {
  return (
    <section className={`mt-12 border-t-2 border-ink pt-5 first:mt-0 ${className}`}>
      {(title || right) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-[1.45rem] font-medium leading-tight tracking-[-0.01em]">{title}</h2>}
            {description && <p className="mt-1 max-w-2xl text-[1rem] leading-relaxed text-muted">{description}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/** Big numerals on a hairline grid, like a ledger summary. 2 columns on phones, one row on wide screens. */
const COLS: Record<number, string> = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" };
export function Stats({ items }: { items: { label: string; value: ReactNode; hint?: string }[] }) {
  return (
    <dl className={`grid grid-cols-2 gap-px border-y border-ink bg-rule ${COLS[items.length] ?? "lg:grid-cols-4"}`}>
      {items.map((s, i) => (
        // <dt> (label) comes first in the markup, as lists require; flex order shows the number above it.
        <div key={s.label} className={`flex flex-col bg-paper py-5 pr-4 ${i % 2 === 0 ? "pl-0 lg:pl-4" : "pl-4"} ${i === 0 ? "lg:pl-0" : ""}`}>
          <dt className="label order-2 mt-2">{s.label}</dt>
          <dd className="numeral order-1 text-[2.4rem] leading-none tracking-[-0.03em]">{s.value}</dd>
          {s.hint && <dd className="order-3 mt-1 text-[0.85rem] leading-snug text-muted">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** One horizontal bar: label, a filled track and the count with its share. */
export function BarRow({ label, value, max, total, tone = "ink", sub }: { label: string; value: number; max: number; total?: number; tone?: "ink" | "signal"; sub?: string }) {
  const w = max > 0 ? Math.max(value > 0 ? 1.5 : 0, (value / max) * 100) : 0;
  const pct = total ? Math.round((value / total) * 100) : null;
  return (
    <div className="grid grid-cols-[minmax(6.5rem,11rem)_1fr_auto] items-center gap-x-3 py-1.5 text-[0.98rem]">
      <span className="truncate" title={label}>{label}{sub && <span className="label ml-2">{sub}</span>}</span>
      <span className="h-[10px] bg-rule" aria-hidden><span className={`block h-full ${tone === "signal" ? "bg-signal" : "bg-ink"}`} style={{ width: `${w}%` }} /></span>
      <span className="numeral min-w-[4.5rem] text-right text-[13px]">{value}{pct !== null && <span className="text-muted"> · {pct}%</span>}</span>
    </div>
  );
}

/** Tiny vertical histogram for a scale question: one column per answer value. */
export function Histogram({ values, start }: { values: number[]; start: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-16 items-end gap-[3px]" role="img" aria-label={`Answer counts from ${start} to ${start + values.length - 1}: ${values.join(", ")}`}>
      {values.map((v, i) => (
        <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`${start + i}: ${v}`}>
          <div className="bg-ink" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 2 : 0 }} />
          <span className="numeral mt-1 text-center text-[11px] leading-none text-muted" aria-hidden>{start + i}</span>
        </div>
      ))}
    </div>
  );
}

export function Badge({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "signal" | "muted" | "brand" | "accent" }) {
  // "brand"/"accent" are accepted as aliases so existing call sites keep working.
  const t = tone === "brand" ? "ink" : tone === "accent" ? "signal" : tone;
  const cls = t === "ink" ? "bg-ink text-paper border-ink" : t === "signal" ? "text-signal border-signal" : "text-muted border-rule";
  return <span className={`label inline-flex items-center border px-1.5 py-[2px] ${cls} ${t === "ink" ? "!text-paper" : t === "signal" ? "!text-signal" : ""}`}>{children}</span>;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto border-y border-ink" role="region" aria-label="Table, scrolls sideways on small screens" tabIndex={0}>{children}</div>;
}

export const th = "label border-b border-ink px-3 py-2.5 text-left font-normal first:pl-0";
export const td = "border-b border-rule px-3 py-3 align-middle first:pl-0";
