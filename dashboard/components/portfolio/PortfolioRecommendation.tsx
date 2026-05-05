'use client';

import { useEffect, useState, useCallback } from 'react';
import { Copy, Check, Code, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { saveRecommendation, subscribeRecommendation } from '@/lib/recommendationFirebase';
import { SYMBOL_TO_SECTOR } from '@/lib/sectorConstituents';
import { toKRW } from '@/lib/useExchangeRates';
import type { Holding } from '@/types';
import type { ExchangeRates } from '@/lib/useExchangeRates';
import type { Recommendation, SectorAllocation, AllocationDirection } from '@/types/recommendation';

interface Props {
  holdings: Holding[];
  rates: ExchangeRates;
}

const PHASE_COLOR: Record<string, string> = {
  '초기상승': 'bg-emerald-500/15 text-emerald-400',
  '상승':     'bg-green-500/15 text-green-400',
  '고점경계': 'bg-yellow-500/15 text-yellow-400',
  '하락':     'bg-red-500/15 text-red-400',
  '바닥':     'bg-orange-500/15 text-orange-400',
  '회복':     'bg-blue-500/15 text-blue-400',
};

const DIR_COLOR: Record<AllocationDirection, string> = {
  '확대': 'text-emerald-400',
  '신규': 'text-blue-400',
  '유지': 'text-muted-foreground',
  '축소': 'text-yellow-400',
  '제외': 'text-red-400',
};

const DIR_ARROW: Record<AllocationDirection, string> = {
  '확대': '↑', '신규': '★', '유지': '→', '축소': '↓', '제외': '✕',
};

const JSON_PLACEHOLDER = `{
  "date": "2026-05-06",
  "market_phase": "초기상승",
  "confidence": 4,
  "rationale": "외국인 수급 반도체 중심 유입, 금리 안정",
  "sector_allocation": [
    {"sector": "AI·반도체", "weight": 35, "direction": "확대", "reason": "RS 1위 + 외국인 매수"},
    {"sector": "현금", "weight": 20, "direction": "신규", "reason": "리스크 헷지"}
  ],
  "stock_picks": [
    {"name": "삼성전자", "symbol": "005930", "sector": "AI·반도체", "action": "매수", "reason": "52주 신고가 근접"}
  ],
  "risks": ["미 연준 발언", "환율 변동성"]
}`;

function buildPrompt(
  holdings: Holding[],
  rates: ExchangeRates,
  sectors: Record<string, { rs_score: number; return_5d: number }>,
  marketIndices: Record<string, { value: number; change_pct: number; label?: string }>,
  screenerTop: { name: string; ticker: string; grade: string; total_score: number; sector_mapped: string; buy_pattern: string | null }[],
): string {
  // 현재 포트폴리오 섹터 배분
  const sectorMap = new Map<string, number>();
  const total = holdings.reduce((s, h) => s + toKRW(h.currentValue, h.currency, rates), 0);
  holdings.forEach(h => {
    const sec = SYMBOL_TO_SECTOR[h.symbol] || h.sector || '기타';
    sectorMap.set(sec, (sectorMap.get(sec) ?? 0) + toKRW(h.currentValue, h.currency, rates));
  });
  const portfolioAlloc = Array.from(sectorMap.entries())
    .map(([s, v]) => `  - ${s}: ${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%`)
    .sort()
    .join('\n');

  // 섹터 RS 상위/하위
  const sectorList = Object.entries(sectors)
    .map(([name, d]) => ({ name, rs: d.rs_score, ret5: d.return_5d }))
    .sort((a, b) => b.rs - a.rs);
  const topSectors = sectorList.slice(0, 6)
    .map((s, i) => `  ${i + 1}. ${s.name}  RS ${s.rs.toFixed(0)}  5일 ${(s.ret5 * 100).toFixed(1)}%`)
    .join('\n');
  const botSectors = sectorList.slice(-4)
    .map((s, i) => `  ${sectorList.length - 3 + i}. ${s.name}  RS ${s.rs.toFixed(0)}  5일 ${(s.ret5 * 100).toFixed(1)}%`)
    .join('\n');

  // 매크로 지표
  const vix = marketIndices['vix'];
  const usd = marketIndices['usd_krw'];
  const kospi = marketIndices['kospi'];
  const macroLines = [
    kospi ? `  - 코스피 전일 변동: ${(kospi.change_pct * 100).toFixed(2)}%` : '',
    vix   ? `  - VIX: ${vix.value.toFixed(1)} (${vix.label ?? ''})` : '',
    usd   ? `  - USD/KRW: ${usd.value.toFixed(0)}원` : '',
  ].filter(Boolean).join('\n');

  // 스크리너 상위종목
  const screenerLines = screenerTop.slice(0, 8)
    .map(s => `  - ${s.name}(${s.ticker}): ${s.grade}등급 ${s.total_score}점, 섹터:${s.sector_mapped}${s.buy_pattern ? ', 패턴:' + s.buy_pattern : ''}`)
    .join('\n');

  return `현재 시장 데이터를 분석하고 최적 포트폴리오를 추천해줘.

[매크로 지표]
${macroLines || '  - 데이터 없음'}

[섹터 RS 순위 — 상위]
${topSectors || '  - 데이터 없음'}

[섹터 RS 순위 — 하위]
${botSectors || '  - 데이터 없음'}

[주도주 스크리너 상위종목]
${screenerLines || '  - 데이터 없음'}

[현재 포트폴리오 섹터 배분]
${portfolioAlloc || '  - 데이터 없음'}

---
위 데이터를 종합해서 현재 시장 국면과 최적 포트폴리오를 추천해줘.
합계 100% (현금 포함). 아래 JSON 형식으로만 출력해줘:

{
  "date": "오늘날짜(YYYY-MM-DD)",
  "market_phase": "초기상승|상승|고점경계|하락|바닥|회복 중 하나",
  "confidence": 1~5 정수,
  "rationale": "판단 근거 1~2문장",
  "sector_allocation": [
    {"sector": "섹터명", "weight": 비중정수, "direction": "확대|신규|유지|축소|제외 중 하나", "reason": "근거"}
  ],
  "stock_picks": [
    {"name": "종목명", "symbol": "티커", "sector": "섹터명", "action": "매수|홀딩|매도 중 하나", "reason": "근거"}
  ],
  "risks": ["리스크 항목"]
}`;
}

function GapBar({ current, recommended }: { current: number; recommended: number }) {
  const diff = recommended - current;
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-16 text-right text-muted-foreground">{current.toFixed(0)}%</div>
      <div className="flex-1 relative h-4 bg-muted/40 rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-muted/80 rounded-full" style={{ width: `${Math.min(current, 100)}%` }} />
        <div
          className={`absolute inset-y-0 rounded-full opacity-70 ${diff >= 0 ? 'bg-emerald-500' : 'bg-red-400'}`}
          style={diff >= 0
            ? { left: `${Math.min(current, 100)}%`, width: `${Math.min(diff, 100 - current)}%` }
            : { left: `${Math.max(0, current + diff)}%`, width: `${Math.min(-diff, current)}%` }
          }
        />
      </div>
      <div className={`w-16 font-medium ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
        {recommended.toFixed(0)}% {diff !== 0 && `(${diff > 0 ? '+' : ''}${diff.toFixed(0)})`}
      </div>
    </div>
  );
}

function RecommendationResult({ rec, holdings, rates }: { rec: Recommendation; holdings: Holding[]; rates: ExchangeRates }) {
  const sectorMap = new Map<string, number>();
  const total = holdings.reduce((s, h) => s + toKRW(h.currentValue, h.currency, rates), 0);
  holdings.forEach(h => {
    const sec = SYMBOL_TO_SECTOR[h.symbol] || h.sector || '기타';
    sectorMap.set(sec, (sectorMap.get(sec) ?? 0) + toKRW(h.currentValue, h.currency, rates));
  });

  return (
    <div className="space-y-5">
      {/* 국면 헤더 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${PHASE_COLOR[rec.market_phase] ?? 'bg-muted text-muted-foreground'}`}>
          📍 {rec.market_phase}
        </span>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map(i => (
            <span key={i} className={i <= rec.confidence ? 'text-yellow-400' : 'text-muted/30'}>★</span>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{rec.date}</span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{rec.rationale}</p>

      {/* 섹터 배분 vs 현재 */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">섹터 배분 비교</p>
        <div className="space-y-2">
          {rec.sector_allocation.map(alloc => {
            const cur = total > 0 ? ((sectorMap.get(alloc.sector) ?? 0) / total * 100) : 0;
            return (
              <div key={alloc.sector} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium w-4 ${DIR_COLOR[alloc.direction]}`}>{DIR_ARROW[alloc.direction]}</span>
                  <span className="text-sm font-medium text-foreground flex-1">{alloc.sector}</span>
                  <span className="text-xs text-muted-foreground/60 max-w-[140px] truncate text-right">{alloc.reason}</span>
                </div>
                <GapBar current={cur} recommended={alloc.weight} />
              </div>
            );
          })}
        </div>
      </div>

      {/* 추천 종목 */}
      {rec.stock_picks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">추천 종목</p>
          <div className="space-y-2">
            {rec.stock_picks.map(pick => (
              <div key={pick.symbol || pick.name} className="flex items-start gap-3 rounded-lg bg-muted/30 px-3 py-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${
                  pick.action === '매수' ? 'bg-emerald-500/15 text-emerald-400' :
                  pick.action === '매도' ? 'bg-red-500/15 text-red-400' :
                  'bg-muted text-muted-foreground'
                }`}>{pick.action}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{pick.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{pick.sector}</span>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{pick.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 리스크 */}
      {rec.risks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">리스크 요인</p>
          <ul className="space-y-1">
            {rec.risks.map((r, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                <span className="text-red-400/60">•</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PortfolioRecommendation({ holdings, rates }: Props) {
  const [tab,         setTab]         = useState<'prompt' | 'json' | 'result'>('prompt');
  const [prompt,      setPrompt]      = useState('');
  const [jsonText,    setJsonText]    = useState('');
  const [rec,         setRec]         = useState<Recommendation | null>(null);
  const [copied,      setCopied]      = useState(false);
  const [error,       setError]       = useState('');
  const [loadingData, setLoadingData] = useState(true);

  const loadMarketData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [reportSnap, screenerSnap] = await Promise.all([
        getDoc(doc(db, 'reports', 'latest')),
        getDoc(doc(db, 'screener', 'latest')),
      ]);

      const sectors       = reportSnap.exists() ? (reportSnap.data()?.sectors ?? {}) : {};
      const marketIndices = reportSnap.exists() ? (reportSnap.data()?.market_indices ?? {}) : {};
      const screenerTop   = screenerSnap.exists()
        ? (screenerSnap.data()?.results ?? []).slice(0, 8).map((r: Record<string, unknown>) => ({
            name: r.name as string, ticker: r.ticker as string,
            grade: r.grade as string, total_score: r.total_score as number,
            sector_mapped: r.sector_mapped as string, buy_pattern: r.buy_pattern as string | null,
          }))
        : [];

      setPrompt(buildPrompt(holdings, rates, sectors, marketIndices, screenerTop));
    } catch {
      setPrompt('데이터 로딩 실패. 새로고침 해주세요.');
    } finally {
      setLoadingData(false);
    }
  }, [holdings, rates]);

  useEffect(() => { loadMarketData(); }, [loadMarketData]);

  useEffect(() => {
    const unsub = subscribeRecommendation(r => { setRec(r); if (r) setTab('result'); });
    return unsub;
  }, []);

  function copyPrompt() {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    setError('');
    try {
      const parsed: Recommendation = JSON.parse(jsonText);
      if (!parsed.market_phase || !parsed.sector_allocation) throw new Error('market_phase, sector_allocation 필드가 필요합니다.');
      await saveRecommendation(parsed);
      setRec(parsed);
      setTab('result');
      setJsonText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON 파싱 오류');
    }
  }

  const tabCls = (t: typeof tab) =>
    `text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
      tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      {/* 헤더 + 탭 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold">🎯 AI 포트폴리오 추천</h2>
          <p className="text-xs text-muted-foreground">현재 시장 데이터 → claude.ai 분석 → 결과 저장</p>
        </div>
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5">
          <button className={tabCls('prompt')} onClick={() => setTab('prompt')}>프롬프트 생성</button>
          <button className={tabCls('json')}   onClick={() => setTab('json')}>
            <Code className="w-3 h-3 inline mr-1" />JSON 입력
          </button>
          {rec && <button className={tabCls('result')} onClick={() => setTab('result')}>최신 추천</button>}
        </div>
      </div>

      {/* 프롬프트 생성 탭 */}
      {tab === 'prompt' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">아래 프롬프트를 복사해서 claude.ai에 붙여넣으세요.</p>
            <div className="flex gap-2">
              <button onClick={loadMarketData} className="text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              </button>
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={copyPrompt}>
                {copied ? <><Check className="w-3 h-3" />복사됨</> : <><Copy className="w-3 h-3" />복사</>}
              </Button>
            </div>
          </div>
          <textarea
            readOnly
            value={loadingData ? '데이터 로딩 중...' : prompt}
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-xs text-muted-foreground font-mono resize-none min-h-[280px] focus:outline-none"
            rows={14}
          />
          <p className="text-xs text-muted-foreground/60">
            복사 → claude.ai 붙여넣기 → JSON 출력 → "JSON 입력" 탭에 붙여넣기
          </p>
        </div>
      )}

      {/* JSON 입력 탭 */}
      {tab === 'json' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">claude.ai에서 받은 JSON을 붙여넣고 저장하세요.</p>
          <textarea
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            placeholder={JSON_PLACEHOLDER}
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 font-mono resize-none min-h-[240px] focus:outline-none focus:border-[#6366f1]/50"
            rows={12}
            spellCheck={false}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button className="w-full gap-2" onClick={handleSave} disabled={!jsonText.trim()}>
            <Code className="w-4 h-4" /> 저장하기
          </Button>
        </div>
      )}

      {/* 추천 결과 탭 */}
      {tab === 'result' && rec && (
        <RecommendationResult rec={rec} holdings={holdings} rates={rates} />
      )}
    </div>
  );
}
