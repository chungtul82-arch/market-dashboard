'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
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

export function SpotInputPanel({ basketStocks, onSaved }: Props) {
  const { date: initDate, time: initTime } = nowKST();
  const [text,     setText]     = useState('');
  const [date,     setDate]     = useState(initDate);
  const [time,     setTime]     = useState(initTime);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [analysis, setAnalysis] = useState<SpotAnalysis | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // 자동 높이 조절
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = 'auto';
    taRef.current.style.height = `${taRef.current.scrollHeight}px`;
  }, [text]);

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

      // Firebase 저장
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

  return (
    <div className="space-y-4">
      {/* 입력 영역 */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">스팟 시황 입력</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground" />
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground w-20" />
          </div>
        </div>

        <textarea
          ref={taRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="오늘 스팟 시황을 붙여넣으세요..."
          className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none min-h-[120px] focus:outline-none focus:border-[#6366f1]/50"
          rows={5}
        />

        {error && <p className="text-xs text-down">{error}</p>}

        <Button
          className="w-full gap-2"
          onClick={handleAnalyze}
          disabled={loading || !text.trim()}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 분석 중...</>
                   : <><Send className="w-4 h-4" /> 분석하기</>}
        </Button>
      </div>

      {/* 분석 결과 */}
      {analysis && <SpotInsightCard analysis={analysis} />}
    </div>
  );
}
