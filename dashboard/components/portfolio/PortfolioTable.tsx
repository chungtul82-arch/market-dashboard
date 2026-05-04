'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil, ChevronDown } from 'lucide-react';
import { HoldingEditModal } from './HoldingEditModal';
import type { Holding } from '@/types';
import { cn, fmtNumber } from '@/lib/utils';
import { toKRW, CURRENCY_SYMBOL, type ExchangeRates } from '@/lib/useExchangeRates';

interface Props {
  holdings: Holding[];
  rates: ExchangeRates;
  onUpdateHolding: (symbol: string, updates: Partial<Holding>) => Promise<void>;
}

type SortKey = 'currentValueKRW' | 'returnPct' | 'pnlKRW' | 'dailyChangePct';

const ALL_SECTORS = [
  'AI·반도체', '소부장', '전력·전기', '원자력', '방산', '중공업·조선',
  '재건·인프라', '바이오', '2차전지', '로봇·자동화', '게임·엔터', 'K-뷰티',
  '자동차·모빌리티', '금융·은행', '증권·보험', '철강·금속', '화학', '원자재',
  '헬스케어·의료', '음식료', '유통·소비재', '수소·친환경', '태양광·풍력',
  '코스피200', '코스닥150', '기타',
];

const COUNTRIES = [
  { code: '한국', flag: '🇰🇷' },
  { code: '미국', flag: '🇺🇸' },
  { code: '중국', flag: '🇨🇳' },
  { code: '일본', flag: '🇯🇵' },
  { code: '기타', flag: '🌐' },
];

const CURRENCIES: { code: 'KRW' | 'USD' | 'RMB'; label: string; sym: string }[] = [
  { code: 'KRW', label: '원화',  sym: '₩' },
  { code: 'USD', label: '달러',  sym: '$' },
  { code: 'RMB', label: '위안',  sym: '¥' },
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

// ── 공통 인라인 선택기 ─────────────────────────────────
function InlinePicker<T extends string>({
  value, options, onSave, renderLabel, renderItem, buttonClass,
}: {
  value: T | undefined;
  options: T[];
  onSave: (v: T) => Promise<void>;
  renderLabel: (v: T | undefined) => React.ReactNode;
  renderItem: (v: T) => React.ReactNode;
  buttonClass?: string;
}) {
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  async function handleSelect(v: T) {
    setSaving(true); setOpen(false);
    await onSave(v);
    setSaving(false);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('flex items-center gap-0.5 transition-colors', buttonClass)}
        title="클릭하여 변경"
      >
        {saving ? '⏳' : renderLabel(value)}
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-card border border-border rounded-xl shadow-xl min-w-[100px] overflow-hidden">
          {options.map(o => (
            <button key={o} onClick={() => handleSelect(o)}
              className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 transition-colors',
                o === value ? 'text-[#6366f1] font-semibold' : 'text-foreground')}>
              {renderItem(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 가격 셀 (현지가 + 원화) ────────────────────────────
function PriceCell({ price, currency, rates }: { price: number; currency?: 'KRW'|'USD'|'RMB'; rates: ExchangeRates }) {
  const sym    = CURRENCY_SYMBOL[currency ?? 'KRW'];
  const krw    = toKRW(price, currency, rates);
  const isKRW  = !currency || currency === 'KRW';
  return (
    <td className="py-2 px-3 text-right">
      {!isKRW && (
        <p className="text-xs text-muted-foreground font-num">{sym}{fmtNumber(price, 2)}</p>
      )}
      <p className="font-num text-sm text-foreground">₩{fmtNumber(krw, 0)}</p>
    </td>
  );
}

const SORT_COLS: { key: SortKey; label: string }[] = [
  { key: 'currentValueKRW', label: '평가금액₩' },
  { key: 'returnPct',       label: '수익률'     },
  { key: 'pnlKRW',          label: '손익₩'      },
  { key: 'dailyChangePct',  label: '일간변동'   },
];

export function PortfolioTable({ holdings, rates, onUpdateHolding }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('currentValueKRW');
  const [asc,     setAsc]     = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);

  // 각 종목의 원화 환산값 계산
  const withKRW = holdings.map(h => ({
    ...h,
    currentValueKRW: toKRW(h.currentValue, h.currency, rates),
    investedValueKRW: toKRW(h.investedValue, h.currency, rates),
    pnlKRW: toKRW(h.pnl, h.currency, rates),
  }));

  const sorted = [...withKRW].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return asc ? av - bv : bv - av;
  });

  const totalKRW = withKRW.reduce((s, h) => s + h.currentValueKRW, 0);

  function handleSort(key: SortKey) {
    if (key === sortKey) setAsc(p => !p); else { setSortKey(key); setAsc(false); }
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border p-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground">보유 종목</h2>
          <p className="text-xs text-muted-foreground/60">배지 클릭 → 직접 변경 · ✏️ → 전체 수정</p>
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">종목명</th>
              <th className="text-center py-2 px-2 text-muted-foreground font-medium">국가</th>
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">섹터</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">현재가</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">평단가</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">수량</th>
              {SORT_COLS.map(c => (
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
              const weight = totalKRW > 0 ? (h.currentValueKRW / totalKRW) * 100 : 0;
              return (
                <tr key={h.symbol} className="border-t border-border hover:bg-muted/20 transition-colors">
                  {/* 종목명 + 통화 */}
                  <td className="py-2 px-3">
                    <p className="font-medium text-foreground">{h.name || h.symbol}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-muted-foreground font-num">{h.symbol}</p>
                      <InlinePicker
                        value={h.currency}
                        options={CURRENCIES.map(c => c.code)}
                        onSave={cur => onUpdateHolding(h.symbol, { currency: cur })}
                        renderLabel={v => (
                          <span className={cn(
                            'text-xs px-1.5 py-0 rounded border font-num',
                            v ? 'border-border text-muted-foreground' : 'border-dashed border-muted-foreground/30 text-muted-foreground/50',
                          )}>
                            {v ?? 'KRW'}
                          </span>
                        )}
                        renderItem={v => `${CURRENCY_SYMBOL[v]} ${v}`}
                      />
                    </div>
                  </td>

                  {/* 국가 */}
                  <td className="py-2 px-2 text-center">
                    <InlinePicker
                      value={h.country as string | undefined}
                      options={COUNTRIES.map(c => c.code)}
                      onSave={country => onUpdateHolding(h.symbol, { country })}
                      renderLabel={v => <span className="text-sm">{COUNTRIES.find(c => c.code === v)?.flag ?? '🌐'}</span>}
                      renderItem={v => `${COUNTRIES.find(c => c.code === v)?.flag} ${v}`}
                    />
                  </td>

                  {/* 섹터 */}
                  <td className="py-2 px-3">
                    <InlinePicker
                      value={h.sector}
                      options={ALL_SECTORS}
                      onSave={sector => onUpdateHolding(h.symbol, { sector })}
                      renderLabel={v => (
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full border',
                          v && v !== '기타' ? 'border-border bg-muted text-muted-foreground' : 'border-dashed border-muted-foreground/30 text-muted-foreground/50',
                        )}>
                          {v ?? '미지정'}
                        </span>
                      )}
                      renderItem={v => v}
                    />
                  </td>

                  {/* 현재가 (현지 + ₩) */}
                  <PriceCell price={h.currentPrice} currency={h.currency} rates={rates} />

                  {/* 평단가 (현지 + ₩) */}
                  <PriceCell price={h.avgPurchasePrice} currency={h.currency} rates={rates} />

                  <td className="py-2 px-3 text-right font-num">{fmtNumber(h.quantity, 0)}</td>
                  <td className="py-2 px-3 text-right font-num">{fmtKRW(h.currentValueKRW)}</td>
                  <td className="py-2 px-3 text-right"><Pct v={h.returnPct} /></td>
                  <td className="py-2 px-3 text-right">
                    <span className={cn('font-num text-sm', h.pnlKRW >= 0 ? 'text-up' : 'text-down')}>
                      {h.pnlKRW >= 0 ? '+' : ''}{fmtKRW(h.pnlKRW)}
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

                  <td className="py-2 px-2">
                    <button className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                            onClick={() => setEditing(h)} title="전체 수정">
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
