'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parsePortfolioCSV } from '@/lib/portfolioParser';
import { savePortfolio } from '@/lib/portfolioFirebase';
import { cn } from '@/lib/utils';

interface Props { onSaved: () => void }

export function PortfolioUpload({ onSaved }: Props) {
  const [status, setStatus]   = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setStatus('error');
      setMessage('CSV 파일만 업로드 가능합니다.');
      return;
    }
    const text = await file.text();
    try {
      const portfolio = parsePortfolioCSV(text);
      if (portfolio.holdings.length === 0) {
        setStatus('error');
        setMessage('보유 종목이 없습니다. Yahoo Finance 포트폴리오 CSV인지 확인해 주세요.');
        return;
      }
      setStatus('saving');
      setMessage(`${portfolio.holdings.length}개 종목 저장 중...`);
      await savePortfolio(portfolio);
      setStatus('done');
      setMessage(`${portfolio.holdings.length}개 종목 저장 완료!`);
      onSaved();
    } catch (e) {
      setStatus('error');
      setMessage(`오류: ${e instanceof Error ? e.message : '파싱 실패'}`);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
        dragging ? 'border-[#6366f1] bg-[#6366f1]/10' : 'border-border hover:border-[#6366f1]/50',
      )}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
             onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {status === 'idle' && (
        <>
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">Yahoo Finance CSV 업로드</p>
          <p className="text-xs text-muted-foreground mt-1">드래그 앤 드롭 또는 클릭</p>
          <p className="text-xs text-muted-foreground/60 mt-3">
            Yahoo Finance → My Portfolio → Download
          </p>
        </>
      )}

      {status === 'saving' && (
        <div className="flex items-center justify-center gap-2 text-[#6366f1]">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{message}</span>
        </div>
      )}

      {status === 'done' && (
        <div className="flex items-center justify-center gap-2 text-up">
          <CheckCircle className="w-5 h-5" />
          <span>{message}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-down">
            <AlertCircle className="w-5 h-5" />
            <span>{message}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setStatus('idle'); }}>
            다시 시도
          </Button>
        </div>
      )}
    </div>
  );
}
