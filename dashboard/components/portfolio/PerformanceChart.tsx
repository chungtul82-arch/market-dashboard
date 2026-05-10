'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

interface BenchmarkPoint { date: string; v: number }

interface Props {
  kospi:        BenchmarkPoint[] | null;
  nasdaq100:    BenchmarkPoint[] | null;
  totalReturnPct: number;
}

type Period = '1M' | '3M' | '6M' | '1Y';

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: '1M', label: '1개월',  days: 30  },
  { key: '3M', label: '3개월',  days: 90  },
  { key: '6M', label: '6개월',  days: 180 },
  { key: '1Y', label: '1년',    days: 365 },
];

function rebase(data: BenchmarkPoint[], cutoff: Date) {
  const filtered = data.filter(d => new Date(d.date) >= cutoff);
  if (!filtered.length) return [];
  const base = filtered[0].v;
  return filtered.map(d => ({ date: d.date, ret: Math.round((d.v / base - 1) * 10000) / 100 }));
}

function periodReturn(data: BenchmarkPoint[], cutoff: Date): number | null {
  const pts = data.filter(d => new Date(d.date) >= cutoff);
  if (pts.length < 2) return null;
  return Math.round((pts[pts.length - 1].v / pts[0].v - 1) * 10000) / 100;
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; label?: string;
  payload?: { name: string; value: number; color: string }[];
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs space-y-1">
      <p className="text-muted-foreground">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value >= 0 ? '+' : ''}{p.value.toFixed(2)}%
        </p>
      ))}
    </div>
  );
};

function StatCard({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="bg-muted/40 rounded-lg px-4 py-2 text-center">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      {value === null ? (
        <p className="text-sm text-muted-foreground/50">—</p>
      ) : (
        <p className={cn('text-base font-bold font-num', value >= 0 ? 'text-up' : 'text-down')} style={{ color: value >= 0 ? color : undefined }}>
          {value >= 0 ? '+' : ''}{value.toFixed(2)}%
        </p>
      )}
    </div>
  );
}

export function PerformanceChart({ kospi, nasdaq100, totalReturnPct }: Props) {
  const [period, setPeriod] = useState<Period>('3M');

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - PERIODS.find(p => p.key === period)!.days);
    return d;
  }, [period]);

  const kospiData   = useMemo(() => kospi    ? rebase(kospi, cutoff)    : [], [kospi, cutoff]);
  const nasdaqData  = useMemo(() => nasdaq100 ? rebase(nasdaq100, cutoff) : [], [nasdaq100, cutoff]);

  // Merge datasets by date
  const merged = useMemo(() => {
    const map = new Map<string, { date: string; kospi?: number; nasdaq100?: number }>();
    kospiData.forEach(d => map.set(d.date, { date: d.date, kospi: d.ret }));
    nasdaqData.forEach(d => {
      const ex = map.get(d.date) ?? { date: d.date };
      map.set(d.date, { ...ex, nasdaq100: d.ret });
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [kospiData, nasdaqData]);

  const kospiRet   = kospi    ? periodReturn(kospi, cutoff)    : null;
  const nasdaqRet  = nasdaq100 ? periodReturn(nasdaq100, cutoff) : null;

  const xTicks = useMemo(() => {
    if (!merged.length) return [];
    const step = Math.max(1, Math.floor(merged.length / 6));
    return merged.filter((_, i) => i % step === 0 || i === merged.length - 1).map(d => d.date);
  }, [merged]);

  const hasData = merged.length > 0;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">벤치마크 비교</h2>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'text-xs px-3 py-1 rounded-full transition-colors',
                period === p.key
                  ? 'bg-[#6366f1] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="내 포트폴리오 *" value={totalReturnPct} color="#f97316" />
        <StatCard label={`KOSPI (${period})`}     value={kospiRet}  color="#6366f1" />
        <StatCard label={`NASDAQ100 (${period})`} value={nasdaqRet} color="#22c55e" />
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              ticks={xTicks}
              tickFormatter={d => d.slice(5)}
              tick={{ fontSize: 10, fill: '#888' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
              tick={{ fontSize: 10, fill: '#888' }}
              axisLine={false} tickLine={false} width={48}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={v => <span className="text-xs text-muted-foreground">{v}</span>}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
            <ReferenceLine
              y={totalReturnPct}
              stroke="#f97316"
              strokeDasharray="5 3"
              label={{
                value: `포트폴리오 ${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(1)}%`,
                fill: '#f97316', fontSize: 10, position: 'insideTopRight',
              }}
            />
            <Line dataKey="kospi"    name="KOSPI"     dot={false} stroke="#6366f1" strokeWidth={1.5} connectNulls />
            <Line dataKey="nasdaq100" name="NASDAQ100" dot={false} stroke="#22c55e" strokeWidth={1.5} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-muted-foreground/50 text-sm">
          벤치마크 데이터 로딩 중...
        </div>
      )}

      <p className="text-xs text-muted-foreground/40">
        * 포트폴리오 수익률은 매입평단가 기준 총 수익률 / 지수는 해당 기간 수익률
      </p>
    </div>
  );
}
