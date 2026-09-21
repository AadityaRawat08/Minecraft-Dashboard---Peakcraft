"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ResourceChart({
  data, dataKey, color, unit,
}: {
  data: Array<Record<string, number | string>>;
  dataKey: string;
  color: string;
  unit: string;
}) {
  if (!data.length) {
    return <div className="flex h-40 items-center justify-center text-sm text-slate-500">Collecting metrics…</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v: string | number) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} minTickGap={40} />
        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} width={40} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
          labelFormatter={((v: unknown) => new Date(v as string).toLocaleTimeString()) as never}
          formatter={((value: unknown) => [`${value}${unit}`, dataKey]) as never}
        />
        <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#grad-${dataKey})`} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
