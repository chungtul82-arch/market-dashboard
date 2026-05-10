'use client';

import { useEffect, useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GuruComparison }  from '@/components/compare/GuruComparison';
import { MoneyFlowPanel }  from '@/components/compare/MoneyFlowPanel';
import { NewsImpactPanel } from '@/components/compare/NewsImpactPanel';
import { AIDiagnosis }     from '@/components/compare/AIDiagnosis';
import type { DiagnosisResult } from '@/components/compare/AIDiagnosis';

interface GuruPortfolio {
  guru: string; report_date: string; total_value_usd: number;
  sector_weights: Record<string, number>;
  holdings: { ticker: string; name: string; value_usd: number; weight_pct: number; sector: string; change_type: string }[];
}

export default function ComparePage() {
  const [guruPortfolios, setGuruPortfolios] = useState<Record<string, GuruPortfolio> | null>(null);
  const [moneyFlow,      setMoneyFlow]      = useState<Record<string, unknown> | null>(null);
  const [articles,       setArticles]       = useState<unknown[]>([]);
  const [diagnosis,      setDiagnosis]      = useState<DiagnosisResult | null>(null);
  const [mySectorWeights, setMySectorWeights] = useState<Record<string, number>>({});
  const [lastUpdated,    setLastUpdated]    = useState('');
  const [loading,        setLoading]        = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [guruSnap, flowSnap, newsSnap, diagSnap, portfolioSnap] = await Promise.all([
        getDoc(doc(db, 'guru-portfolios', 'latest')),
        getDoc(doc(db, 'money-flow',      'latest')),
        getDoc(doc(db, 'portfolio-news',  'latest')),
        getDoc(doc(db, 'ai-diagnosis',    'latest')),
        getDocs(collection(db, 'portfolios')),
      ]);

      if (guruSnap.exists())  setGuruPortfolios(guruSnap.data() as Record<string, GuruPortfolio>);
      if (flowSnap.exists())  setMoneyFlow(flowSnap.data());
      if (newsSnap.exists())  setArticles((newsSnap.data() as { articles?: unknown[] })?.articles ?? []);

      if (diagSnap.exists()) {
        const d = diagSnap.data() as DiagnosisResult;
        setDiagnosis(d);
        if (d.date && d.time) setLastUpdated(`${d.date} ${d.time}`);
      }

      // 내 포트폴리오 섹터 가중치 계산
      if (!portfolioSnap.empty) {
        const portfolio = portfolioSnap.docs[0].data();
        const holdings  = (portfolio.holdings ?? []) as { sector?: string; currentValue?: number }[];
        const totalVal  = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0);
        const weights: Record<string, number> = {};
        holdings.forEach(h => {
          const sec = h.sector || '기타';
          weights[sec] = (weights[sec] ?? 0) + (totalVal > 0 ? (h.currentValue ?? 0) / totalVal * 100 : 0);
        });
        setMySectorWeights(weights);
      }
    } catch (e) {
      console.error('[compare] load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function handleDiagnose(result: DiagnosisResult) {
    setDiagnosis(result);
    const d = result.date ?? '';
    const t = result.time ?? '';
    setLastUpdated(d && t ? `${d} ${t}` : new Date().toLocaleString('ko-KR'));
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* 헤더 */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">포트폴리오 비교 분석</h1>
            <p className="text-sm text-muted-foreground mt-1">
              거장 13F · 글로벌 ETF 수급 · 뉴스 · AI 종합 진단 | 매주 금요일 자동 업데이트
            </p>
          </div>
          <button
            onClick={loadData}
            className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
          >
            ↻ 새로고침
          </button>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[300, 240, 200, 300].map((h, i) => (
              <Skeleton key={i} style={{ height: h }} className="rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* 섹션 1: AI 진단 (최상단 - 가장 중요) */}
            <AIDiagnosis
              guruPortfolios={guruPortfolios}
              moneyFlow={moneyFlow}
              articles={articles}
              onDiagnose={handleDiagnose}
              diagnosis={diagnosis}
              lastUpdated={lastUpdated}
            />

            {/* 섹션 2: 거장 포트폴리오 */}
            <GuruComparison
              guruPortfolios={guruPortfolios}
              mySectorWeights={mySectorWeights}
            />

            {/* 섹션 3: 글로벌 돈흐름 */}
            <MoneyFlowPanel
              moneyFlow={moneyFlow as { date?: string; us_flows?: Parameters<typeof MoneyFlowPanel>[0]['moneyFlow'] extends { us_flows?: infer T } ? T : never } | null}
              mySectorWeights={mySectorWeights}
            />

            {/* 섹션 4: 뉴스 */}
            <NewsImpactPanel
              articles={articles as Parameters<typeof NewsImpactPanel>[0]['articles']}
              mySectorWeights={mySectorWeights}
            />
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground/40 pb-4">
          거장 데이터: SEC EDGAR 13F · ETF 수급: yfinance · 뉴스: Google News RSS
        </p>
      </div>
    </main>
  );
}
