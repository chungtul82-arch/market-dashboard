'use client';

import { useEffect, useMemo, useState } from 'react';
import { subscribeScreener } from '@/lib/screenerFirebase';
import type { ScreenerData, ScreenerFilter as FilterState, ScreenerStock } from '@/types/screener';
import { ScreenerFilter } from '@/components/screener/ScreenerFilter';
import { StockCard } from '@/components/screener/StockCard';
import { LeadingSectorBar } from '@/components/screener/LeadingSectorBar';

const DEFAULT_FILTER: FilterState = {
  grade: 'ALL',
  market: 'ALL',
  sector: '',
  pattern: 'ALL',
  sortBy: 'total_score',
};

export default function ScreenerPage() {
  const [data, setData]     = useState<ScreenerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);

  useEffect(() => {
    const unsub = subscribeScreener(d => {
      setData(d);
      setLoading(false);
    });
    return unsub;
  }, []);

  const sectors = useMemo(() => {
    if (!data) return [];
    const s = new Set(data.results.map(r => r.sector_mapped).filter(Boolean));
    return Array.from(s).sort();
  }, [data]);

  const filtered = useMemo((): ScreenerStock[] => {
    if (!data) return [];
    let list = data.results;

    if (filter.grade !== 'ALL')    list = list.filter(r => r.grade === filter.grade);
    if (filter.market !== 'ALL')   list = list.filter(r => r.market === filter.market);
    if (filter.sector)             list = list.filter(r => r.sector_mapped === filter.sector);
    if (filter.pattern !== 'ALL') {
      if (filter.pattern === 'none') list = list.filter(r => !r.buy_pattern);
      else                           list = list.filter(r => r.buy_pattern === filter.pattern);
    }

    return [...list].sort((a, b) => {
      if (filter.sortBy === 'change_pct')       return b.change_pct - a.change_pct;
      if (filter.sortBy === 'volume_ratio')     return b.volume_ratio - a.volume_ratio;
      if (filter.sortBy === 'sector_strength')  return b.sector_strength - a.sector_strength;
      return b.total_score - a.total_score;
    });
  }, [data, filter]);

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold">🎯 주도주 스크리너</h1>
        <p className="text-sm text-muted-foreground mt-0.5">박병창 매매전략 기반 · 스코어링 최대 17점</p>
      </div>

      {/* Sector RS */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">섹터 상대강도</p>
        <LeadingSectorBar />
      </section>

      {/* Stats bar */}
      {data && (
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">검색일</span>
            <span className="font-medium">{data.date}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">스캔</span>
            <span className="font-medium">{data.total_scanned?.toLocaleString()}종목</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400">
              A등급 {data.grade_a_count}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400">
              B등급 {data.grade_b_count}
            </span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto text-muted-foreground text-xs">
            표시: {filtered.length}종목
          </div>
        </div>
      )}

      {/* Filter */}
      <section className="rounded-xl border border-border bg-card p-4">
        <ScreenerFilter filter={filter} sectors={sectors} onChange={setFilter} />
      </section>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 h-64 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !data && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">스크리너 데이터가 없습니다.</p>
          <p className="text-xs text-muted-foreground mt-1">GitHub Actions 스케줄러가 실행되면 자동으로 업데이트됩니다.</p>
        </div>
      )}

      {/* No results */}
      {!loading && data && filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">조건에 맞는 종목이 없습니다.</p>
        </div>
      )}

      {/* Cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(stock => (
            <StockCard key={stock.ticker} stock={stock} />
          ))}
        </div>
      )}
    </main>
  );
}
