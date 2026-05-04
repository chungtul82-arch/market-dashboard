'use client';

import { Plus, ChevronDown, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { deletePortfolio } from '@/lib/portfolioFirebase';
import type { PortfolioMeta } from '@/types';
import { cn, fmtNumber } from '@/lib/utils';

interface Props {
  portfolios: PortfolioMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

export function PortfolioSelector({ portfolios, selectedId, onSelect, onCreateNew }: Props) {
  const [open, setOpen] = useState(false);
  const selected = portfolios.find(p => p.id === selectedId);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('포트폴리오를 삭제하시겠습니까?')) return;
    await deletePortfolio(id);
    if (selectedId === id && portfolios.length > 1) {
      onSelect(portfolios.find(p => p.id !== id)!.id);
    }
  }

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-sm hover:border-[#6366f1]/50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="font-medium text-foreground">{selected?.name ?? '포트폴리오 선택'}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 bg-card border border-border rounded-xl shadow-xl min-w-[220px] overflow-hidden">
            {portfolios.map(p => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors',
                  p.id === selectedId && 'bg-[#6366f1]/10',
                )}
                onClick={() => { onSelect(p.id); setOpen(false); }}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  {p.totalCurrentValue > 0 && (
                    <p className={cn('text-xs font-num', p.totalReturnPct >= 0 ? 'text-up' : 'text-down')}>
                      {p.totalReturnPct >= 0 ? '+' : ''}{p.totalReturnPct.toFixed(1)}%
                    </p>
                  )}
                </div>
                <button
                  className="text-muted-foreground hover:text-down p-1 rounded"
                  onClick={e => handleDelete(e, p.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div
              className="flex items-center gap-2 px-3 py-2.5 border-t border-border cursor-pointer hover:bg-muted/50 text-[#6366f1]"
              onClick={() => { onCreateNew(); setOpen(false); }}
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">새 포트폴리오 만들기</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
