'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PortfolioSelector }       from '@/components/portfolio/PortfolioSelector';
import { PortfolioSummary }        from '@/components/portfolio/PortfolioSummary';
import { PortfolioTable }          from '@/components/portfolio/PortfolioTable';
import { AllocationChart }         from '@/components/portfolio/AllocationChart';
import { SectorAllocationChart }   from '@/components/portfolio/SectorAllocationChart';
import { PortfolioJsonInput }      from '@/components/portfolio/PortfolioJsonInput';
import { PerformanceChart }        from '@/components/portfolio/PerformanceChart';
import {
  subscribeAllPortfolios, subscribePortfolio,
  updateHolding, createPortfolio, deleteHoldings,
} from '@/lib/portfolioFirebase';
import type { Portfolio, PortfolioMeta, Holding } from '@/types';

interface BenchmarkPoint { date: string; v: number }
interface Benchmarks { kospi: BenchmarkPoint[] | null; nasdaq100: BenchmarkPoint[] | null }

export default function PortfolioPage() {
  const [portfolioList, setPortfolioList] = useState<PortfolioMeta[]>([]);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [portfolio,     setPortfolio]     = useState<Portfolio | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [showInput,     setShowInput]     = useState(false);

  const [liveHoldings,    setLiveHoldings]    = useState<Holding[] | null>(null);
  const [benchmarks,      setBenchmarks]      = useState<Benchmarks>({ kospi: null, nasdaq100: null });
  const [pricesUpdatedAt, setPricesUpdatedAt] = useState('');

  // ── 포트폴리오 목록: 실시간 구독 ─────────────────────────────────
  useEffect(() => {
    const unsub = subscribeAllPortfolios(list => {
      const sorted: PortfolioMeta[] = list
        .filter(p => p.id && p.name)   // 이름 없는 고아 문서 제외
        .map(p => ({
          id:                p.id!,
          name:              p.name,
          createdAt:         p.createdAt || '',
          totalCurrentValue: p.totalCurrentValue || 0,
          totalReturnPct:    p.totalReturnPct || 0,
        }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      setPortfolioList(sorted);
      setLoading(false);

      // 현재 선택이 없거나 삭제된 경우 첫 번째로 자동 전환
      setSelectedId(prev => {
        if (sorted.length === 0) return null;
        if (!prev || !sorted.find(m => m.id === prev)) return sorted[0].id;
        return prev;
      });
    });
    return unsub;
  }, []);

  // ── 선택된 포트폴리오: 실시간 구독 ──────────────────────────────
  useEffect(() => {
    setPortfolio(null);
    setLiveHoldings(null);
    if (!selectedId) return;
    const unsub = subscribePortfolio(selectedId, p => {
      setPortfolio(p);
    });
    return () => unsub();
  }, [selectedId]);

  // ── 현재가 조회 ───────────────────────────────────────────────
  const fetchPrices = useCallback(async (holdings: Holding[]) => {
    if (!holdings.length) return;
    try {
      const symbols  = holdings.map(h => h.symbol);
      const markets: Record<string, string> = {};
      holdings.forEach(h => { if (h.market) markets[h.symbol] = h.market; });

      const res = await fetch('/api/portfolio-prices', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ symbols, markets }),
      });
      if (!res.ok) return;
      const { prices, benchmarks: bm } = await res.json();

      setBenchmarks({ kospi: bm?.kospi ?? null, nasdaq100: bm?.nasdaq100 ?? null });

      const updated: Holding[] = holdings.map(h => {
        const live = prices[h.symbol];
        if (!live) return h;
        const curPrice = live.price;
        const curVal   = curPrice * h.quantity;
        const inv      = h.avgPurchasePrice * h.quantity;
        return {
          ...h,
          market:         (live.market ?? h.market) as Holding['market'],
          name:           live.name && live.name !== h.symbol ? live.name : (h.name || h.symbol),
          currentPrice:   curPrice,
          currentValue:   curVal,
          investedValue:  inv,
          pnl:            curVal - inv,
          returnPct:      inv !== 0 ? ((curVal - inv) / inv) * 100 : 0,
          dailyChange:    (live.changePct / 100) * curPrice * h.quantity,
          dailyChangePct: live.changePct,
        };
      });
      setLiveHoldings(updated);
      setPricesUpdatedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
    } catch { /* silent */ }
  }, [selectedId]);

  // 포트폴리오 구독 변경 → 가격 자동 조회
  useEffect(() => {
    if (portfolio?.holdings?.length) fetchPrices(portfolio.holdings);
  }, [portfolio]);

  const displayHoldings = liveHoldings ?? portfolio?.holdings ?? [];

  // ── 핸들러 ─────────────────────────────────────────────────
  async function handleCreateNew() {
    const name = prompt('새 포트폴리오 이름:');
    if (!name?.trim()) return;
    const id = await createPortfolio(name.trim());
    setSelectedId(id);
  }

  async function handleUpdateHolding(symbol: string, updates: Partial<Holding>) {
    if (!selectedId) return;
    await updateHolding(selectedId, symbol, updates);
    // subscribePortfolio가 자동으로 portfolio 업데이트 → fetchPrices 트리거
  }

  async function handleBulkDelete(symbols: string[]) {
    if (!selectedId) return;
    setLiveHoldings(null);
    await deleteHoldings(selectedId, symbols);
  }

  // JSON 입력 후 새 포트폴리오 선택
  const onJsonSaved = useCallback((id: string) => {
    setSelectedId(id);
    setShowInput(false);
  }, []);

  const totalCurrentValue = displayHoldings.reduce((s, h) => s + h.currentValue, 0);
  const totalInvested     = displayHoldings.reduce((s, h) => s + h.investedValue, 0);
  const totalReturnPct    = totalInvested !== 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* 헤더 */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold">내 포트폴리오</h1>
            {portfolioList.length > 0 && (
              <PortfolioSelector
                portfolios={portfolioList}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onCreateNew={handleCreateNew}
              />
            )}
          </div>
          <div className="flex gap-2">
            {portfolioList.length === 0 && !loading && (
              <Button size="sm" className="gap-2" onClick={handleCreateNew}>
                <Plus className="w-4 h-4" /> 새 포트폴리오
              </Button>
            )}
            <Button
              size="sm"
              variant={showInput ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => setShowInput(p => !p)}
            >
              <FileJson className="w-4 h-4" /> 종목 입력
            </Button>
          </div>
        </div>

        {/* JSON 입력 패널 */}
        {showInput && (
          <PortfolioJsonInput
            portfolios={portfolioList}
            onSaved={onJsonSaved}
            onClose={() => setShowInput(false)}
          />
        )}

        {/* 빈 상태 */}
        {!loading && portfolioList.length === 0 && !showInput && (
          <div className="bg-card rounded-xl border border-border p-12 text-center space-y-4">
            <p className="text-4xl">📂</p>
            <p className="font-medium">포트폴리오가 비어있습니다</p>
            <p className="text-muted-foreground text-sm">JSON으로 보유 종목을 입력해 주세요</p>
            <Button onClick={() => setShowInput(true)} className="gap-2">
              <FileJson className="w-4 h-4" /> 종목 입력
            </Button>
          </div>
        )}

        {/* 로딩 — 목록은 왔지만 선택 포트폴리오 아직 미도착 */}
        {loading && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {/* 포트폴리오 본문 */}
        {portfolio && (
          <div className="space-y-5">
            <PortfolioSummary holdings={displayHoldings} />

            <PerformanceChart
              kospi={benchmarks.kospi}
              nasdaq100={benchmarks.nasdaq100}
              totalReturnPct={totalReturnPct}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AllocationChart       holdings={displayHoldings} />
              <SectorAllocationChart holdings={displayHoldings} />
            </div>

            <PortfolioTable
              holdings={displayHoldings}
              onUpdateHolding={handleUpdateHolding}
              onBulkDelete={handleBulkDelete}
              onRefreshPrices={() => portfolio?.holdings && fetchPrices(portfolio.holdings)}
              pricesUpdatedAt={pricesUpdatedAt || undefined}
            />
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground/40 pb-4">
          가격: Yahoo Finance 실시간 · 벤치마크: KOSPI(^KS11) · NASDAQ100(^NDX)
        </p>
      </div>
    </main>
  );
}
