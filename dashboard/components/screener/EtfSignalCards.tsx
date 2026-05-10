'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface IndexData {
  name: string; etf_name: string; etf_ticker: string;
  ret_5d: number; ret_20d: number; ret_60d: number;
  rel_5d: number; rel_20d: number;
  signal: 'buy' | 'watch' | 'hold' | 'exit';
}

const SIGNAL_ORDER = { buy: 0, watch: 1, hold: 2, exit: 3 };

const SIGNAL_META = {
  buy:   { label: '편입검토', badge: 'bg-green-500/15 text-green-400 border-green-500/30', bar: 'bg-green-500',  left: 'border-l-4 border-green-500' },
  watch: { label: '모니터링', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', bar: 'bg-yellow-500', left: 'border-l-4 border-yellow-500' },
  hold:  { label: '유지',     badge: 'bg-muted text-muted-foreground border-border',           bar: 'bg-muted-foreground/40', left: 'border-l-4 border-muted-foreground/30' },
  exit:  { label: '이탈경고', badge: 'bg-red-500/15 text-red-400 border-red-500/30',           bar: 'bg-red-500',   left: 'border-l-4 border-red-500' },
};

function pct(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`; }

function buildRationale(idx: IndexData): string {
  const parts: string[] = [];
  if (idx.rel_20d >= 3) parts.push(`코스피 대비 20일 ${pct(idx.rel_20d)} 아웃퍼폼`);
  else if (idx.rel_20d >= 1) parts.push(`코스피 대비 20일 ${pct(idx.rel_20d)} 상회`);
  else if (idx.rel_20d <= -3) parts.push(`코스피 대비 20일 ${pct(idx.rel_20d)} 언더퍼폼`);
  if (idx.ret_5d > idx.ret_20d / 4 && idx.ret_5d > 0) parts.push('단기 모멘텀 가속');
  if (idx.ret_20d > 0 && idx.ret_60d > 0) parts.push('중단기 상승 추세');
  else if (idx.ret_20d < 0 && idx.ret_60d < 0) parts.push('중단기 하락 추세 지속');
  return parts.join(', ') || '추세 관찰 중';
}

function PctCell({ v, bold }: { v: number; bold?: boolean }) {
  return (
    <span className={cn('font-num', v >= 0 ? 'text-up' : 'text-down', bold && 'font-bold')}>
      {pct(v)}
    </span>
  );
}

function SignalCard({ idx }: { idx: IndexData }) {
  const meta  = SIGNAL_META[idx.signal] ?? SIGNAL_META.hold;
  const etfId = idx.etf_ticker.replace('.KS', '');

  return (
    <div className={cn('bg-card rounded-xl border border-border p-4 space-y-3', meta.left)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <span className={cn('text-xs px-2 py-0.5 rounded-full border font-semibold', meta.badge)}>
          {meta.label}
        </span>
        <span className="text-sm font-semibold text-foreground">{idx.name}</span>
      </div>

      {/* ETF */}
      {idx.etf_name && (
        <p className="text-xs text-muted-foreground">
          추종 ETF: <span className="text-foreground font-medium">{idx.etf_name}</span>
          {etfId && <span className="ml-1 text-muted-foreground/60">({etfId})</span>}
        </p>
      )}

      {/* 수익률 그리드 */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: '5일',  v: idx.ret_5d  },
          { label: '20일', v: idx.ret_20d },
          { label: '60일', v: idx.ret_60d },
          { label: '코스피\n대비20일', v: idx.rel_20d, bold: true },
        ].map(({ label, v, bold }) => (
          <div key={label} className="bg-muted/40 rounded-lg py-1.5">
            <p className="text-[10px] text-muted-foreground/70 leading-tight whitespace-pre-line">{label}</p>
            <PctCell v={v} bold={bold} />
          </div>
        ))}
      </div>

      {/* 근거 */}
      <p className="text-xs text-muted-foreground/80 italic leading-relaxed">
        {buildRationale(idx)}
      </p>
    </div>
  );
}

export function EtfSignalCards() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'index-trends', 'latest'))
      .then(snap => {
        if (snap.exists()) setIndices(snap.data().indices ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-44 rounded-xl bg-muted/30 animate-pulse" />)}
      </div>
    );
  }

  // ETF 매핑이 있는 인덱스만, 신호 우선순위 정렬
  const cards = [...indices]
    .filter(idx => idx.etf_name)
    .sort((a, b) => (SIGNAL_ORDER[a.signal] ?? 2) - (SIGNAL_ORDER[b.signal] ?? 2));

  if (!cards.length) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">ETF 신호 데이터가 없습니다.</p>
      </div>
    );
  }

  const buys   = cards.filter(c => c.signal === 'buy');
  const exits  = cards.filter(c => c.signal === 'exit');

  return (
    <div className="space-y-3">
      {/* 요약 */}
      <div className="flex flex-wrap gap-2 text-xs">
        {buys.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
            ✅ 편입검토 {buys.length}개: {buys.map(c => c.name).join(', ')}
          </span>
        )}
        {exits.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
            ⚠️ 이탈경고 {exits.length}개: {exits.map(c => c.name).join(', ')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {cards.map(idx => <SignalCard key={idx.name} idx={idx} />)}
      </div>
    </div>
  );
}
