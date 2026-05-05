'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpotInsightCard } from './SpotInsightCard';
import { saveSpotEntry } from '@/lib/spotFirebase';
import type { BasketStock, SpotAnalysis, SpotEntry } from '@/types/spot';

interface Props {
  basketStocks: BasketStock[];
  onSaved?: (entry: SpotEntry) => void;
}

function nowKST() {
  const d = new Date(Date.now() + 9 * 3600_000);
  return {
    date: d.toISOString().slice(0, 10),
    time: d.toISOString().slice(11, 16),
  };
}

const JSON_PLACEHOLDER = `{
  "insight": "핵심 인사이트",
  "market_judge": "상승",
  "confidence": 4,
  "target_index": "코스피 2,680~2,720",
  "strong_sectors": ["AI·반도체", "방산"],
  "weak_sectors": ["2차전지"],
  "basket_actions": [
    {"name": "삼성전자", "symbol": "005930", "action": "비중확대", "reason": "외국인 5일 연속 순매수"}
  ],
  "risks": ["미 연준 발언 예정"],
  "cross_check": [
    {"sector": "AI·반도체", "match": true, "detail": "외국인 수급 + ETF RS 상위"}
  ]
}`;

export function SpotInputPanel({ basketStocks, onSaved }: Props) {
  const { date: initDate, time: initTime } = nowKST();
  const [mode,     setMode]     = useState<'text' | 'json'>('text');
  const [text,     setText]     = useState('');
  const [jsonText, setJsonText] = useState('');
  const [date,     setDate]     = useState(initDate);
  const [time,     setTime]     = useState(initTime);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [analysis, setAnalysis] = useState<SpotAnalysis | null>(null);
  const taRef     = useRef<HTMLTextAreaElement>(null);
  const jsonTaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = 'auto';
    taRef.current.style.height = `${taRef.current.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    if (!jsonTaRef.current) return;
    jsonTaRef.current.style.height = 'auto';
    jsonTaRef.current.style.height = `${jsonTaRef.current.scrollHeight}px`;
  }, [jsonText]);

  function switchMode(m: 'text' | 'json') {
    setMode(m);
    setError('');
    setAnalysis(null);
  }

  async function handleAnalyze() {
    if (!text.trim()) return;
    setLoading(true); setError(''); setAnalysis(null);
    try {
      const res = await fetch('/api/analyze-spot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, basketStocks }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? '분석 실패');
      setAnalysis(data.analysis);
      const entry: SpotEntry = {
        date, time, content: text,
        analysis: data.analysis,
        createdAt: new Date().toISOString(),
      };
      const saved = await saveSpotEntry(entry);
      onSaved?.(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  }

  async function handleJsonSave() {
    if (!jsonText.trim()) return;
    setError(''); setAnalysis(null);
    try {
      const parsed: SpotAnalysis = JSON.parse(jsonText);
      if (!parsed.market_judge || !parsed.insight) {
        throw new Error('insight, market_judge 필드가 필요합니다.');
      }
      setAnalysis(parsed);
      const entry: SpotEntry = {
        date, time, content: '[JSON 직접 입력]',
        analysis: parsed,
        createdAt: new Date().toISOString(),
      };
      const saved = await saveSpotEntry(entry);
      onSaved?.(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON 파싱 오류');
    }
  }

  const dateTimeRow = (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground" />
      <input type="time" value={time} onChange={e => setTime(e.target.value)}
        className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground w-20" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        {/* Header + tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5">
            <button
              onClick={() => switchMode('text')}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                mode === 'text'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              ✏️ 원문 입력
            </button>
            <button
              onClick={() => switchMode('json')}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                mode === 'json'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code className="w-3 h-3 inline mr-1" />
              JSON 직접 입력
            </button>
          </div>
          {dateTimeRow}
        </div>

        {/* 원문 입력 모드 */}
        {mode === 'text' && (
          <>
            <textarea
              ref={taRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="오늘 스팟 시황을 붙여넣으세요..."
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none min-h-[120px] focus:outline-none focus:border-[#6366f1]/50"
              rows={5}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button className="w-full gap-2" onClick={handleAnalyze} disabled={loading || !text.trim()}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 분석 중...</>
                       : <><Send className="w-4 h-4" /> 분석하기 (Claude API)</>}
            </Button>
          </>
        )}

        {/* JSON 직접 입력 모드 */}
        {mode === 'json' && (
          <>
            <p className="text-xs text-muted-foreground">
              claude.ai에서 분석한 JSON을 그대로 붙여넣으세요. API 호출 없이 저장됩니다.
            </p>
            <textarea
              ref={jsonTaRef}
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              placeholder={JSON_PLACEHOLDER}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 resize-none min-h-[200px] focus:outline-none focus:border-[#6366f1]/50 font-mono"
              rows={10}
              spellCheck={false}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button className="w-full gap-2" onClick={handleJsonSave} disabled={!jsonText.trim()}>
              <Code className="w-4 h-4" /> 저장하기
            </Button>
          </>
        )}
      </div>

      {analysis && <SpotInsightCard analysis={analysis} />}
    </div>
  );
}
