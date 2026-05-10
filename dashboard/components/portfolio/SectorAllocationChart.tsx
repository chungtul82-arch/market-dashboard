'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Holding } from '@/types';

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#a78bfa','#34d399'];

function fmtKRW(v: number) {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return v.toLocaleString();
}

const CustomTooltip = ({ active, payload }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { pct: number } }[];
}) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
      <p className="font-bold text-foreground">{name}</p>
      <p className="text-muted-foreground">{fmtKRW(value)}원</p>
      <p className="text-[#6366f1] font-num">{p.pct.toFixed(1)}%</p>
    </div>
  );
};

function AllocationPie({ data, title, sub }: {
  data: { name: string; value: number; pct: number }[];
  title: string;
  sub?: string;
}) {
  if (!data.length) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-center h-40">
        <p className="text-muted-foreground text-sm">데이터 없음</p>
      </div>
    );
  }
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold text-muted-foreground mb-0.5">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground/60 mb-2">{sub}</p>}
      <ResponsiveContainer width="100%" height={360}>
        <PieChart>
          <Pie data={data} cx="50%" cy="38%" innerRadius={58} outerRadius={95} paddingAngle={2} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="horizontal" verticalAlign="bottom" align="center"
            formatter={v => <span className="text-xs text-muted-foreground">{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SectorAllocationChart({ holdings }: { holdings: Holding[] }) {
  const map = new Map<string, number>();
  holdings.forEach(h => {
    const key = h.sector || '기타';
    map.set(key, (map.get(key) ?? 0) + h.currentValue);
  });
  const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
  const data = Array.from(map.entries())
    .map(([name, value]) => ({ name, value: Math.round(value), pct: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  return <AllocationPie data={data} title="섹터별 비중" sub="클릭하여 섹터 변경 가능" />;
}

export function ThemeAllocationChart({ holdings }: { holdings: Holding[] }) {
  const map = new Map<string, number>();
  holdings.forEach(h => {
    if (!h.theme) return;
    map.set(h.theme, (map.get(h.theme) ?? 0) + h.currentValue);
  });
  const unthemed = holdings.filter(h => !h.theme).reduce((s, h) => s + h.currentValue, 0);
  if (unthemed > 0) map.set('미분류', unthemed);

  const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
  const data = Array.from(map.entries())
    .map(([name, value]) => ({ name, value: Math.round(value), pct: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  return <AllocationPie data={data} title="테마별 비중" sub="클릭하여 테마 변경 가능" />;
}
