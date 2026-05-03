'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { Signal } from '@/types';
import { fmt, cn } from '@/lib/utils';

interface Props {
  signals: Signal[];
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

function getStrength(signal: Signal['signal'], value: number): 1 | 2 | 3 {
  if (signal === '단기 과열') return 3;
  const abs = Math.abs(value);
  if (abs >= 0.04) return 3;
  if (abs >= 0.02) return 2;
  return 1;
}

type SignalMeta = {
  icon: string;
  title: string;
  desc: (v: number) => string;
  border: string;
  bg: string;
  textColor: string;
  badgeBg: string;
};

const SIGNAL_META: Record<Signal['signal'], SignalMeta> = {
  '강세 진입': {
    icon: '🔥',
    title: '강세 진입',
    desc: (v) => `5일 수익률 ${fmt(v)} — 상위권 편입`,
    border: 'border-green-500/30',
    bg: 'bg-green-950/40',
    textColor: 'text-green-400',
    badgeBg: 'bg-green-500/15 text-green-300',
  },
  '이탈 경고': {
    icon: '⚠️',
    title: '이탈 경고',
    desc: (v) => `5일 ${fmt(v)} — 중기 강세 대비 단기 이탈`,
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-950/40',
    textColor: 'text-yellow-400',
    badgeBg: 'bg-yellow-500/15 text-yellow-300',
  },
  '단기 과열': {
    icon: '🚨',
    title: '단기 과열',
    desc: (v) => `5일 ${fmt(v)} — +5% 초과 급등 주의`,
    border: 'border-red-500/30',
    bg: 'bg-red-950/40',
    textColor: 'text-red-400',
    badgeBg: 'bg-red-500/15 text-red-300',
  },
};

export function RotationSignals({ signals }: Props) {
  if (!signals || signals.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">순환매 신호</h2>
        <p className="text-muted-foreground/60 text-sm text-center py-4">감지된 신호 없음</p>
      </div>
    );
  }

  const grouped = { '강세 진입': [] as Signal[], '이탈 경고': [] as Signal[], '단기 과열': [] as Signal[] };
  signals.forEach((sig) => { (grouped[sig.signal] ??= []).push(sig); });

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">
        순환매 신호
        <span className="ml-2 text-xs text-muted-foreground/60">({signals.length}건)</span>
      </h2>

      {(Object.entries(grouped) as [Signal['signal'], Signal[]][]).map(([type, list]) => {
        if (list.length === 0) return null;
        const meta = SIGNAL_META[type];
        return (
          <div key={type}>
            <p className="text-xs text-muted-foreground/60 mb-1.5 font-medium">{meta.icon} {meta.title}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {list.map((sig, i) => {
                const strength = getStrength(sig.signal, sig.value);
                return (
                  <div
                    key={i}
                    className={cn(
                      'rounded-lg border p-3 flex items-start gap-3 transition-colors',
                      meta.border, meta.bg,
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('font-bold text-sm truncate', meta.textColor)}>
                          {sig.sector}
                        </span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0', meta.badgeBg)}>
                          {fmt(sig.value)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/70 leading-snug">{meta.desc(sig.value)}</p>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      <Stars count={strength} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SignalsSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <Skeleton className="h-4 w-28" />
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}
