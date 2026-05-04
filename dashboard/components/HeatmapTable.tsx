'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { SectorData, Signal } from '@/types';
import { getReturnColor, getRsColor, fmt, cn, foreignIcon } from '@/lib/utils';
import { SECTOR_CONSTITUENTS } from '@/lib/sectorConstituents';

interface Props {
  sectors: Record<string, SectorData>;
  signals: Signal[];
}

const COLS = [
  { key: 'return_5d'  as const, label: '5일'  },
  { key: 'return_20d' as const, label: '20일' },
  { key: 'return_60d' as const, label: '60일' },
] as const;

type SignalType = Signal['signal'];

const SIGNAL_BADGE: Record<SignalType, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  '강세 진입': { label: '강세',    variant: 'success'     },
  '이탈 경고': { label: '이탈',    variant: 'warning'     },
  '단기 과열': { label: '과열',    variant: 'destructive' },
};

function ReturnCell({ value }: { value: number | undefined }) {
  if (value === undefined || value === null) {
    return (
      <td className="py-2 px-2 text-center">
        <span className="inline-block rounded-md px-3 py-1 text-xs bg-muted text-muted-foreground">N/A</span>
      </td>
    );
  }
  const { bg, text } = getReturnColor(value);
  return (
    <td className="py-2 px-2 text-center">
      <span className="inline-block rounded-md px-3 py-1 text-xs font-bold font-num tabular-nums"
            style={{ backgroundColor: bg, color: text }}>
        {fmt(value)}
      </span>
    </td>
  );
}

function SectorModal({
  sector, data, sectorSignals, open, onClose,
}: {
  sector: string;
  data: SectorData;
  sectorSignals: Signal[];
  open: boolean;
  onClose: () => void;
}) {
  const rsColor = getRsColor(data.rs_score);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{sector}</DialogTitle>
        </DialogHeader>

        {/* 수익률 카드 */}
        <div className="grid grid-cols-3 gap-2">
          {COLS.map(({ key, label }) => {
            const val = data[key];
            const { bg, text } = getReturnColor(val ?? 0);
            return (
              <div key={key} className="rounded-lg p-3 text-center" style={{ backgroundColor: bg }}>
                <p className="text-xs mb-1" style={{ color: text, opacity: 0.75 }}>{label}</p>
                <p className="text-base font-bold font-num" style={{ color: text }}>{fmt(val ?? 0)}</p>
              </div>
            );
          })}
        </div>

        {/* RS 점수 */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">상대강도 점수</span>
            <span className="font-bold font-num" style={{ color: rsColor }}>
              {Math.round(data.rs_score ?? 0)} / 100
            </span>
          </div>
          <Progress value={data.rs_score ?? 0} className="h-2" style={{ '--progress-color': rsColor } as React.CSSProperties} />
        </div>

        {/* 백분위 */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {[
            { label: '5일 백분위', key: 'pct_return_5d' as const },
            { label: '20일 백분위', key: 'pct_return_20d' as const },
            { label: '60일 백분위', key: 'pct_return_60d' as const },
          ].map(({ label, key }) => (
            <div key={key} className="bg-muted rounded-lg p-2">
              <p className="text-muted-foreground">{label}</p>
              <p className="font-bold font-num text-sm mt-0.5">{Math.round(data[key] ?? 0)}위</p>
            </div>
          ))}
        </div>

        {/* 외국인 순매수 */}
        {data.foreign_net_buy !== undefined && (
          <div className="flex items-center justify-between text-sm bg-muted rounded-lg px-3 py-2">
            <span className="text-muted-foreground">외국인 순매수 (5일)</span>
            <span className={cn('font-bold font-num', data.foreign_net_buy >= 0 ? 'text-up' : 'text-down')}>
              {data.foreign_net_buy >= 0 ? '▲' : '▼'}{' '}
              {Math.abs(data.foreign_net_buy / 1e8).toFixed(1)}억
            </span>
          </div>
        )}

        {/* 신호 */}
        {sectorSignals.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">감지된 신호</p>
            <div className="flex flex-wrap gap-1.5">
              {sectorSignals.map((sig, i) => (
                <Badge key={i} variant={SIGNAL_BADGE[sig.signal]?.variant}>
                  {sig.signal} {fmt(sig.value)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConstituentModal({ sector, open, onClose }: { sector: string; open: boolean; onClose: () => void }) {
  const stocks = SECTOR_CONSTITUENTS[sector] ?? [];
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">{sector} — 주요 구성종목</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2 mb-2">ETF 기준 추정 비중 (참고용)</p>
        {stocks.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">구성종목 정보 없음</p>
        ) : (
          <div className="space-y-2">
            {stocks.map((s, i) => (
              <div key={s.symbol} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-foreground">{s.name}</span>
                    <span className="text-xs font-num text-[#6366f1]">{s.weight.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-1">
                      <div className="h-1 rounded-full bg-[#6366f1]/70" style={{ width: `${Math.min(s.weight * 2.5, 100)}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground/60">{s.symbol}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function HeatmapTable({ sectors, signals }: Props) {
  const [selected,    setSelected]    = useState<string | null>(null);
  const [constituent, setConstituent] = useState<string | null>(null);

  const signalMap = new Map<string, Signal[]>();
  signals.forEach((sig) => {
    signalMap.set(sig.sector, [...(signalMap.get(sig.sector) ?? []), sig]);
  });

  const sorted = Object.entries(sectors).sort(([, a], [, b]) => (b.rs_score ?? 0) - (a.rs_score ?? 0));
  const selectedData = selected ? sectors[selected] : null;

  return (
    <>
      <div className="bg-card rounded-xl border border-border p-4 overflow-x-auto">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4">
          섹터 수익률 히트맵
          <span className="ml-2 text-xs text-muted-foreground/60">섹터명 클릭 → 구성종목 · 행 클릭 → RS 상세</span>
        </h2>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium w-40">섹터</th>
              {COLS.map((c) => (
                <th key={c.key} className="py-2 px-2 text-center text-muted-foreground font-medium">{c.label}</th>
              ))}
              <th className="py-2 px-3 text-center text-muted-foreground font-medium">상대강도</th>
              <th className="py-2 px-3 text-center text-muted-foreground font-medium">외국인</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(([name, data]) => {
              const rsScore = data.rs_score ?? 0;
              const rsColor = getRsColor(rsScore);
              const icon    = foreignIcon(data.foreign_net_buy);
              const sigs    = signalMap.get(name) ?? [];
              const topSig  = sigs[0];

              return (
                <tr
                  key={name}
                  className="border-t border-border hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => setSelected(name)}
                >
                  {/* 섹터명 + 신호 뱃지 */}
                  <td className="py-2 px-3">
                    <div className="flex flex-col gap-0.5">
                      <button
                        className="text-foreground font-medium whitespace-nowrap text-left hover:text-[#6366f1] hover:underline transition-colors"
                        onClick={e => { e.stopPropagation(); setConstituent(name); }}
                      >
                        {name}
                      </button>
                      {topSig && (
                        <Badge variant={SIGNAL_BADGE[topSig.signal]?.variant} className="w-fit text-[10px] px-1.5 py-0">
                          {SIGNAL_BADGE[topSig.signal]?.label}
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* 수익률 셀 */}
                  {COLS.map((c) => <ReturnCell key={c.key} value={data[c.key]} />)}

                  {/* 상대강도 */}
                  <td className="py-2 px-3 min-w-[100px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all"
                             style={{ width: `${Math.min(rsScore, 100)}%`, backgroundColor: rsColor }} />
                      </div>
                      <span className="text-xs font-bold font-num w-7 text-right" style={{ color: rsColor }}>
                        {Math.round(rsScore)}
                      </span>
                    </div>
                  </td>

                  {/* 외국인 순매수 */}
                  <td className="py-2 px-3 text-center text-xs font-num">
                    {icon ? (
                      <span className={icon.includes('▲') ? 'text-up' : 'text-down'}>{icon}</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && selectedData && (
        <SectorModal
          sector={selected}
          data={selectedData}
          sectorSignals={signalMap.get(selected) ?? []}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}

      <ConstituentModal
        sector={constituent ?? ''}
        open={!!constituent}
        onClose={() => setConstituent(null)}
      />
    </>
  );
}

export function HeatmapSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <Skeleton className="h-4 w-36" />
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex gap-3 items-center">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-10" />
        </div>
      ))}
    </div>
  );
}
