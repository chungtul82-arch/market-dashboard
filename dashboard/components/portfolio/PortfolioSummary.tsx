'use client';

import { TrendingUp, TrendingDown, Wallet, BarChart2 } from 'lucide-react';
import type { Holding } from '@/types';
import { cn, fmtNumber } from '@/lib/utils';

interface Props { holdings: Holding[] }

function fmtKRW(v: number) {
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return fmtNumber(v, 0);
}

function fmt(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`; }

export function PortfolioSummary({ holdings }: Props) {
  const totalCurrentValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalInvested     = holdings.reduce((s, h) => s + h.investedValue, 0);
  const totalPnl          = totalCurrentValue - totalInvested;
  const totalReturnPct    = totalInvested !== 0 ? (totalPnl / totalInvested) * 100 : 0;
  const totalDailyPnl     = holdings.reduce((s, h) => s + (h.dailyChange ?? 0), 0);
  const positive          = totalPnl >= 0;

  const cards = [
    {
      label: '총 평가금액',
      value: `${fmtKRW(totalCurrentValue)}원`,
      sub:   `투자원금 ${fmtKRW(totalInvested)}원`,
      icon:  Wallet,
      color: 'text-[#6366f1]',
    },
    {
      label: '총 손익',
      value: `${positive ? '+' : ''}${fmtKRW(totalPnl)}원`,
      sub:   fmt(totalReturnPct),
      icon:  positive ? TrendingUp : TrendingDown,
      color: positive ? 'text-up' : 'text-down',
    },
    {
      label: '수익률',
      value: fmt(totalReturnPct),
      sub:   `${holdings.filter(h => h.returnPct >= 0).length}개 수익 / ${holdings.filter(h => h.returnPct < 0).length}개 손실`,
      icon:  BarChart2,
      color: positive ? 'text-up' : 'text-down',
    },
    {
      label: '일간 손익',
      value: `${totalDailyPnl >= 0 ? '+' : ''}${fmtKRW(totalDailyPnl)}원`,
      sub:   `${holdings.length}개 종목`,
      icon:  totalDailyPnl >= 0 ? TrendingUp : TrendingDown,
      color: totalDailyPnl >= 0 ? 'text-up' : 'text-down',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, sub, icon: Icon, color }) => (
        <div key={label} className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <Icon className={cn('w-4 h-4', color)} />
          </div>
          <p className={cn('text-xl font-bold font-num', color)}>{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        </div>
      ))}
    </div>
  );
}
