'use client';

import { cn, fmtNumber } from '@/lib/utils';
import type { TopVolumeStock } from '@/types';

interface Props {
  stocks?: TopVolumeStock[];
}

function pct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function fmtVal(v: number): string {
  if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}조`;
  if (v >= 100_000_000)       return `${(v / 100_000_000).toFixed(0)}억`;
  if (v >= 10_000)            return `${(v / 10_000).toFixed(0)}만`;
  return v.toLocaleString();
}

export function TopVolumeList({ stocks }: Props) {
  if (!stocks?.length) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
        거래량 데이터 없음 — GitHub Actions 실행 후 업데이트됩니다
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium w-6">#</th>
              <th className="text-left px-3 py-2 font-medium">종목</th>
              <th className="text-right px-3 py-2 font-medium">현재가</th>
              <th className="text-right px-3 py-2 font-medium">등락률</th>
              <th className="text-right px-3 py-2 font-medium">거래대금</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s, i) => (
              <tr
                key={s.ticker}
                className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-3 py-2 text-muted-foreground font-num">{i + 1}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded font-medium',
                      s.market === 'KOSPI'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-purple-500/10 text-purple-400',
                    )}>
                      {s.market}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-num">{s.ticker}</span>
                </td>
                <td className="px-3 py-2 text-right font-num font-medium">
                  {fmtNumber(s.close, 0)}
                </td>
                <td className={cn(
                  'px-3 py-2 text-right font-num font-semibold',
                  s.change_pct >= 0 ? 'text-up' : 'text-down',
                )}>
                  {pct(s.change_pct)}
                </td>
                <td className="px-3 py-2 text-right font-num text-muted-foreground">
                  {fmtVal(s.trade_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
