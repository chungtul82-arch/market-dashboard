'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { ChevronDown } from 'lucide-react';
import { db } from '@/lib/firebase';
import { GuruComparison }  from '@/components/compare/GuruComparison';
import { MoneyFlowPanel }  from '@/components/compare/MoneyFlowPanel';
import { NewsImpactPanel } from '@/components/compare/NewsImpactPanel';
import { AIDiagnosis }     from '@/components/compare/AIDiagnosis';
import type { DiagnosisResult } from '@/components/compare/AIDiagnosis';
import type { Portfolio } from '@/types';
import { cn } from '@/lib/utils';

interface GuruPortfolio {
  guru: string; report_date: string; total_value_usd: number;
  sector_weights: Record<string, number>;
  holdings: { ticker: string; name: string; value_usd: number; weight_pct: number; sector: string; change_type: string }[];
}

export default function ComparePage() {
  // 주간 수집 데이터 (Firebase)
  const [guruPortfolios, setGuruPortfolios] = useState<Record<string, GuruPortfolio> | null>(null);
  const [moneyFlow,      setMoneyFlow]      = useState<Record<string, unknown> | null>(null);
  const [articles,       setArticles]       = useState<unknown[]>([]);
  const [diagnosis,      setDiagnosis]      = useState<DiagnosisResult | null>(null);
  const [lastUpdated,    setLastUpdated]    = useState('');
  const [dataLoading,    setDataLoading]    = useState(true);

  // 내 포트폴리오 목록 (실시간)
  const [portfolioList, setPortfolioList]   = useState<Portfolio[]>([]);
  const [selectedId,    setSelectedId]      = useState<string | null>(null);
  const [selectorOpen,  setSelectorOpen]    = useState(false);

  // 선택된 포트폴리오
  const selectedPortfolio = useMemo(
    () => portfolioList.find(p => p.id === selectedId) ?? null,
    [portfolioList, selectedId],
  );

  // 섹터 가중치 계산
  const mySectorWeights = useMemo(() => {
    const holdings = selectedPortfolio?.holdings ?? [];
    const totalVal  = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0);
    const weights: Record<string, number> = {};
    holdings.forEach(h => {
      const sec = h.sector || '기타';
      weights[sec] = (weights[sec] ?? 0) + (totalVal > 0 ? (h.currentValue ?? 0) / totalVal * 100 : 0);
    });
    return weights;
  }, [selectedPortfolio]);

  // 포트폴리오 목록 실시간 구독
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'portfolios'), snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Portfolio))
        .filter(p => p.name);
      setPortfolioList(list);
      setSelectedId(prev => {
        if (prev && list.find(p => p.id === prev)) return prev;
        return list.length > 0 ? (list[0].id ?? null) : null;
      });
    });
    return unsub;
  }, []);

  // 주간 수집 데이터 로드
  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [guruSnap, flowSnap, newsSnap, diagSnap] = await Promise.all([
        getDoc(doc(db, 'guru-portfolios', 'latest')),
        getDoc(doc(db, 'money-flow',      'latest')),
        getDoc(doc(db, 'portfolio-news',  'latest')),
        getDoc(doc(db, 'ai-diagnosis',    'latest')),
      ]);

      if (guruSnap.exists())  setGuruPortfolios(guruSnap.data() as Record<string, GuruPortfolio>);
      if (flowSnap.exists())  setMoneyFlow(flowSnap.data());
      if (newsSnap.exists())  setArticles((newsSnap.data() as { articles?: unknown[] })?.articles ?? []);

      if (diagSnap.exists()) {
        const d = diagSnap.data() as DiagnosisResult;
        setDiagnosis(d);
        if (d.date && d.time) setLastUpdated(`${d.date} ${d.time}`);
      }
    } catch (e) {
      console.error('[compare] load error:', e);
    } finally {
      setDataLoading(false);
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
      <div className="max-w-7xl mx-auto space-y-6">

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

        {/* 포트폴리오 선택 */}
        {portfolioList.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-5 text-sm text-muted-foreground">
            포트폴리오 탭에서 먼저 보유 종목을 입력해 주세요. 입력 후 여기서 거장 포트폴리오와 비교할 수 있습니다.
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border p-4 flex flex-wrap items-center gap-4">
            <span className="text-sm text-muted-foreground font-medium">비교 포트폴리오</span>

            <div className="relative">
              <button
                className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-sm hover:border-[#6366f1]/50 transition-colors"
                onClick={() => setSelectorOpen(o => !o)}
              >
                <span className="font-medium">{selectedPortfolio?.name ?? '선택'}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>

              {selectorOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSelectorOpen(false)} />
                  <div className="absolute top-full mt-1 left-0 z-20 bg-card border border-border rounded-xl shadow-xl min-w-[200px]">
                    {portfolioList.map(p => (
                      <div
                        key={p.id}
                        className={cn(
                          'px-3 py-2.5 cursor-pointer hover:bg-muted/50 text-sm transition-colors',
                          p.id === selectedId && 'bg-[#6366f1]/10 font-semibold',
                        )}
                        onClick={() => { setSelectedId(p.id ?? null); setSelectorOpen(false); }}
                      >
                        {p.name}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {selectedPortfolio && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>{selectedPortfolio.holdings?.length ?? 0}개 종목</span>
                {selectedPortfolio.totalCurrentValue > 0 && (
                  <span>평가액 {(selectedPortfolio.totalCurrentValue / 100_000_000).toFixed(1)}억원</span>
                )}
                {Object.keys(mySectorWeights).length > 0 && (
                  <span>
                    주요섹터: {Object.entries(mySectorWeights)
                      .sort(([,a],[,b]) => b - a)
                      .slice(0, 3)
                      .map(([s, w]) => `${s} ${w.toFixed(0)}%`)
                      .join(' · ')}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* 메인 컨텐츠 */}
        {dataLoading ? (
          <div className="space-y-6">
            {[300, 240, 200, 300].map((h, i) => (
              <Skeleton key={i} style={{ height: h }} className="rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* AI 진단 */}
            <AIDiagnosis
              guruPortfolios={guruPortfolios}
              moneyFlow={moneyFlow}
              articles={articles}
              myPortfolio={selectedPortfolio}
              onDiagnose={handleDiagnose}
              diagnosis={diagnosis}
              lastUpdated={lastUpdated}
            />

            {/* 거장 포트폴리오 비교 */}
            <GuruComparison
              guruPortfolios={guruPortfolios}
              mySectorWeights={mySectorWeights}
            />

            {/* 글로벌 돈흐름 */}
            <MoneyFlowPanel
              moneyFlow={moneyFlow as { date?: string; us_flows?: Parameters<typeof MoneyFlowPanel>[0]['moneyFlow'] extends { us_flows?: infer T } ? T : never } | null}
              mySectorWeights={mySectorWeights}
            />

            {/* 뉴스 영향 */}
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
