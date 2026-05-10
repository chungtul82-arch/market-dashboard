'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parsePortfolioJson, PROMPT_TEMPLATE } from '@/lib/portfolioJsonUtils';
import { createPortfolio, saveHoldings } from '@/lib/portfolioFirebase';
import type { Holding, PortfolioMeta } from '@/types';

interface Props {
  portfolios: PortfolioMeta[];
  onSaved:    (id: string) => void;
  onClose:    () => void;
}

type Status = 'idle' | 'fetching' | 'saving' | 'done' | 'error';

export function PortfolioJsonInput({ portfolios, onSaved, onClose }: Props) {
  const [json,       setJson]       = useState('');
  const [targetId,   setTargetId]   = useState<string>(portfolios[0]?.id ?? '__new__');
  const [newName,    setNewName]     = useState('');
  const [status,     setStatus]      = useState<Status>('idle');
  const [errMsg,     setErrMsg]      = useState('');
  const [copied,     setCopied]      = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(PROMPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleApply() {
    if (!json.trim()) return;
    setStatus('fetching');
    setErrMsg('');

    try {
      const { name: parsedName, holdings: rawHoldings } = parsePortfolioJson(json);

      // 현재가 + 종목명 조회
      const symbols  = rawHoldings.map(h => h.symbol);
      const markets: Record<string, string> = {};
      rawHoldings.forEach(h => { if (h.market) markets[h.symbol] = h.market; });

      const priceRes = await fetch('/api/portfolio-prices', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ symbols, markets }),
      });
      const { prices = {} } = priceRes.ok ? await priceRes.json() : {};

      const holdings: Holding[] = rawHoldings.map(h => {
        const live     = prices[h.symbol];
        const curPrice = live?.price || h.avgPurchasePrice;
        const curVal   = curPrice * h.quantity;
        const inv      = h.avgPurchasePrice * h.quantity;
        return {
          ...h,
          name:          live?.name || h.symbol,
          market:        (live?.market ?? h.market) as Holding['market'],
          currentPrice:  curPrice,
          currentValue:  curVal,
          investedValue: inv,
          pnl:           curVal - inv,
          returnPct:     inv !== 0 ? ((curVal - inv) / inv) * 100 : 0,
          dailyChange:   live ? (live.changePct / 100) * curPrice * h.quantity : 0,
          dailyChangePct: live?.changePct ?? 0,
        };
      });

      // 섹터 자동조회
      try {
        const symList = holdings
          .map(h => `${h.symbol}${h.market === 'KOSDAQ' ? '.KQ' : '.KS'}`)
          .join(',');
        const infoRes = await fetch(`/api/stock-info?symbols=${symList}`);
        if (infoRes.ok) {
          const info: Record<string, { name: string; sector: string }> = await infoRes.json();
          holdings.forEach(h => {
            const key = `${h.symbol}${h.market === 'KOSDAQ' ? '.KQ' : '.KS'}`;
            if (info[key]?.sector) h.sector = info[key].sector;
          });
        }
      } catch { /* 섹터 실패는 무시 */ }

      setStatus('saving');
      let id = targetId;
      const finalName = (targetId === '__new__' ? newName.trim() : '') || parsedName;
      if (targetId === '__new__') id = await createPortfolio(finalName);
      await saveHoldings(id, holdings, finalName);

      setStatus('done');
      setTimeout(() => { onSaved(id); onClose(); }, 600);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : '처리 실패');
      setStatus('error');
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">

      {/* 프롬프트 가이드 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">① Claude 프롬프트 복사</p>
          <button
            onClick={copyPrompt}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#6366f1]/20 text-[#a5b4fc] hover:bg-[#6366f1]/30 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '복사됨!' : '프롬프트 복사'}
          </button>
        </div>
        <pre className="text-xs bg-muted/50 border border-border rounded-lg p-3 overflow-auto max-h-44 text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {PROMPT_TEMPLATE}<span className="text-[#6366f1]">[계좌 잔고 붙여넣기]</span>
        </pre>
        <p className="text-xs text-muted-foreground/60">
          위 프롬프트를 복사 → claude.ai에서 계좌 잔고를 붙여넣어 JSON 생성 → 아래에 붙여넣기
        </p>
      </div>

      <hr className="border-border" />

      {/* JSON 입력 */}
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">② JSON 붙여넣기</p>
        <textarea
          className="w-full bg-muted/40 border border-border rounded-lg p-3 text-sm font-mono text-foreground resize-y min-h-[160px] focus:outline-none focus:ring-1 focus:ring-[#6366f1] placeholder:text-muted-foreground/40"
          placeholder={'[\n  {"symbol": "005930", "quantity": 100, "avg_price": 68000},\n  {"symbol": "000660", "quantity": 50,  "avg_price": 175000}\n]'}
          value={json}
          onChange={e => setJson(e.target.value)}
        />
      </div>

      {/* 포트폴리오 선택 */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">저장 위치</p>
          <select
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
          >
            <option value="__new__">+ 새 포트폴리오 생성</option>
            {portfolios.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {targetId === '__new__' && (
          <div className="flex-1 space-y-1">
            <p className="text-xs text-muted-foreground">포트폴리오 이름</p>
            <input
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              placeholder="이름 (생략 시 '내 포트폴리오')"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>
        )}
      </div>

      {errMsg && (
        <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">{errMsg}</p>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>취소</Button>
        <Button
          size="sm"
          disabled={!json.trim() || status === 'fetching' || status === 'saving' || status === 'done'}
          onClick={handleApply}
        >
          {status === 'fetching' ? '가격 조회 중...'
          : status === 'saving'  ? '저장 중...'
          : status === 'done'    ? '완료!'
          : '③ 적용'}
        </Button>
      </div>
    </div>
  );
}
