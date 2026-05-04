'use client';

import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PortfolioSummary } from '@/components/portfolio/PortfolioSummary';
import { PortfolioTable }   from '@/components/portfolio/PortfolioTable';
import { AllocationChart }  from '@/components/portfolio/AllocationChart';
import { PortfolioUpload }  from '@/components/portfolio/PortfolioUpload';
import { subscribePortfolio } from '@/lib/portfolioFirebase';
import type { Portfolio } from '@/types';

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    const unsub = subscribePortfolio(p => { setPortfolio(p); setLoading(false); });
    return () => unsub();
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">내 포트폴리오</h1>
            {portfolio?.pricesUpdatedAt && (
              <p className="text-xs text-muted-foreground mt-0.5">
                가격 업데이트: {new Date(portfolio.pricesUpdatedAt).toLocaleString('ko-KR')}
              </p>
            )}
            {portfolio?.uploadedAt && !portfolio?.pricesUpdatedAt && (
              <p className="text-xs text-muted-foreground mt-0.5">
                업로드: {new Date(portfolio.uploadedAt).toLocaleString('ko-KR')}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowUpload(p => !p)}
          >
            <Upload className="w-4 h-4" />
            CSV 업로드
          </Button>
        </div>

        {/* CSV 업로드 영역 */}
        {showUpload && (
          <PortfolioUpload onSaved={() => setShowUpload(false)} />
        )}

        {/* 데이터 없음 */}
        {!loading && !portfolio && !showUpload && (
          <div className="bg-card rounded-xl border border-border p-12 text-center space-y-4">
            <p className="text-4xl">📂</p>
            <p className="text-foreground font-medium">포트폴리오 데이터가 없습니다</p>
            <p className="text-muted-foreground text-sm">
              Yahoo Finance에서 CSV를 내보내서 업로드해 주세요
            </p>
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
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {/* 포트폴리오 데이터 */}
        {!loading && portfolio && (
          <>
            <PortfolioSummary portfolio={portfolio} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-1">
                <AllocationChart holdings={portfolio.holdings} />
              </div>
              <div className="lg:col-span-2">
                <PortfolioTable holdings={portfolio.holdings} />
              </div>
            </div>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground/40 pb-4">
          가격은 GitHub Actions가 매일 08:00 자동 업데이트
        </p>
      </div>
    </main>
  );
}
