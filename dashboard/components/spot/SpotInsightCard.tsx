'use client';

import type { SpotAnalysis, SpotAction } from '@/types/spot';
import { cn } from '@/lib/utils';

interface Props { analysis: SpotAnalysis }

const JUDGE_ICON: Record<string, string> = { 상승: '📈', 하락: '📉', 보합: '➡️', 횡보: '↔️' };
const JUDGE_COLOR: Record<string, string> = {
  상승: 'text-up', 하락: 'text-down', 보합: 'text-neutral', 횡보: 'text-neutral',
};

const ACTION_STYLE: Record<SpotAction, { bg: string; text: string; label: string }> = {
  '매수':    { bg: 'bg-green-500/20',  text: 'text-green-400',  label: '매수'    },
  '비중확대': { bg: 'bg-green-500/15',  text: 'text-green-400',  label: '비중확대' },
  '홀딩':    { bg: 'bg-blue-500/15',   text: 'text-blue-400',   label: '홀딩'    },
  '비중축소': { bg: 'bg-red-500/15',    text: 'text-red-400',    label: '비중축소' },
  '매도':    { bg: 'bg-red-500/20',    text: 'text-red-400',    label: '매도'    },
};

function Dots({ count }: { count: number }) {
  return (
    <span className="font-num text-sm tracking-wider">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i <= count ? 'text-[#6366f1]' : 'text-muted/30'}>●</span>
      ))}
    </span>
  );
}

export function SpotInsightCard({ analysis }: Props) {
  const {
    insight, market_judge, confidence, target_index,
    strong_sectors, weak_sectors, basket_actions, risks, cross_check,
  } = analysis;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden text-sm">
      {/* 핵심 인사이트 */}
      <div className="bg-[#6366f1]/10 border-b border-border px-4 py-3">
        <p className="text-xs text-[#6366f1] font-semibold mb-1">💡 핵심 인사이트</p>
        <p className="text-foreground leading-relaxed">{insight}</p>
      </div>

      {/* 대세판단 / 확신도 / 목표지수 */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">대세판단</p>
          <p className={cn('text-lg font-bold', JUDGE_COLOR[market_judge])}>
            {JUDGE_ICON[market_judge]} {market_judge}
          </p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">확신도</p>
          <Dots count={confidence} />
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">목표지수</p>
          <p className="font-medium text-foreground text-xs">{target_index || '—'}</p>
        </div>
      </div>

      {/* 강세 / 약세 섹터 */}
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground mb-2">✅ 강세 섹터</p>
          <div className="flex flex-wrap gap-1">
            {strong_sectors.map(s => (
              <span key={s} className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">{s}</span>
            ))}
            {strong_sectors.length === 0 && <span className="text-muted-foreground/50 text-xs">없음</span>}
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground mb-2">⚠️ 약세/주의 섹터</p>
          <div className="flex flex-wrap gap-1">
            {weak_sectors.map(s => (
              <span key={s} className="text-xs bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded-full">{s}</span>
            ))}
            {weak_sectors.length === 0 && <span className="text-muted-foreground/50 text-xs">없음</span>}
          </div>
        </div>
      </div>

      {/* 바스켓 종목 액션 */}
      {basket_actions.length > 0 && (
        <div className="border-b border-border">
          <p className="text-xs text-muted-foreground px-4 pt-3 mb-2">바스켓 종목별 액션</p>
          <div className="divide-y divide-border/50">
            {basket_actions.map((a, i) => {
              const style = ACTION_STYLE[a.action] ?? ACTION_STYLE['홀딩'];
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2">
                  <span className="font-medium text-foreground w-24 shrink-0 truncate">{a.name}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold shrink-0', style.bg, style.text)}>
                    {style.label}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">{a.reason}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 리스크 */}
      {risks.length > 0 && (
        <div className="border-b border-border px-4 py-3">
          <p className="text-xs text-muted-foreground mb-2">⚠️ 리스크 & 주요 일정</p>
          <ul className="space-y-1">
            {risks.map((r, i) => (
              <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                <span className="text-yellow-400 shrink-0">•</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 교차검증 */}
      {cross_check.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground mb-2">전문가 의견 vs 데이터 교차검증</p>
          <div className="space-y-1">
            {cross_check.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={c.match ? 'text-up' : 'text-yellow-400'}>{c.match ? '✅' : '⚠️'}</span>
                <span className="text-foreground/80">
                  <span className="font-medium">{c.sector}</span> — {c.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
