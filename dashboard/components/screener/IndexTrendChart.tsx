'use client';

import { useEffect, useState, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

interface IndexData {
  name: string; ticker: string;
  ret_5d: number; ret_20d: number; ret_60d: number; ret_120d: number; ret_250d: number;
  rel_5d: number; rel_20d: number;
  signal: string;
  etf_name: string; etf_ticker: string;
  prices_5d: number[]; prices_20d: number[]; prices_60d: number[]; prices_120d: number[];
}

type Period = '5일' | '20일' | '60일' | '120일';

const PERIOD_KEY: Record<Period, keyof IndexData> = {
  '5일':   'prices_5d',
  '20일':  'prices_20d',
  '60일':  'prices_60d',
  '120일': 'prices_120d',
};
const RET_KEY: Record<Period, keyof IndexData> = {
  '5일': 'ret_5d', '20일': 'ret_20d', '60일': 'ret_60d', '120일': 'ret_120d',
};

const INDEX_STYLE: Record<string, { color: string; dash?: string; width?: number }> = {
  '코스피':            { color: '#378ADD', width: 1 },
  '코스피200 IT':      { color: '#1D9E75', width: 2 },
  'KRX 반도체':        { color: '#7F77DD', width: 2 },
  '코리아밸류업':      { color: '#BA7517', dash: '5 3', width: 2 },
  'KRX 증권':          { color: '#D85A30', dash: '5 3', width: 2 },
  '코스닥150':         { color: '#888780', dash: '5 3', width: 2 },
  '코스피200':         { color: '#5B9BD5', width: 2 },
  'KRX 헬스케어':      { color: '#E05CA0', width: 2 },
  '코스피200 중공업':  { color: '#FF8C42', width: 2 },
  '코스피200 금융':    { color: '#4EC9B0', width: 2 },
  '코스닥':            { color: '#A8A8A8', dash: '3 3', width: 1 },
  'KRX300':            { color: '#B5CEA8', width: 1 },
};
const FALLBACK_COLORS = ['#F0C040', '#C078D0', '#78C0C0', '#D07878', '#78A8D0'];

function getStyle(name: string, idx: number) {
  return INDEX_STYLE[name] ?? { color: FALLBACK_COLORS[idx % FALLBACK_COLORS.length], width: 2 };
}

const DEFAULT_SELECTED = new Set(['코스피', '코스피200 IT', 'KRX 반도체', '코리아밸류업', 'KRX 증권', '코스닥150']);

function pct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

const CustomTooltip = ({ active, payload }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs space-y-1 min-w-[160px]">
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className={cn('font-num font-bold', p.value >= 0 ? 'text-up' : 'text-down')}>{pct(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function IndexTrendChart() {
  const [indices,  setIndices]  = useState<IndexData[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [period,   setPeriod]   = useState<Period>('20일');
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED));

  useEffect(() => {
    getDoc(doc(db, 'index-trends', 'latest'))
      .then(snap => {
        if (snap.exists()) setIndices(snap.data().indices ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 차트 데이터: 선택된 인덱스 prices 배열을 day-index 기준으로 병합
  const chartData = useMemo(() => {
    const pKey = PERIOD_KEY[period];
    const displayed = indices.filter(idx => selected.has(idx.name));
    const maxLen = Math.max(...displayed.map(idx => (idx[pKey] as number[])?.length ?? 0), 0);
    if (!maxLen) return [];
    return Array.from({ length: maxLen }, (_, i) => {
      const pt: Record<string, number | undefined> = { i };
      displayed.forEach(idx => {
        const prices = idx[pKey] as number[];
        pt[idx.name] = prices?.[i];
      });
      return pt;
    });
  }, [indices, period, selected]);

  const displayedIndices = indices.filter(idx => selected.has(idx.name));

  function toggleIndex(name: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (name === '코스피') return next; // 코스피는 항상 표시
      if (next.has(name)) next.delete(name);
      else if (next.size < 8) next.add(name);
      return next;
    });
  }

  const rKey = RET_KEY[period];

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted/40" />;
  }

  if (!indices.length) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          인덱스 데이터가 없습니다. GitHub Actions에서 <code>--index-only</code>로 수집해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      {/* 헤더 + 기간 탭 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground font-medium">인덱스 누적 수익률</p>
        <div className="flex gap-1">
          {(['5일', '20일', '60일', '120일'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn('text-xs px-3 py-1 rounded-full transition-colors',
                period === p ? 'bg-[#6366f1] text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 인덱스 선택 체크박스 */}
      <div className="flex flex-wrap gap-1.5">
        {indices.map((idx, i) => {
          const style = getStyle(idx.name, i);
          const isOn  = selected.has(idx.name);
          const isKospi = idx.name === '코스피';
          return (
            <button key={idx.name} onClick={() => toggleIndex(idx.name)}
              className={cn('text-xs px-2.5 py-1 rounded-full border transition-all',
                isOn ? 'border-transparent text-white' : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground',
                isKospi && isOn && 'opacity-80',
              )}
              style={isOn ? { background: style.color } : {}}>
              {idx.name}
              {isOn && <span className="ml-1 font-num font-bold">{pct((idx[rKey] as number) ?? 0)}</span>}
            </button>
          );
        })}
      </div>

      {/* 라인 차트 */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="i" hide />
          <YAxis
            tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
            tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} width={44}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
          <Tooltip content={<CustomTooltip />} />
          {displayedIndices.map((idx, i) => {
            const style = getStyle(idx.name, i);
            return (
              <Line key={idx.name} type="monotone" dataKey={idx.name}
                stroke={style.color}
                strokeWidth={style.width ?? 2}
                strokeDasharray={style.dash}
                dot={false} connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* 수익률 요약 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">인덱스</th>
              <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">5일</th>
              <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">20일</th>
              <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">60일</th>
              <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">코스피대비(20일)</th>
            </tr>
          </thead>
          <tbody>
            {displayedIndices
              .sort((a, b) => b.rel_20d - a.rel_20d)
              .map((idx, i) => {
                const style   = getStyle(idx.name, i);
                const isKospi = idx.name === '코스피';
                return (
                  <tr key={idx.name} className="border-t border-border hover:bg-muted/20">
                    <td className="py-1.5 px-2 font-medium whitespace-nowrap" style={{ color: style.color }}>
                      {idx.name}
                    </td>
                    <td className={cn('py-1.5 px-2 text-right font-num', idx.ret_5d >= 0 ? 'text-up' : 'text-down')}>
                      {pct(idx.ret_5d)}
                    </td>
                    <td className={cn('py-1.5 px-2 text-right font-num', idx.ret_20d >= 0 ? 'text-up' : 'text-down')}>
                      {pct(idx.ret_20d)}
                    </td>
                    <td className={cn('py-1.5 px-2 text-right font-num', idx.ret_60d >= 0 ? 'text-up' : 'text-down')}>
                      {pct(idx.ret_60d)}
                    </td>
                    <td className={cn('py-1.5 px-2 text-right font-num font-bold',
                      isKospi ? 'text-muted-foreground' : idx.rel_20d >= 0 ? 'text-up' : 'text-down')}>
                      {isKospi ? '기준' : `${pct(idx.rel_20d)} ${idx.rel_20d >= 0 ? '▲' : '▼'}`}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
