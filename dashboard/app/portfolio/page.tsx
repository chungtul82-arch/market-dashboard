'use client';

import { useEffect, useState, useCallback } from 'react';
import { Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PortfolioSelector }          from '@/components/portfolio/PortfolioSelector';
import { PortfolioSummary }           from '@/components/portfolio/PortfolioSummary';
import { PortfolioTable }             from '@/components/portfolio/PortfolioTable';
import { AllocationChart }            from '@/components/portfolio/AllocationChart';
import { SectorAllocationChart }      from '@/components/portfolio/SectorAllocationChart';
import { CountryAllocationChart }     from '@/components/portfolio/CountryAllocationChart';
import { CurrencyAllocationChart }    from '@/components/portfolio/CurrencyAllocationChart';
import { PortfolioUpload }            from '@/components/portfolio/PortfolioUpload';
import { PortfolioRecommendation }    from '@/components/portfolio/PortfolioRecommendation';
import {
  listPortfolios, subscribePortfolio, updateHolding, createPortfolio,
} from '@/lib/portfolioFirebase';
import { useExchangeRates } from '@/lib/useExchangeRates';
import type { Portfolio, PortfolioMeta, Holding } from '@/types';

type Tab = '현황' | 'AI추천';

export default function PortfolioPage() {
  const [portfolioList, setPortfolioList] = useState<PortfolioMeta[]>([]);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [portfolio,     setPortfolio]     = useState<Portfolio | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [showUpload,    setShowUpload]    = useState(false);
  const [activeTab,     setActiveTab]     = useState<Tab>('현황');
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
    setLoading(true);
    const unsub = subscribePortfolio(selectedId, p => {
      setPortfolio(p);
      setLoading(false);
    });
    return () => unsub();
  }, [selectedId]);

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
    await refreshList();
  }

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
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowUpload(p => !p)}>
              <Upload className="w-4 h-4" /> CSV 업로드
            </Button>
          </div>
        </div>

        {showUpload && (
          <PortfolioUpload
            portfolios={portfolioList}
            onSaved={id => { refreshList(id); setShowUpload(false); }}
            onClose={() => setShowUpload(false)}
          />
        )}

        {!loading && !portfolio && !showUpload && (
          <div className="bg-card rounded-xl border border-border p-12 text-center space-y-4">
            <p className="text-4xl">📂</p>
            <p className="font-medium text-foreground">포트폴리오가 비어있습니다</p>
            <p className="text-muted-foreground text-sm">Yahoo Finance CSV를 업로드해 주세요</p>
            <Button onClick={() => setShowUpload(true)} className="gap-2">
              <Upload className="w-4 h-4" /> CSV 업로드
            </Button>
          </div>
        )}

        {loading && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {!loading && portfolio && (
          <>
            {/* 요약 카드 */}
            <PortfolioSummary portfolio={portfolio} rates={rates} />

            {/* 탭 */}
            <div className="flex border-b border-border gap-0">
              <button className={tabCls('현황')}  onClick={() => setActiveTab('현황')}>📊 현황</button>
              <button className={tabCls('AI추천')} onClick={() => setActiveTab('AI추천')}>🎯 AI 추천</button>
            </div>

            {/* 현황 탭 */}
            {activeTab === '현황' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <AllocationChart       holdings={portfolio.holdings} rates={rates} />
                  <SectorAllocationChart holdings={portfolio.holdings} rates={rates} />
                  <CountryAllocationChart holdings={portfolio.holdings} rates={rates} />
                  <CurrencyAllocationChart holdings={portfolio.holdings} rates={rates} />
                </div>
                <PortfolioTable
                  holdings={portfolio.holdings}
                  rates={rates}
                  onUpdateHolding={handleUpdateHolding}
                />
              </div>
            )}

            {/* AI 추천 탭 */}
            {activeTab === 'AI추천' && (
              <PortfolioRecommendation
                holdings={portfolio.holdings}
                rates={rates}
              />
            )}
          </>
        )}

        <p className="text-center text-xs text-muted-foreground/40 pb-4">
          환율 기준: reports/latest · 가격 매일 16:00 KST 자동 업데이트
        </p>
      </div>
    </main>
  );
}
