'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { HoldingEditModal } from './HoldingEditModal';
import type { Holding } from '@/types';
import { cn, fmtNumber } from '@/lib/utils';

interface Props {
  holdings: Holding[];
  onUpdateHolding: (symbol: string, updates: Partial<Holding>) => Promise<void>;
}

type SortKey = 'currentValue' | 'returnPct' | 'pnl' | 'dailyChangePct';

function fmtKRW(v: number) {
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)}억`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return fmtNumber(v, 0);
}

function Pct({ v }: { v: number }) {
  return <span className={cn('font-num font-bold', v >= 0 ? 'text-up' : 'text-down')}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>;
}

const COLS: { key: SortKey; label: string }[] = [
  { key: 'currentValue',   label: '평가금액' },
  { key: 'returnPct',      label: '수익률'   },
  { key: 'pnl',            label: '손익'     },
  { key: 'dailyChangePct', label: '일간변동' },
];

export function PortfolioTable({ holdings, onUpdateHolding }: Props) {
  const [sortKey,  setSortKey]  = useState<SortKey>('currentValue');
  const [asc,      setAsc]      = useState(false);
  const [editing,  setEditing]  = useState<Holding | null>(null);

  const sorted = [...holdings].sort((a, b) => asc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]);
  const total  = holdings.reduce((s, h) => s + h.currentValue, 0);

  function handleSort(key: SortKey) {
    if (key === sortKey) setAsc(p => !p);
    else { setSortKey(key); setAsc(false); }
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border p-4 overflow-x-auto">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">보유 종목</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">종목명</th>
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">섹터</th>
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
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(h => {
              const weight = total > 0 ? (h.currentValue / total) * 100 : 0;
              return (
                <tr key={h.symbol} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3">
                    <p className="font-medium text-foreground">{h.name || h.symbol}</p>
                    <p className="text-xs text-muted-foreground font-num">{h.symbol}</p>
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      {h.sector || '기타'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-num">{fmtNumber(h.currentPrice, 0)}</td>
                  <td className="py-2 px-3 text-right font-num text-muted-foreground">{fmtNumber(h.avgPurchasePrice, 0)}</td>
                  <td className="py-2 px-3 text-right font-num">{fmtNumber(h.quantity, 0)}</td>
                  <td className="py-2 px-3 text-right font-num">{fmtKRW(h.currentValue)}</td>
                  <td className="py-2 px-3 text-right"><Pct v={h.returnPct} /></td>
                  <td className="py-2 px-3 text-right">
                    <span className={cn('font-num text-sm', h.pnl >= 0 ? 'text-up' : 'text-down')}>
                      {h.pnl >= 0 ? '+' : ''}{fmtKRW(h.pnl)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right"><Pct v={h.dailyChangePct} /></td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-14 bg-muted rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-[#6366f1]" style={{ width: `${Math.min(weight, 100)}%` }} />
                      </div>
                      <span className="text-xs font-num text-muted-foreground w-8 text-right">{weight.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <button
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
                      onClick={() => setEditing(h)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <HoldingEditModal
        holding={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={onUpdateHolding}
      />
    </>
  );
}
