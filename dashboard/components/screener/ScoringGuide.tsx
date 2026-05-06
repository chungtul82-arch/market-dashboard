'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ScoringGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>📋 스코어링 기준 &amp; 등급 정의</span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          {/* 등급 */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">등급 기준 (최대 17점)</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
                <span className="font-bold text-emerald-400">A등급 (10점 이상)</span>
                <p className="text-muted-foreground mt-0.5">강력관심 — 즉시 검토 대상</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 px-3 py-2">
                <span className="font-bold text-blue-400">B등급 (7~9점)</span>
                <p className="text-muted-foreground mt-0.5">관심 — 추가 확인 후 판단</p>
              </div>
            </div>
          </div>

          {/* 그룹별 점수 */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">그룹별 점수</p>
            <div className="space-y-2 text-xs">
              <div className="flex gap-3 items-start">
                <span className="w-20 shrink-0 font-bold text-violet-400">A 추세 (6점)</span>
                <div className="text-muted-foreground">
                  <p>MA 정배열 (5&gt;20&gt;60일): +3점 / 단기정배열 (5&gt;20일): +1점</p>
                  <p>52주신고가 근접 &amp; 거래량 증가: +3점 / 근접만: +1점 / 80% 이상: +1점</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-20 shrink-0 font-bold text-blue-400">B 타이밍 (3점)</span>
                <div className="text-muted-foreground space-y-0.5">
                  <p><span className="text-blue-300">B1 눌림 (+2)</span> — 5일선 위, 당일 -1~0%, 5일선 3% 이내, 거래량 감소</p>
                  <p><span className="text-green-300">B2 양봉 (+3)</span> — 단기정배열, 당일 양봉, 거래량 증가, 전일 거래량 감소</p>
                  <p><span className="text-orange-300">B3 반등 (+3)</span> — 최근 5일 20일선 이탈 후 오늘 회복, 거래량 1.5배+</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-20 shrink-0 font-bold text-emerald-400">C 수급 (4점)</span>
                <p className="text-muted-foreground">외국인 3일+ 순매수 +2 / 1일+ +1 &nbsp;·&nbsp; 기관 3일+ 순매수 +2 / 1일+ +1<br/><span className="text-yellow-500/70">※ 현재 pykrx API 이슈로 임시 비활성 (항상 0점)</span></p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-20 shrink-0 font-bold text-amber-400">D 섹터 (±2)</span>
                <p className="text-muted-foreground">섹터 RS ≥70: +2점 &nbsp;·&nbsp; RS 40~69: 0점 &nbsp;·&nbsp; RS &lt;40: -1점</p>
              </div>
            </div>
          </div>

          {/* 기타 */}
          <div className="text-xs text-muted-foreground/60 border-t border-border pt-2">
            <p>가격 기준 &gt;1,000원 · 일평균 거래대금 기준 10억원+ · 스팩/ETF/리츠 제외</p>
            <p>유니버스: KOSPI+KOSDAQ 전종목 (FinanceDataReader) · 가격데이터: yfinance</p>
          </div>
        </div>
      )}
    </div>
  );
}
