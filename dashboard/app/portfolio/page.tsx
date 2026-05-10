'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PortfolioSelector }       from '@/components/portfolio/PortfolioSelector';
import { PortfolioSummary }        from '@/components/portfolio/PortfolioSummary';
import { PortfolioTable }          from '@/components/portfolio/PortfolioTable';
import { AllocationChart }         from '@/components/portfolio/AllocationChart';
import { SectorAllocationChart, ThemeAllocationChart } from '@/components/portfolio/SectorAllocationChart';
import { PortfolioJsonInput }      from '@/components/portfolio/PortfolioJsonInput';
import { PerformanceChart }        from '@/components/portfolio/PerformanceChart';
import { PortfolioRecommendation } from '@/components/portfolio/PortfolioRecommendation';
import {
  listPortfolios, subscribePortfolio, updateHolding, createPortfolio, saveHoldings,
} from '@/lib/portfolioFirebase';
import { useExchangeRates } from '@/lib/useExchangeRates';
import type { Portfolio, PortfolioMeta, Holding } from '@/types';

type Tab = '현황' | 'AI추천';

interface BenchmarkPoint { date: string; v: number }
interface Benchmarks { kospi: BenchmarkPoint[] | null; nasdaq100: BenchmarkPoint[] | null }

export default function PortfolioPage() {
  const [portfolioList, setPortfolioList] = useState<PortfolioMeta[]>([]);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [portfolio,     setPortfolio]     = useState<Portfolio | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [showInput,     setShowInput]     = useState(false);
  const [activeTab,     setActiveTab]     = useState<Tab>('현황');

  // 라이브 가격 상태
  const [liveHoldings,      setLiveHoldings]      = useState<Holding[] | null>(null);
  const [benchmarks,        setBenchmarks]         = useState<Benchmarks>({ kospi: null, nasdaq100: null });
  const [pricesFetchingAt,  setPricesFetchingAt]   = useState('');
  const [pricesUpdatedAt,   setPricesUpdatedAt]    = useState('');

  const rates = useExchangeRates();

  useEffect(() => {
    listPortfolios().then(list => {
      setPortfolioList(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
      else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setPortfolio(null);
    setLiveHoldings(null);
    setLoading(true);
    const unsub = subscribePortfolio(selectedId, p => {
      setPortfolio(p);
      setLoading(false);
    });
    return () => unsub();
  }, [selectedId]);

  // 현재가 조회
  const fetchPrices = useCallback(async (holdings: Holding[]) => {
    if (!holdings.length) return;
    setPricesFetchingAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
    try {
      const symbols  = holdings.map(h => h.symbol);
      const markets: Record<string, string> = {};
      holdings.forEach(h => { if (h.market) markets[h.symbol] = h.market; });

      const res = await fetch('/api/portfolio-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols, markets }),
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
          market:        (live.market ?? h.market) as Holding['market'],
          currentPrice:  curPrice,
          currentValue:  curVal,
          investedValue: inv,
          pnl:           curVal - inv,
          returnPct:     inv !== 0 ? ((curVal - inv) / inv) * 100 : 0,
          dailyChange:   (live.changePct / 100) * curPrice * h.quantity,
          dailyChangePct: live.changePct,
        };
      });
      setLiveHoldings(updated);
      setPricesUpdatedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));

      // Firebase에도 최신 가격 저장 (백그라운드)
      if (selectedId) saveHoldings(selectedId, updated).catch(() => {});
    } catch { /* 조용히 실패 */ }
  }, [selectedId]);

  // 포트폴리오 로드 시 가격 자동 조회
  useEffect(() => {
    if (portfolio?.holdings?.length) fetchPrices(portfolio.holdings);
  }, [portfolio]);

  const displayHoldings = liveHoldings ?? portfolio?.holdings ?? [];

  const refreshList = useCallback(async (newId?: string) => {
    const list = await listPortfolios();
    setPortfolioList(list);
    if (newId) setSelectedId(newId);
  }, []);

  async function handleCreateNew() {
    const name = prompt('새 포트폴리오 이름:');
    if (!name?.trim()) return;
    const id = await createPortfolio(name.trim());
    await refreshList(id);
  }

  async function handleUpdateHolding(symbol: string, updates: Partial<Holding>) {
    if (!selectedId) return;
    await updateHolding(selectedId, symbol, updates);
  }

  const totalCurrentValue = displayHoldings.reduce((s, h) => s + h.currentValue, 0);
  const totalInvested     = displayHoldings.reduce((s, h) => s + h.investedValue, 0);
  const totalReturnPct    = totalInvested !== 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;

  const tabCls = (t: Tab) =>
    `text-sm px-4 py-2 font-medium transition-colors border-b-2 ${
      activeTab === t
        ? 'border-[#6366f1] text-[#6366f1]'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

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
            {portfolioList.length === 0 && (
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
            onSaved={id => { refreshList(id); setShowInput(false); }}
            onClose={() => setShowInput(false)}
          />
        )}

        {/* 빈 상태 */}
        {!loading && !portfolio && !showInput && (
          <div className="bg-card rounded-xl border border-border p-12 text-center space-y-4">
            <p className="text-4xl">📂</p>
            <p className="font-medium text-foreground">포트폴리오가 비어있습니다</p>
            <p className="text-muted-foreground text-sm">JSON으로 보유 종목을 입력해 주세요</p>
            <Button onClick={() => setShowInput(true)} className="gap-2">
              <FileJson className="w-4 h-4" /> 종목 입력
            </Button>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {/* 포트폴리오 본문 */}
        {!loading && portfolio && (
          <>
            <PortfolioSummary holdings={displayHoldings} />

            {/* 탭 */}
            <div className="flex border-b border-border gap-0">
              <button className={tabCls('현황')}  onClick={() => setActiveTab('현황')}>📊 현황</button>
              <button className={tabCls('AI추천')} onClick={() => setActiveTab('AI추천')}>🎯 AI 추천</button>
            </div>

            {/* 현황 탭 */}
            {activeTab === '현황' && (
              <div className="space-y-5">
                {/* 벤치마크 비교 */}
                <PerformanceChart
                  kospi={benchmarks.kospi}
                  nasdaq100={benchmarks.nasdaq100}
                  totalReturnPct={totalReturnPct}
                />

                {/* 배분 차트 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <AllocationChart       holdings={displayHoldings} />
                  <SectorAllocationChart holdings={displayHoldings} />
                  <ThemeAllocationChart  holdings={displayHoldings} />
                </div>

                {/* 보유 종목 테이블 */}
                <PortfolioTable
                  holdings={displayHoldings}
                  onUpdateHolding={handleUpdateHolding}
                  onRefreshPrices={() => fetchPrices(portfolio.holdings)}
                  pricesUpdatedAt={pricesUpdatedAt || pricesFetchingAt ? `${pricesUpdatedAt || '조회 중'}` : undefined}
                />
              </div>
            )}

            {/* AI 추천 탭 */}
            {activeTab === 'AI추천' && (
              <PortfolioRecommendation
                holdings={displayHoldings}
                rates={rates}
              />
            )}
          </>
        )}

        <p className="text-center text-xs text-muted-foreground/40 pb-4">
          가격: Yahoo Finance 실시간 조회 · 벤치마크: KOSPI(^KS11) · NASDAQ100(^NDX)
        </p>
      </div>
    </main>
  );
}
