'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Holding } from '@/types';

interface Props { holdings: Holding[] }

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#a78bfa'];

function fmtKRW(v: number) {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return v.toLocaleString();
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { pct: number } }[] }) => {
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

export function SectorAllocationChart({ holdings }: Props) {
  // 섹터별 합산
  const sectorMap = new Map<string, number>();
  holdings.forEach(h => {
    const sector = h.sector || '기타';
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.currentValue);
  });

  const total = Array.from(sectorMap.values()).reduce((s, v) => s + v, 0);
  const data  = Array.from(sectorMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value), pct: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-center h-40">
        <p className="text-muted-foreground text-sm">섹터 정보가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold text-muted-foreground mb-4">산업섹터별 비중</h2>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={data} cx="50%" cy="45%" innerRadius={65} outerRadius={105} paddingAngle={2} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={v => <span className="text-xs text-muted-foreground">{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
