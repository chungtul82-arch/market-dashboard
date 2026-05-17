'use client';

import { useState } from 'react';
import { Loader2, Zap, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Portfolio } from '@/types';

interface GuruComp {
  guru: string; alignment_score: number; common_themes: string[];
  my_excess: string[]; guru_excess: string[]; comment: string;
}
interface MoneyFlowAlignment {
  score: number; aligned_sectors: string[]; misaligned_sectors: string[]; comment: string;
}
interface NewsImpact {
  theme: string; sentiment: string; impact_level: number; key_news: string; action: string;
}
interface RebalancingSuggestion {
  action: string; theme: string; reason: string; priority: 'high' | 'medium' | 'low';
}
interface RiskAlert {
  type: string; description: string; severity: 'high' | 'medium' | 'low';
}
export interface DiagnosisResult {
  overall_grade: 'A' | 'B' | 'C' | 'D';
  overall_comment: string;
  guru_comparison: GuruComp[];
  money_flow_alignment: MoneyFlowAlignment;
  news_impact: NewsImpact[];
  rebalancing_suggestions: RebalancingSuggestion[];
  risk_alerts: RiskAlert[];
  strengths: string[];
  action_items: string[];
  one_line_summary: string;
  date?: string; time?: string; created_at?: string;
}

interface Props {
  guruPortfolios: Record<string, unknown> | null;
  moneyFlow:      Record<string, unknown> | null;
  articles:       unknown[];
  myPortfolio:    Portfolio | null;
  onDiagnose:     (result: DiagnosisResult) => void;
  diagnosis:      DiagnosisResult | null;
  lastUpdated:    string;
}

const GRADE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  A: { bg: 'bg-green-500/15',  text: 'text-green-400',  label: '매우 양호' },
  B: { bg: 'bg-blue-500/15',   text: 'text-blue-400',   label: '양호'      },
  C: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: '보통'      },
  D: { bg: 'bg-red-500/15',    text: 'text-red-400',    label: '점검 필요' },
};

const PRIORITY_ICON: Record<string, string> = {
  high: '🔴', medium: '🟡', low: '🟢',
};
const SEVERITY_ICON: Record<string, string> = {
  high: '🚨', medium: '⚠️', low: '💬',
};
const ACTION_COLOR: Record<string, string> = {
  '확대': 'text-green-400', '신규검토': 'text-blue-400',
  '유지': 'text-muted-foreground', '축소': 'text-yellow-400', '제외': 'text-red-400',
};

const TIMEOUT_MS = 55_000; // 55초 (Vercel Pro 60초 제한)

export function AIDiagnosis({ guruPortfolios, moneyFlow, articles, myPortfolio, onDiagnose, diagnosis, lastUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [step,    setStep]    = useState('');
  const [error,   setError]   = useState('');

  async function runDiagnosis() {
    if (!myPortfolio) {
      setError('비교할 포트폴리오를 먼저 선택해 주세요.');
      return;
    }
    setLoading(true); setError('');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      setStep('Claude AI 분석 중... (최대 60초)');
      const res = await fetch('/api/ai-diagnosis', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  controller.signal,
        body: JSON.stringify({
          myPortfolio,
          guruPortfolios,
          moneyFlow,
          news: articles,
        }),
      });

      if (!res.ok) {
        let msg = `오류 ${res.status}`;
        try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }

      const { diagnosis: result } = await res.json();

      // 결과를 Firebase에 저장 (클라이언트)
      const kst  = new Date(Date.now() + 9 * 3600_000);
      const date = kst.toISOString().slice(0, 10);
      const time = kst.toISOString().slice(11, 16);
      const saved = { ...result, date, time, created_at: kst.toISOString() };
      await Promise.all([
        setDoc(doc(db, 'ai-diagnosis', 'latest'), saved),
        setDoc(doc(db, 'ai-diagnosis', `${date}_${time.replace(':', '-')}`), saved),
      ]);

      onDiagnose(saved);
      setStep('');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setError('시간 초과 (55초). Vercel Pro 플랜이 필요하거나, GitHub Actions 주간 자동 진단을 이용해 주세요.');
      } else {
        setError(e instanceof Error ? e.message : '진단 실패');
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  const grade  = diagnosis?.overall_grade;
  const gStyle = grade ? (GRADE_STYLE[grade] ?? GRADE_STYLE.B) : null;

  return (
    <section className="space-y-5">
      {/* 진단 트리거 */}
      <div className="bg-card rounded-xl border border-border p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">AI 종합 진단</h2>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> 마지막 진단: {lastUpdated}
            </p>
          )}
          {loading && step && (
            <p className="text-xs text-[#6366f1] mt-0.5">{step}</p>
          )}
          {error && (
            <p className="text-xs text-red-400 mt-0.5">{error}</p>
          )}
        </div>
        <Button disabled={loading} onClick={runDiagnosis} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {loading ? '분석 중...' : '🔍 AI 종합 진단 실행'}
        </Button>
      </div>

      {/* 진단 결과 */}
      {diagnosis && gStyle && (
        <div className="space-y-4">
          {/* 종합 등급 */}
          <div className={cn('rounded-xl border p-5 text-center space-y-2', gStyle.bg, 'border-border')}>
            <p className="text-xs text-muted-foreground">포트폴리오 종합 등급</p>
            <p className={cn('text-6xl font-black font-num', gStyle.text)}>{grade}</p>
            <p className={cn('text-sm font-semibold', gStyle.text)}>{gStyle.label}</p>
            <p className="text-sm text-foreground max-w-lg mx-auto">{diagnosis.overall_comment}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">💡 {diagnosis.one_line_summary}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 거장 일치도 */}
            {diagnosis.guru_comparison?.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                <p className="text-sm font-semibold">거장 일치도</p>
                {diagnosis.guru_comparison.map(g => (
                  <div key={g.guru} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{g.guru.split(' ')[0]}</span>
                      <span className={cn('font-num font-bold',
                        g.alignment_score >= 80 ? 'text-green-400'
                        : g.alignment_score >= 60 ? 'text-yellow-400' : 'text-muted-foreground')}>
                        {g.alignment_score}점
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className={cn('h-1.5 rounded-full',
                        g.alignment_score >= 80 ? 'bg-green-500'
                        : g.alignment_score >= 60 ? 'bg-yellow-500' : 'bg-muted-foreground/40')}
                        style={{ width: `${g.alignment_score}%` }} />
                    </div>
                    {g.comment && <p className="text-xs text-muted-foreground/70">{g.comment}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* 수급 일치도 */}
            {diagnosis.money_flow_alignment && (
              <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                <p className="text-sm font-semibold">돈흐름 일치도</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">수급 일치도</span>
                    <span className={cn('font-num font-bold',
                      (diagnosis.money_flow_alignment.score ?? 0) >= 70 ? 'text-green-400' : 'text-yellow-400')}>
                      {diagnosis.money_flow_alignment.score}점
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={cn('h-2 rounded-full',
                      (diagnosis.money_flow_alignment.score ?? 0) >= 70 ? 'bg-green-500' : 'bg-yellow-500')}
                      style={{ width: `${diagnosis.money_flow_alignment.score}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground/70">{diagnosis.money_flow_alignment.comment}</p>
                </div>
                {diagnosis.money_flow_alignment.aligned_sectors?.length > 0 && (
                  <p className="text-xs text-green-400">
                    ✅ 일치: {diagnosis.money_flow_alignment.aligned_sectors.join(', ')}
                  </p>
                )}
                {diagnosis.money_flow_alignment.misaligned_sectors?.length > 0 && (
                  <p className="text-xs text-yellow-400">
                    ⚠️ 역행: {diagnosis.money_flow_alignment.misaligned_sectors.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 리밸런싱 제안 */}
          {diagnosis.rebalancing_suggestions?.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <p className="text-sm font-semibold">리밸런싱 제안</p>
              <div className="space-y-2">
                {diagnosis.rebalancing_suggestions.map((s, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 bg-muted/40 rounded-lg">
                    <span className="shrink-0 mt-0.5">{PRIORITY_ICON[s.priority] ?? '🔵'}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-semibold', ACTION_COLOR[s.action] ?? 'text-foreground')}>
                          [{s.action}]
                        </span>
                        <span className="text-sm text-foreground">{s.theme}</span>
                        <span className={cn('text-xs px-1.5 py-0 rounded border border-border',
                          s.priority === 'high' ? 'text-red-400' : s.priority === 'medium' ? 'text-yellow-400' : 'text-muted-foreground')}>
                          {s.priority}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 리스크 알림 */}
            {diagnosis.risk_alerts?.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-4 space-y-2">
                <p className="text-sm font-semibold">리스크 알림</p>
                {diagnosis.risk_alerts.map((r, i) => (
                  <div key={i} className="flex gap-2 text-sm items-start">
                    <span className="shrink-0">{SEVERITY_ICON[r.severity] ?? '💬'}</span>
                    <p className="text-muted-foreground">{r.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 강점 + 액션 아이템 */}
            <div className="space-y-3">
              {diagnosis.strengths?.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4 space-y-2">
                  <p className="text-sm font-semibold">포트폴리오 강점</p>
                  {diagnosis.strengths.map((s, i) => (
                    <p key={i} className="text-sm text-green-400">✅ {s}</p>
                  ))}
                </div>
              )}
              {diagnosis.action_items?.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4 space-y-2">
                  <p className="text-sm font-semibold">즉시 액션 아이템</p>
                  {diagnosis.action_items.map((a, i) => (
                    <p key={i} className="text-sm text-foreground">{i + 1}. {a}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {diagnosis.date && (
            <p className="text-xs text-center text-muted-foreground/40">
              진단 일시: {diagnosis.date} {diagnosis.time}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
