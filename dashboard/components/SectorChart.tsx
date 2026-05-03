'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine,
  ResponsiveContainer, LabelList,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { SectorData } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  sectors: Record<string, SectorData>;
}

type Period = '5d' | '20d' | '60d';

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: '5d',  label: '5일'  },
  { key: '20d', label: '20일' },
  { key: '60d', label: '60일' },
];

function barColor(value: number): string {
  return value >= 0 ? '#22c55e' : '#ef4444';
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
      <p className="text-foreground font-medium mb-1">{label}</p>
      <p className={cn('font-bold font-num', val >= 0 ? 'text-up' : 'text-down')}>
        {val >= 0 ? '+' : ''}{val.toFixed(1)}%
      </p>
    </div>
  );
};

export function SectorChart({ sectors }: Props) {
  const [period, setPeriod] = useState<Period>('5d');

  const keyMap: Record<Period, keyof SectorData> = {
    '5d':  'return_5d',
    '20d': 'return_20d',
    '60d': 'return_60d',
  };

  const data = Object.entries(sectors)
    .map(([name, d]) => ({
      name,
      value: parseFloat(((d[keyMap[period]] as number ?? 0) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground">섹터별 수익률</h2>
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map(({ key, label }) => (
            <Button
              key={key}
              variant={period === key ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'h-7 px-2.5 text-xs',
                period === key
                  ? 'bg-primary/20 text-primary hover:bg-primary/30'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setPeriod(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={data.length * 36 + 20}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 50, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: 'hsl(240 25% 20%)' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={82}
            tick={{ fill: '#aaaacc', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine x={0} stroke="hsl(240 25% 28%)" />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.value)} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
              style={{ fill: '#888899', fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-28" />
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-7 w-12" />)}
        </div>
      </div>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex gap-3 items-center mb-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 flex-1" />
        </div>
      ))}
    </div>
  );
}
