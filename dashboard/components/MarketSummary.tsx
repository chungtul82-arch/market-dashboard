'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { MarketIndices } from '@/types';
import { cn, fmt, fmtNumber } from '@/lib/utils';

interface Props {
  indices?: MarketIndices;
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data);
  const normalized = data.map((v) => ({ v: v - min }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={normalized}>
        <Line
          type="monotone"
          dataKey="v"
          dot={false}
          strokeWidth={1.5}
          stroke={positive ? '#22c55e' : '#ef4444'}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TrendIcon({ pct }: { pct: number }) {
  if (pct > 0.001) return <TrendingUp  className="w-4 h-4 text-up" />;
  if (pct < -0.001) return <TrendingDown className="w-4 h-4 text-down" />;
  return <Minus className="w-4 h-4 text-neutral" />;
}

function vixLabel(label?: string) {
  const map: Record<string, string> = { 탐욕: 'text-up', 중립: 'text-neutral', 공포: 'text-down' };
  return map[label ?? '중립'] ?? 'text-neutral';
}

interface CardDef {
  key: keyof MarketIndices;
  label: string;
  unit?: string;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}

const CARDS: CardDef[] = [
  { key: 'kospi',   label: '코스피',        decimals: 2 },
  { key: 'kosdaq',  label: '코스닥',        decimals: 2 },
  { key: 'usd_krw', label: '달러/원',       decimals: 1 },
  { key: 'vix',     label: 'VIX 공포지수',  decimals: 2 },
  { key: 'wti',     label: 'WTI 원유',      decimals: 2, prefix: '$' },
  { key: 'us10y',   label: '미국 10년물',   decimals: 3, suffix: '%' },
];

export function MarketSummary({ indices }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {CARDS.map(({ key, label, decimals = 2, suffix, prefix }) => {
        const idx = indices?.[key];

        if (!idx) {
          return (
            <div key={key} className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-2">{label}</p>
              <Skeleton className="h-7 w-24 mb-1" />
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-9 w-full" />
            </div>
          );
        }

        const positive = idx.change_pct >= 0;
        const changeColor = positive ? 'text-up' : 'text-down';

        return (
          <div key={key} className="bg-card rounded-xl border border-border p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <TrendIcon pct={idx.change_pct} />
            </div>

            <p className="font-num text-xl font-bold text-foreground leading-tight">
              {prefix}{fmtNumber(idx.value, decimals)}{suffix}
            </p>

            <div className="flex items-center gap-2 mt-0.5 mb-2">
              <span className={cn('font-num text-sm font-semibold', changeColor)}>
                {fmt(idx.change_pct)}
              </span>
              {key === 'vix' && idx.label && (
                <span className={cn('text-xs font-medium', vixLabel(idx.label))}>
                  {idx.label}
                </span>
              )}
            </div>

            {idx.history.length >= 2 && (
              <Sparkline data={idx.history} positive={positive} />
            )}
          </div>
        );
      })}
    </div>
  );
}
