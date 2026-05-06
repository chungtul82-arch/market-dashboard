'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Signal } from '@/types';
import { fmt, cn } from '@/lib/utils';

interface Props { signals: Signal[] }

interface SignalMeta {
  icon: string;
  title: string;
  desc: (v: number) => string;
  border: string;
  bg: string;
  textColor: string;
  badgeBg: string;
}

function getSignalMeta(signal: string): SignalMeta | null {
  switch (signal) {
    case '강세 진입': return {
      icon: '🔥', title: '강세 진입',
      desc: (v) => `5일 수익률 ${fmt(v)} — RS ≥60 + 모멘텀 가속`,
      border: 'border-green-500/30', bg: 'bg-green-950/40',
      textColor: 'text-green-400', badgeBg: 'bg-green-500/15 text-green-300',
    };
    case '이탈 경고': return {
      icon: '⚠️', title: '이탈 경고',
      desc: (v) => `5일 ${fmt(v)} — 중기 강세 대비 단기 급락`,
      border: 'border-yellow-500/30', bg: 'bg-yellow-950/40',
      textColor: 'text-yellow-400', badgeBg: 'bg-yellow-500/15 text-yellow-300',
    };
    case '단기 과열': return {
      icon: '🚨', title: '단기 과열',
      desc: (v) => `5일 ${fmt(v)} — 전체 섹터 대비 Z-score 1.5σ 초과`,
      border: 'border-red-500/30', bg: 'bg-red-950/40',
      textColor: 'text-red-400', badgeBg: 'bg-red-500/15 text-red-300',
    };
    case '저점 반등': return {
      icon: '📈', title: '저점 반등',
      desc: (v) => `5일 ${fmt(v)} — RS < 40 구간에서 모멘텀 개선`,
      border: 'border-blue-500/30', bg: 'bg-blue-950/40',
      textColor: 'text-blue-400', badgeBg: 'bg-blue-500/15 text-blue-300',
    };
    default: return null;
  }
}

function getStrength(value: number): 1 | 2 | 3 {
  const abs = Math.abs(value);
  if (abs >= 0.04) return 3;
  if (abs >= 0.02) return 2;
  return 1;
}

function Stars({ count }: { count: 1 | 2 | 3 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn('text-sm', i <= count ? 'text-yellow-400' : 'text-muted/30')}>★</span>
      ))}
    </div>
  );
}

function CriteriaAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border mt-3 pt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors w-full"
      >
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
        판단 기준 보기
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 text-xs text-muted-foreground/70 leading-relaxed">
          <p><span className="text-green-400">🔥 강세 진입</span> — RS ≥ 60 AND 5일간 RS +10 이상 상승</p>
          <p><span className="text-yellow-400">⚠️ 이탈 경고</span> — 직전 RS ≥ 60이었으나 5일간 -15 이하 급락</p>
          <p><span className="text-red-400">🚨 단기 과열</span> — 5일 수익률이 전체 섹터 평균 대비 +1.5σ 초과</p>
          <p><span className="text-blue-400">📈 저점 반등</span> — RS &lt; 40 구간에서 5일간 RS +5 이상 개선</p>
          <p className="pt-1 border-t border-border/50">RS 점수 = 5일(50%) + 20일(30%) + 60일(20%) 백분위 가중합산</p>
          <p>섹터 수익률 = 해당 섹터 ETF 가격 수익률 기준</p>
        </div>
      )}
    </div>
  );
}

const DISPLAY_ORDER = ['강세 진입', '저점 반등', '이탈 경고', '단기 과열'];

export function RotationSignals({ signals }: Props) {
  if (!signals || signals.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">순환매 신호</h2>
        <p className="text-muted-foreground/60 text-sm text-center py-4">감지된 신호 없음</p>
        <CriteriaAccordion />
      </div>
    );
  }

  const grouped = new Map<string, Signal[]>();
  for (const sig of signals) {
    if (!grouped.has(sig.signal)) grouped.set(sig.signal, []);
    grouped.get(sig.signal)!.push(sig);
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">
        순환매 신호
        <span className="ml-2 text-xs text-muted-foreground/60">({signals.length}건)</span>
      </h2>

      {DISPLAY_ORDER.map(signalType => {
        const list = grouped.get(signalType);
        if (!list || list.length === 0) return null;
        const meta = getSignalMeta(signalType);
        if (!meta) return null;

        return (
          <div key={signalType}>
            <p className="text-xs text-muted-foreground/60 mb-1.5 font-medium">
              {meta.icon} {meta.title}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {list.map((sig, i) => (
                <div key={i} className={cn('rounded-lg border p-3 flex items-start gap-3 transition-colors', meta.border, meta.bg)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('font-bold text-sm truncate', meta.textColor)}>{sig.sector}</span>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0', meta.badgeBg)}>
                        {fmt(sig.value)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground/70 leading-snug">{meta.desc(sig.value)}</p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <Stars count={getStrength(sig.value)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <CriteriaAccordion />
    </div>
  );
}

export function SignalsSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <Skeleton className="h-4 w-28" />
      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
    </div>
  );
}
