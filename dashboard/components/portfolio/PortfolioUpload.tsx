'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parsePortfolioCSV } from '@/lib/portfolioParser';
import { savePortfolio, createPortfolio } from '@/lib/portfolioFirebase';
import { cn } from '@/lib/utils';
import type { PortfolioMeta, Holding } from '@/types';

interface Props {
  portfolios: PortfolioMeta[];
  onSaved: (portfolioId: string) => void;
  onClose: () => void;
}

export function PortfolioUpload({ portfolios, onSaved, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string>(portfolios[0]?.id ?? '__new__');
  const [newName,    setNewName]    = useState('');
  const [status,     setStatus]     = useState<'idle' | 'fetching' | 'saving' | 'done' | 'error'>('idle');
  const [message,    setMessage]    = useState('');
  const [dragging,   setDragging]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isNew = selectedId === '__new__';

  async function fetchStockInfo(symbols: string[]): Promise<Record<string, { name: string; sector: string }>> {
    try {
      const res = await fetch(`/api/stock-info?symbols=${symbols.join(',')}`);
      return res.ok ? await res.json() : {};
    } catch { return {}; }
  }

  async function handleFile(file: File) {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setStatus('error'); setMessage('CSV 파일만 업로드 가능합니다.'); return;
    }
    if (isNew && !newName.trim()) {
      setStatus('error'); setMessage('포트폴리오 이름을 입력해 주세요.'); return;
    }

    const text = await file.text();
    try {
      const portfolio = parsePortfolioCSV(text);
      if (portfolio.holdings.length === 0) {
        setStatus('error'); setMessage('수량 > 0 인 보유 종목이 없습니다.'); return;
      }

      setStatus('fetching');
      setMessage(`종목명·섹터 조회 중... (${portfolio.holdings.length}개 종목)`);

      const symbols = portfolio.holdings.map(h => h.symbol);
      const info    = await fetchStockInfo(symbols);

      const holdings: Holding[] = portfolio.holdings.map(h => ({
        ...h,
        name:   info[h.symbol]?.name   || h.symbol,
        sector: info[h.symbol]?.sector || '기타',
      }));

      setStatus('saving');
      setMessage('Firebase 저장 중...');

      let targetId = selectedId;
      if (isNew) {
        targetId = await createPortfolio(newName.trim());
      }

      await savePortfolio(targetId, {
        ...portfolio,
        name:     isNew ? newName.trim() : (portfolios.find(p => p.id === selectedId)?.name ?? '포트폴리오'),
        holdings,
        uploadedAt: new Date().toISOString(),
      });

      setStatus('done');
      setMessage(`${holdings.length}개 종목 저장 완료!`);
      setTimeout(() => { onSaved(targetId); onClose(); }, 1000);
    } catch (e) {
      setStatus('error');
      setMessage(`오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-foreground">CSV 업로드</h3>

      {/* 포트폴리오 선택 */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">저장할 포트폴리오</label>
        <select
          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          {portfolios.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          <option value="__new__">+ 새 포트폴리오 만들기</option>
        </select>
      </div>

      {/* 새 포트폴리오 이름 */}
      {isNew && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">포트폴리오 이름</label>
          <input
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            placeholder="예: 국내 주식, 연금 포트폴리오"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
        </div>
      )}

      {/* 파일 드롭존 */}
      <div
        className={cn(
          'rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
          dragging ? 'border-[#6366f1] bg-[#6366f1]/10' : 'border-border hover:border-[#6366f1]/50',
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
               onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        {status === 'idle' && (
          <>
            <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-foreground font-medium">Yahoo Finance CSV 선택</p>
            <p className="text-xs text-muted-foreground mt-1">드래그 앤 드롭 또는 클릭</p>
          </>
        )}
        {(status === 'fetching' || status === 'saving') && (
          <div className="flex items-center justify-center gap-2 text-[#6366f1]">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">{message}</span>
          </div>
        )}
        {status === 'done' && (
          <div className="flex items-center justify-center gap-2 text-up">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm">{message}</span>
          </div>
        )}
        {status === 'error' && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-down">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{message}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setStatus('idle'); }}>
              다시 시도
            </Button>
          </div>
        )}
      </div>

      <Button variant="ghost" className="w-full" onClick={onClose}>취소</Button>
    </div>
  );
}
