'use client';

import { useEffect, useState, useCallback } from 'react';
import { Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PortfolioSelector }       from '@/components/portfolio/PortfolioSelector';
import { PortfolioSummary }        from '@/components/portfolio/PortfolioSummary';
import { PortfolioTable }          from '@/components/portfolio/PortfolioTable';
import { AllocationChart }         from '@/components/portfolio/AllocationChart';
import { SectorAllocationChart }   from '@/components/portfolio/SectorAllocationChart';
import { PortfolioUpload }         from '@/components/portfolio/PortfolioUpload';
import {
  listPortfolios, subscribePortfolio, updateHolding, createPortfolio,
} from '@/lib/portfolioFirebase';
import type { Portfolio, PortfolioMeta, Holding } from '@/types';

export default function PortfolioPage() {
  const [portfolioList, setPortfolioList] = useState<PortfolioMeta[]>([]);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [portfolio,     setPortfolio]     = useState<Portfolio | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [showUpload,    setShowUpload]    = useState(false);

  // 포트폴리오 목록 로드
  useEffect(() => {
    listPortfolios().then(list => {
      setPortfolioList(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
      else setLoading(false);
    });
  }, []);

  // 선택된 포트폴리오 구독 — 전환 시 이전 데이터 즉시 초기화
  useEffect(() => {
    if (!selectedId) return;
    setPortfolio(null);   // 이전 포트폴리오 즉시 지우기
    setLoading(true);
    const unsub = subscribePortfolio(selectedId, p => {
      setPortfolio(p);
      setLoading(false);
    });
    return () => unsub();
  }, [selectedId]);

  // 목록 새로고침 (업로드 후)
  const refreshList = useCallback(async (newSelectedId?: string) => {
    const list = await listPortfolios();
    setPortfolioList(list);
    if (newSelectedId) setSelectedId(newSelectedId);
  }, []);

  async function handleCreateNew() {
    const name = prompt('새 포트폴리오 이름을 입력하세요:');
    if (!name?.trim()) return;
    const id = await createPortfolio(name.trim());
    await refreshList(id);
  }

  async function handleUpdateHolding(symbol: string, updates: Partial<Holding>) {
    if (!selectedId) return;
    await updateHolding(selectedId, symbol, updates);
    await refreshList();
  }

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
                onSelect={id => setSelectedId(id)}
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

        {/* 업로드 패널 */}
        {showUpload && (
          <PortfolioUpload
            portfolios={portfolioList}
            onSaved={id => { refreshList(id); setShowUpload(false); }}
            onClose={() => setShowUpload(false)}
          />
        )}

        {/* 데이터 없음 */}
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

        {/* 로딩 */}
        {loading && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Skeleton className="h-80 rounded-xl" />
              <Skeleton className="h-80 rounded-xl" />
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {/* 포트폴리오 데이터 */}
        {!loading && portfolio && (
          <>
            <PortfolioSummary portfolio={portfolio} />

            {/* 차트 2개 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <AllocationChart       holdings={portfolio.holdings} />
              <SectorAllocationChart holdings={portfolio.holdings} />
            </div>

            {/* 종목 테이블 */}
            <PortfolioTable
              holdings={portfolio.holdings}
              onUpdateHolding={handleUpdateHolding}
            />
          </>
        )}

        <p className="text-center text-xs text-muted-foreground/40 pb-4">
          가격은 GitHub Actions가 매일 08:00 자동 업데이트
        </p>
      </div>
    </main>
  );
}
