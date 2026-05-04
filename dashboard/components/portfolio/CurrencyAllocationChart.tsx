'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Holding } from '@/types';
import { toKRW, type ExchangeRates, CURRENCY_SYMBOL } from '@/lib/useExchangeRates';

interface Props { holdings: Holding[]; rates: ExchangeRates }

const CURRENCY_COLOR: Record<string, string> = {
  KRW: '#6366f1',
  USD: '#22c55e',
  RMB: '#ef4444',
};

function fmtKRW(v: number) {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return v.toLocaleString();
}

const CustomTooltip = ({ active, payload }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { pct: number; rate: string } }[];
}) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
      <p className="font-bold text-foreground">{CURRENCY_SYMBOL[name] ?? ''} {name}</p>
      <p className="text-muted-foreground">{fmtKRW(value)}원 환산</p>
      <p className="font-num" style={{ color: CURRENCY_COLOR[name] ?? '#6b7280' }}>{p.pct.toFixed(1)}%</p>
      <p className="text-xs text-muted-foreground/60 mt-0.5">{p.rate}</p>
    </div>
  );
};

export function CurrencyAllocationChart({ holdings, rates }: Props) {
  const currMap = new Map<string, number>();
  holdings.forEach(h => {
    const cur = h.currency ?? 'KRW';
    const krwVal = toKRW(h.currentValue, h.currency, rates);
    currMap.set(cur, (currMap.get(cur) ?? 0) + krwVal);
  });

  const total = Array.from(currMap.values()).reduce((s, v) => s + v, 0);
  const data  = Array.from(currMap.entries())
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      pct:   total > 0 ? (value / total) * 100 : 0,
      rate:  name === 'USD' ? `$1 = ₩${rates.usd_krw.toFixed(0)}`
           : name === 'RMB' ? `¥1 = ₩${rates.cny_krw.toFixed(0)}`
           : '기준 통화',
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold text-muted-foreground mb-1">통화별 비중</h2>
      <p className="text-xs text-muted-foreground/60 mb-3">
        원화 환산 기준 · USD ₩{rates.usd_krw.toFixed(0)} · RMB ₩{rates.cny_krw.toFixed(0)}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} cx="50%" cy="44%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
            {data.map(entry => (
              <Cell key={entry.name} fill={CURRENCY_COLOR[entry.name] ?? '#6b7280'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={v => (
            <span className="text-xs text-muted-foreground">{CURRENCY_SYMBOL[v] ?? ''} {v}</span>
          )} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
