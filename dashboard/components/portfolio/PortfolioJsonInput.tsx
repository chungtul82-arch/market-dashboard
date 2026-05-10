'use client';

import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parsePortfolioJson, PROMPT_TEMPLATE } from '@/lib/portfolioJsonUtils';
import { createPortfolio, saveHoldings } from '@/lib/portfolioFirebase';
import type { Holding, PortfolioMeta } from '@/types';

interface Props {
  portfolios:   PortfolioMeta[];
  onSaved:      (id: string) => void;
  onClose:      () => void;
}

type Status = 'idle' | 'fetching' | 'saving' | 'done' | 'error';

export function PortfolioJsonInput({ portfolios, onSaved, onClose }: Props) {
  const [json,        setJson]        = useState('');
  const [targetId,    setTargetId]    = useState<string>('__new__');
  const [newName,     setNewName]     = useState('');
  const [status,      setStatus]      = useState<Status>('idle');
  const [errMsg,      setErrMsg]      = useState('');
  const [copied,      setCopied]      = useState(false);
  const [showPrompt,  setShowPrompt]  = useState(false);

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

      // 섹터 자동조회 (sector 미지정 종목)
      const needSector = rawHoldings.filter(h => !h.sector);
      if (needSector.length > 0) {
        const symList = needSector.map(h => {
          const sfx = h.market === 'KOSDAQ' ? '.KQ' : '.KS';
          return `${h.symbol}${sfx}`;
        }).join(',');
        try {
          const r = await fetch(`/api/stock-info?symbols=${symList}`);
          if (r.ok) {
            const info: Record<string, { name: string; sector: string }> = await r.json();
            rawHoldings.forEach(h => {
              if (h.sector) return;
              const sfx = h.market === 'KOSDAQ' ? '.KQ' : '.KS';
              const key = `${h.symbol}${sfx}`;
              if (info[key]) {
                if (!h.name || h.name === h.symbol) h.name = info[key].name || h.name;
                h.sector = info[key].sector || '';
              }
            });
          }
        } catch { /* 섹터 조회 실패는 무시 */ }
      }

      // 현재가 조회
      setStatus('fetching');
      const markets: Record<string, string> = {};
      rawHoldings.forEach(h => { if (h.market) markets[h.symbol] = h.market; });
      const priceRes = await fetch('/api/portfolio-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: rawHoldings.map(h => h.symbol), markets }),
      });
      const { prices } = priceRes.ok ? await priceRes.json() : { prices: {} };

      // 현재가 반영 및 파생값 계산
      const holdings: Holding[] = rawHoldings.map(h => {
        const live      = prices[h.symbol];
        const curPrice  = live?.price || h.avgPurchasePrice;
        const curVal    = curPrice * h.quantity;
        const inv       = h.avgPurchasePrice * h.quantity;
        return {
          ...h,
          market:       (live?.market ?? h.market) as Holding['market'],
          currentPrice: curPrice,
          currentValue: curVal,
          investedValue: inv,
          pnl:          curVal - inv,
          returnPct:    inv !== 0 ? ((curVal - inv) / inv) * 100 : 0,
          dailyChange:  live ? (live.changePct / 100) * curPrice * h.quantity : 0,
          dailyChangePct: live?.changePct ?? 0,
        };
      });

      // Firebase 저장
      setStatus('saving');
      let id = targetId;
      const finalName = (targetId === '__new__' ? newName.trim() : null) || parsedName;
      if (targetId === '__new__') {
        id = await createPortfolio(finalName);
      }
      await saveHoldings(id, holdings, finalName);

      setStatus('done');
      setTimeout(() => { onSaved(id); onClose(); }, 800);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'JSON 파싱 또는 저장 실패');
      setStatus('error');
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">

      {/* 프롬프트 섹션 */}
      <div>
        <button
          className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-[#6366f1] transition-colors"
          onClick={() => setShowPrompt(p => !p)}
        >
          {showPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Claude 프롬프트 (클릭하여 {showPrompt ? '접기' : '펼치기'})
        </button>
        {showPrompt && (
          <div className="mt-2 relative">
            <pre className="text-xs bg-muted/60 border border-border rounded-lg p-3 overflow-auto max-h-64 text-muted-foreground whitespace-pre-wrap">
              {PROMPT_TEMPLATE}
            </pre>
            <button
              onClick={copyPrompt}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-card border border-border hover:bg-muted transition-colors"
              title="복사"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          </div>
        )}
      </div>

      <hr className="border-border" />

      {/* JSON 입력 */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">
          JSON 붙여넣기 <span className="text-muted-foreground/50">(Claude 응답 또는 직접 작성)</span>
        </label>
        <textarea
          className="w-full bg-muted/40 border border-border rounded-lg p-3 text-sm font-mono text-foreground resize-y min-h-[180px] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
          placeholder={'{\n  "holdings": [\n    {"symbol": "005930", "name": "삼성전자", "quantity": 100, "avg_price": 68000}\n  ]\n}'}
          value={json}
          onChange={e => setJson(e.target.value)}
        />
      </div>

      {/* 포트폴리오 선택 */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">저장 위치</label>
        <div className="flex gap-2">
          <select
            className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
          >
            <option value="__new__">+ 새 포트폴리오 생성</option>
            {portfolios.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {targetId === '__new__' && (
            <input
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              placeholder="포트폴리오 이름 (생략 시 JSON name 사용)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          )}
        </div>
      </div>

      {errMsg && (
        <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">{errMsg}</p>
      )}

      {/* 버튼 */}
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
          : '적용'}
        </Button>
      </div>
    </div>
  );
}
