'use client';

import { useState } from 'react';
import type { Holding } from '@/types';
import { cn, fmtNumber } from '@/lib/utils';

interface Props { holdings: Holding[] }

type SortKey = 'currentValue' | 'returnPct' | 'pnl' | 'dailyChangePct';

function fmtKRW(v: number) {
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)}억`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return fmtNumber(v, 0);
}

function Pct({ v }: { v: number }) {
  return (
    <span className={cn('font-num font-bold', v >= 0 ? 'text-up' : 'text-down')}>
      {v >= 0 ? '+' : ''}{v.toFixed(2)}%
    </span>
  );
}

function Amt({ v }: { v: number }) {
  return (
    <span className={cn('font-num', v >= 0 ? 'text-up' : 'text-down')}>
      {v >= 0 ? '+' : ''}{fmtKRW(v)}
    </span>
  );
}

const COLS: { key: SortKey; label: string }[] = [
  { key: 'currentValue',   label: '평가금액'  },
  { key: 'returnPct',      label: '수익률'    },
  { key: 'pnl',            label: '손익'      },
  { key: 'dailyChangePct', label: '일간변동'  },
];

export function PortfolioTable({ holdings }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('currentValue');
  const [asc, setAsc]         = useState(false);

  const sorted = [...holdings].sort((a, b) =>
    asc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]
  );

  function handleSort(key: SortKey) {
    if (key === sortKey) setAsc(p => !p);
    else { setSortKey(key); setAsc(false); }
  }

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);

  return (
    <div className="bg-card rounded-xl border border-border p-4 overflow-x-auto">
      <h2 className="text-sm font-semibold text-muted-foreground mb-4">보유 종목</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 text-muted-foreground font-medium">종목</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">현재가</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">평균단가</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">수량</th>
            {COLS.map(c => (
              <th key={c.key}
                  className="text-right py-2 px-3 text-muted-foreground font-medium cursor-pointer hover:text-foreground"
                  onClick={() => handleSort(c.key)}>
                {c.label} {sortKey === c.key ? (asc ? '↑' : '↓') : ''}
              </th>
            ))}
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">비중</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(h => {
            const weight = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
            return (
              <tr key={h.symbol} className="border-t border-border hover:bg-muted/30 transition-colors">
                <td className="py-2 px-3 font-medium text-foreground">{h.symbol}</td>
                <td className="py-2 px-3 text-right font-num">{fmtNumber(h.currentPrice, 0)}</td>
                <td className="py-2 px-3 text-right font-num text-muted-foreground">{fmtNumber(h.avgPurchasePrice, 0)}</td>
                <td className="py-2 px-3 text-right font-num">{fmtNumber(h.quantity, 0)}</td>
                <td className="py-2 px-3 text-right">{fmtKRW(h.currentValue)}</td>
                <td className="py-2 px-3 text-right"><Pct v={h.returnPct} /></td>
                <td className="py-2 px-3 text-right"><Amt v={h.pnl} /></td>
                <td className="py-2 px-3 text-right"><Pct v={h.dailyChangePct} /></td>
                <td className="py-2 px-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-16 bg-muted rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-[#6366f1]"
                           style={{ width: `${Math.min(weight, 100)}%` }} />
                    </div>
                    <span className="text-xs font-num text-muted-foreground w-8 text-right">
                      {weight.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
