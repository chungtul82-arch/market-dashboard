'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Holding } from '@/types';
import { toKRW, type ExchangeRates } from '@/lib/useExchangeRates';

interface Props { holdings: Holding[]; rates: ExchangeRates }

const COUNTRY_CONFIG: Record<string, { color: string; flag: string }> = {
  '한국': { color: '#6366f1', flag: '🇰🇷' },
  '미국': { color: '#22c55e', flag: '🇺🇸' },
  '중국': { color: '#ef4444', flag: '🇨🇳' },
  '일본': { color: '#f59e0b', flag: '🇯🇵' },
  '기타': { color: '#6b7280', flag: '🌐' },
};

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
  const cfg = COUNTRY_CONFIG[name] ?? COUNTRY_CONFIG['기타'];
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
      <p className="font-bold text-foreground">{cfg.flag} {name}</p>
      <p className="text-muted-foreground">{fmtKRW(value)}원</p>
      <p className="font-num" style={{ color: cfg.color }}>{p.pct.toFixed(1)}%</p>
    </div>
  );
};

export function CountryAllocationChart({ holdings, rates }: Props) {
  const countryMap = new Map<string, number>();
  holdings.forEach(h => {
    const country = h.country || '기타';
    const krwVal  = toKRW(h.currentValue, h.currency, rates);
    countryMap.set(country, (countryMap.get(country) ?? 0) + krwVal);
  });

  const total = Array.from(countryMap.values()).reduce((s, v) => s + v, 0);
  const data  = Array.from(countryMap.entries())
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      pct: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const unset = holdings.filter(h => !h.country).length;

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold text-muted-foreground mb-1">국가별 비중</h2>
      <p className="text-xs text-muted-foreground/60 mb-3">
        테이블에서 국기 버튼으로 직접 설정
        {unset > 0 && <span className="ml-1 text-yellow-500">({unset}개 미설정)</span>}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="44%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={(COUNTRY_CONFIG[entry.name] ?? COUNTRY_CONFIG['기타']).color}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={v => (
              <span className="text-xs text-muted-foreground">
                {(COUNTRY_CONFIG[v] ?? COUNTRY_CONFIG['기타']).flag} {v}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
