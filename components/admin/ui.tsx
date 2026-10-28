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

/** A row of big numerals separated by hairlines, like a ledger summary. */
export function Stats({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 border-y border-ink md:grid-cols-4">
      {items.map((s, i) => (
        <div key={s.label} className={`px-4 py-5 ${i > 0 ? "md:border-l border-rule" : "md:pl-0"} ${i % 2 === 1 ? "border-l border-rule md:border-l" : ""} ${i > 1 ? "border-t border-rule md:border-t-0" : ""}`}>
          <dd className="numeral text-[2.6rem] leading-none tracking-[-0.03em]">{s.value}</dd>
          <dt className="label mt-2">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function Badge({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "signal" | "muted" | "brand" | "accent" }) {
  // "brand"/"accent" are accepted as aliases so existing call sites keep working.
  const t = tone === "brand" ? "ink" : tone === "accent" ? "signal" : tone;
  const cls = t === "ink" ? "bg-ink text-paper border-ink" : t === "signal" ? "text-signal border-signal" : "text-muted border-rule";
  return <span className={`label inline-flex items-center border px-1.5 py-[2px] ${cls} ${t === "ink" ? "!text-paper" : t === "signal" ? "!text-signal" : ""}`}>{children}</span>;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto border-y border-ink">{children}</div>;
}

export const th = "label border-b border-ink px-3 py-2.5 text-left font-normal first:pl-0";
export const td = "border-b border-rule px-3 py-3 align-middle first:pl-0";
