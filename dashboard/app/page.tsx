'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { RefreshCw, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { MarketSummary }                       from '@/components/MarketSummary';
import { HeatmapTable, HeatmapSkeleton }       from '@/components/HeatmapTable';
import { RotationSignals, SignalsSkeleton }     from '@/components/RotationSignals';
import { SectorChart, ChartSkeleton }          from '@/components/SectorChart';
import { Skeleton }                             from '@/components/ui/skeleton';
import { subscribeAllPortfolios }               from '@/lib/portfolioFirebase';
import type { Snapshot, Portfolio }             from '@/types';

function fmtKRW(v: number) {
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return v.toLocaleString();
}

function PortfolioWidget({ portfolio }: { portfolio: Portfolio }) {
  const positive = portfolio.totalPnl >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <Link href="/portfolio">
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-[#6366f1]/50 transition-colors cursor-pointer">
        <div>
          <p className="text-xs text-muted-foreground mb-1">내 포트폴리오</p>
          <p className="text-lg font-bold font-num text-foreground">{fmtKRW(portfolio.totalCurrentValue)}원</p>
          <p className={`text-sm font-num font-semibold ${positive ? 'text-up' : 'text-down'}`}>
            {positive ? '+' : ''}{fmtKRW(portfolio.totalPnl)}원 ({positive ? '+' : ''}{portfolio.totalReturnPct.toFixed(2)}%)
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Icon className={`w-6 h-6 ${positive ? 'text-up' : 'text-down'}`} />
          <span className="text-xs text-muted-foreground">{portfolio.holdings.length}개 종목 →</span>
        </div>
      </div>
    </Link>
  );
}

function MarketSummarySkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  const [snapshot,  setSnapshot]  = useState<Snapshot | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [lastSeen,  setLastSeen]  = useState<string>('');
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'reports', 'latest'),
      (snap) => {
        if (snap.exists()) {
          setSnapshot(snap.data() as Snapshot);
          setLastSeen(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
          setError(null);
        } else {
          setError('아직 데이터가 없습니다. 수집기(python main.py)를 먼저 실행해 주세요.');
        }
        setLoading(false);
      },
      (err) => {
        setError(`Firebase 연결 오류: ${err.message}`);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    // 첫 번째 포트폴리오만 메인 위젯에 표시
    return subscribeAllPortfolios((list) => {
      setPortfolio(list.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))[0] ?? null);
    });
  }, []);

  if (error && !snapshot) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="w-12 h-12 text-down" />
        <p className="text-foreground/80 text-center max-w-md">{error}</p>
        <p className="text-muted-foreground text-sm">Firebase 설정 확인 후 새로고침 해주세요.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              한국 섹터 히트맵
            </h1>
            {snapshot && (
              <p className="text-xs text-muted-foreground mt-0.5">기준일: {snapshot.date}</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3" />
            {loading ? '연결 중…' : `${lastSeen} 업데이트`}
          </div>
        </div>

        {/* ── 포트폴리오 미니 위젯 ── */}
        {portfolio && <PortfolioWidget portfolio={portfolio} />}

        {/* ── 시황 요약 (4개 카드) ── */}
        {loading
          ? <MarketSummarySkeleton />
          : <MarketSummary indices={snapshot?.market_indices} />
        }

        {/* ── 히트맵 + 신호 ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2">
            {loading
              ? <HeatmapSkeleton />
              : snapshot && <HeatmapTable sectors={snapshot.sectors} signals={snapshot.signals} />
            }
          </div>
          <div>
            {loading
              ? <SignalsSkeleton />
              : snapshot && <RotationSignals signals={snapshot.signals} />
            }
          </div>
        </div>

        {/* ── 수익률 차트 ── */}
        {loading
          ? <ChartSkeleton />
          : snapshot && <SectorChart sectors={snapshot.sectors} />
        }

        {/* ── 푸터 ── */}
        <p className="text-center text-xs text-muted-foreground/40 pb-4">
          데이터 제공: yfinance · 투자 판단은 본인 책임 · 매일 08:00 KST 자동 업데이트
        </p>
      </div>
    </main>
  );
}
