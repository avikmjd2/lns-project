"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { speaker: string; male: number | null; female: number | null; nMale: number; nFemale: number };

// Two series: listener gender. Teal + orange are well separated in lightness and hue.
const COLORS = { male: "#0f766e", female: "#e8743b" };

export default function ResultsChart({ title, data, min, max }: { title: string; data: Row[]; min: number; max: number }) {
  return (
    <figure className="rounded-2xl border border-line bg-card p-4">
      <figcaption className="mb-2 font-semibold">{title}</figcaption>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
            <XAxis dataKey="speaker" tickLine={false} axisLine={false} stroke="currentColor" fontSize={12} />
            <YAxis domain={[min, max]} allowDecimals={false} tickLine={false} axisLine={false} stroke="currentColor" fontSize={12} />
            <Tooltip
              cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
              contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--card)", color: "var(--foreground)" }}
              formatter={(v, name, p) => {
                const n = name === "Male listeners" ? p.payload.nMale : p.payload.nFemale;
                return [`${typeof v === "number" ? v.toFixed(2) : "–"} (n=${n})`, name];
              }}
            />
            <Legend iconType="circle" />
            <Bar dataKey="male" name="Male listeners" fill={COLORS.male} radius={[4, 4, 0, 0]} maxBarSize={44} />
            <Bar dataKey="female" name="Female listeners" fill={COLORS.female} radius={[4, 4, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
