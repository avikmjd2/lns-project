"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { speaker: string; male: number | null; female: number | null; nMale: number; nFemale: number };

// Two series by listener gender: ink and signal red. Flat bars, hairline grid, no rounding.
const COLORS = { male: "var(--ink)", female: "var(--signal)" };
const mono = "var(--font-plex-mono), ui-monospace, monospace";

export default function ResultsChart({ title, data, min, max }: { title: string; data: Row[]; min: number; max: number }) {
  return (
    <figure className="border-t border-ink pt-3">
      <figcaption className="label !text-ink mb-3">{title}</figcaption>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={3}>
            <CartesianGrid vertical={false} stroke="var(--rule)" />
            <XAxis dataKey="speaker" tickLine={false} axisLine={{ stroke: "var(--ink)" }} stroke="var(--muted)" fontSize={12} fontFamily={mono} />
            <YAxis domain={[min, max]} allowDecimals={false} tickLine={false} axisLine={false} stroke="var(--muted)" fontSize={12} fontFamily={mono} />
            <Tooltip
              cursor={{ fill: "var(--sunk)", fillOpacity: 0.6 }}
              contentStyle={{ borderRadius: 2, border: "1px solid var(--ink)", background: "var(--panel)", color: "var(--ink)", fontFamily: mono, fontSize: 12 }}
              formatter={(v, name, p) => {
                const n = name === "Male listeners" ? p.payload.nMale : p.payload.nFemale;
                return [`${typeof v === "number" ? v.toFixed(2) : "–"} (n=${n})`, name];
              }}
            />
            <Legend iconType="square" iconSize={9} formatter={(v) => <span style={{ color: "var(--ink)", fontFamily: mono, fontSize: 12 }}>{v}</span>} />
            <Bar dataKey="male" name="Male listeners" fill={COLORS.male} maxBarSize={46} />
            <Bar dataKey="female" name="Female listeners" fill={COLORS.female} maxBarSize={46} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
