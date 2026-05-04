'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil, ChevronDown } from 'lucide-react';
import { HoldingEditModal } from './HoldingEditModal';
import type { Holding } from '@/types';
import { cn, fmtNumber } from '@/lib/utils';

interface Props {
  holdings: Holding[];
  onUpdateHolding: (symbol: string, updates: Partial<Holding>) => Promise<void>;
}

type SortKey = 'currentValue' | 'returnPct' | 'pnl' | 'dailyChangePct';

const ALL_SECTORS = [
  'AI·반도체', '소부장', '전력·전기', '원자력', '방산', '중공업·조선',
  '재건·인프라', '바이오', '2차전지', '로봇·자동화', '게임·엔터', 'K-뷰티',
  '자동차·모빌리티', '금융·은행', '증권·보험', '철강·금속', '화학',
  '헬스케어·의료', '음식료', '유통·소비재', '수소·친환경', '태양광·풍력',
  '코스피200', '코스닥150', '기타',
];

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

// ── 인라인 섹터 선택기 ────────────────────────────────
function SectorPicker({
  symbol, sector, onSave,
}: {
  symbol: string;
  sector?: string;
  onSave: (symbol: string, sector: string) => Promise<void>;
}) {
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function handleSelect(s: string) {
    setSaving(true);
    setOpen(false);
    await onSave(symbol, s);
    setSaving(false);
  }

  const current = sector || '기타';

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors',
          saving
            ? 'border-[#6366f1]/30 bg-[#6366f1]/10 text-[#6366f1]'
            : current === '기타'
              ? 'border-dashed border-muted-foreground/30 text-muted-foreground hover:border-[#6366f1]/50 hover:text-[#6366f1]'
              : 'border-border bg-muted text-muted-foreground hover:border-[#6366f1]/50 hover:text-foreground',
        )}
        title="클릭하여 섹터 변경"
      >
        {saving ? '저장중...' : current}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-card border border-border rounded-xl shadow-xl w-40 max-h-64 overflow-y-auto">
          {ALL_SECTORS.map(s => (
            <button
              key={s}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 transition-colors',
                s === current ? 'text-[#6366f1] font-semibold' : 'text-foreground',
              )}
              onClick={() => handleSelect(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const COLS: { key: SortKey; label: string }[] = [
  { key: 'currentValue',   label: '평가금액' },
  { key: 'returnPct',      label: '수익률'   },
  { key: 'pnl',            label: '손익'     },
  { key: 'dailyChangePct', label: '일간변동' },
];

export function PortfolioTable({ holdings, onUpdateHolding }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('currentValue');
  const [asc,     setAsc]     = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);

  const sorted = [...holdings].sort((a, b) =>
    asc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]
  );
  const total = holdings.reduce((s, h) => s + h.currentValue, 0);

  function handleSort(key: SortKey) {
    if (key === sortKey) setAsc(p => !p);
    else { setSortKey(key); setAsc(false); }
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border p-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground">보유 종목</h2>
          <p className="text-xs text-muted-foreground/60">섹터 배지 클릭 → 직접 변경 · ✏️ 클릭 → 전체 수정</p>
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">종목명</th>
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">섹터</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">현재가</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">평균단가</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">수량</th>
              {COLS.map(c => (
                <th
                  key={c.key}
                  className="text-right py-2 px-3 text-muted-foreground font-medium cursor-pointer hover:text-foreground"
                  onClick={() => handleSort(c.key)}
                >
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
                <tr key={h.symbol} className="border-t border-border hover:bg-muted/20 transition-colors">
                  {/* 종목명 */}
                  <td className="py-2 px-3">
                    <p className="font-medium text-foreground">{h.name || h.symbol}</p>
                    <p className="text-xs text-muted-foreground font-num">{h.symbol}</p>
                  </td>

                  {/* 섹터 — 인라인 선택기 */}
                  <td className="py-2 px-3">
                    <SectorPicker
                      symbol={h.symbol}
                      sector={h.sector}
                      onSave={(sym, sec) => onUpdateHolding(sym, { sector: sec })}
                    />
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

                  {/* 비중 */}
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-14 bg-muted rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-[#6366f1]" style={{ width: `${Math.min(weight, 100)}%` }} />
                      </div>
                      <span className="text-xs font-num text-muted-foreground w-8 text-right">{weight.toFixed(1)}%</span>
                    </div>
                  </td>

                  {/* 편집 */}
                  <td className="py-2 px-2">
                    <button
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
                      onClick={() => setEditing(h)}
                      title="전체 수정"
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
